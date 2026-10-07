using HelpDesk.Api.Auth;
using HelpDesk.Api.Common;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Data;
using HelpDesk.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace HelpDesk.Api.Services;

public interface ITicketService
{
    Task<PagedResult<TicketListItem>> ListAsync(TicketQuery query, CancellationToken ct);
    Task<TicketDetails> GetAsync(int id, CancellationToken ct);
    Task<TicketDetails> CreateAsync(CreateTicketRequest request, CancellationToken ct);
    Task<TicketDetails> ChangeStatusAsync(int id, TicketStatus status, CancellationToken ct);
    Task<TicketDetails> AssignAsync(int id, int? assigneeId, CancellationToken ct);
    Task<TicketDetails> ChangePriorityAsync(int id, TicketPriority priority, CancellationToken ct);
    Task<CommentDto> AddCommentAsync(int id, AddCommentRequest request, CancellationToken ct);
}

public class TicketService(AppDbContext db, ICurrentUser me, TimeProvider clock) : ITicketService
{
    public const string KeyPrefix = "HD-";

    // Employees only ever see tickets they reported; staff see everything.
    private IQueryable<Ticket> VisibleTickets() =>
        me.IsStaff ? db.Tickets : db.Tickets.Where(t => t.CreatedById == me.Id);

    public async Task<PagedResult<TicketListItem>> ListAsync(TicketQuery q, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var tickets = VisibleTickets().AsNoTracking();

        if (q.Status is { } status) tickets = tickets.Where(t => t.Status == status);
        if (q.Priority is { } priority) tickets = tickets.Where(t => t.Priority == priority);
        if (q.Category is { } category) tickets = tickets.Where(t => t.Category == category);
        if (q.AssigneeId is { } assigneeId) tickets = tickets.Where(t => t.AssigneeId == assigneeId);
        if (q.Unassigned == true) tickets = tickets.Where(t => t.AssigneeId == null);
        if (q.OpenOnly == true) tickets = tickets.Where(t => t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed);
        if (q.Overdue == true)
            tickets = tickets.Where(t => t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed && t.DueAt < now);

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            var number = ParseTicketNumber(term);
            tickets = tickets.Where(t => t.Title.Contains(term) || t.Description.Contains(term) || t.Number == number);
        }

        tickets = (q.Sort, q.Dir) switch
        {
            (TicketSort.Priority, SortDirection.Asc) => tickets.OrderBy(PriorityRank).ThenBy(t => t.DueAt),
            (TicketSort.Priority, _) => tickets.OrderByDescending(PriorityRank).ThenBy(t => t.DueAt),
            (TicketSort.DueAt, SortDirection.Asc) => tickets.OrderBy(t => t.DueAt),
            (TicketSort.DueAt, _) => tickets.OrderByDescending(t => t.DueAt),
            (TicketSort.UpdatedAt, SortDirection.Asc) => tickets.OrderBy(t => t.UpdatedAt),
            (TicketSort.UpdatedAt, _) => tickets.OrderByDescending(t => t.UpdatedAt),
            (TicketSort.Number, SortDirection.Asc) => tickets.OrderBy(t => t.Number),
            (TicketSort.Number, _) => tickets.OrderByDescending(t => t.Number),
            (_, SortDirection.Asc) => tickets.OrderBy(t => t.CreatedAt),
            _ => tickets.OrderByDescending(t => t.CreatedAt)
        };

        var isStaff = me.IsStaff;
        return await tickets
            .Select(t => new TicketListItem(
                t.Id,
                KeyPrefix + t.Number,
                t.Title,
                t.Category,
                t.Priority,
                t.Status,
                new UserSummary(t.CreatedBy.Id, t.CreatedBy.FullName),
                t.Assignee == null ? null : new UserSummary(t.Assignee.Id, t.Assignee.FullName),
                t.CreatedAt,
                t.DueAt,
                t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed && t.DueAt < now,
                t.Comments.Count(c => isStaff || !c.IsInternal)))
            .ToPagedAsync(q.Page, q.PageSize, ct);
    }

    public async Task<TicketDetails> GetAsync(int id, CancellationToken ct)
    {
        var ticket = await VisibleTickets()
            .AsNoTracking()
            .AsSplitQuery()
            .Include(t => t.CreatedBy)
            .Include(t => t.Assignee)
            .Include(t => t.Asset)
            .Include(t => t.Comments.OrderBy(c => c.CreatedAt)).ThenInclude(c => c.Author)
            .Include(t => t.Events.OrderBy(e => e.CreatedAt)).ThenInclude(e => e.Actor)
            .FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw new NotFoundException("Ticket", id);

        return ToDetails(ticket);
    }

    public async Task<TicketDetails> CreateAsync(CreateTicketRequest r, CancellationToken ct)
    {
        if (r.AssetId is { } assetId)
        {
            var asset = await db.Assets.FindAsync([assetId], ct) ?? throw new NotFoundException("Asset", assetId);
            if (!me.IsStaff && asset.AssignedToId != me.Id)
                throw new ForbiddenException("You can only report problems with equipment assigned to you.");
        }

        var now = clock.GetUtcNow();
        var ticket = new Ticket
        {
            Title = r.Title.Trim(),
            Description = r.Description.Trim(),
            Category = r.Category,
            Priority = r.Priority,
            AssetId = r.AssetId,
            CreatedById = me.Id,
            CreatedAt = now,
            UpdatedAt = now,
            DueAt = SlaPolicy.DueAt(now, r.Priority)
        };
        ticket.Events.Add(NewEvent(TicketEventType.Created, now, toValue: r.Priority.ToString()));

        db.Tickets.Add(ticket);
        await db.SaveChangesAsync(ct);

        return await GetAsync(ticket.Id, ct);
    }

    public async Task<TicketDetails> ChangeStatusAsync(int id, TicketStatus status, CancellationToken ct)
    {
        var ticket = await LoadForUpdateAsync(id, ct);

        if (!TicketWorkflow.CanTransition(ticket.Status, status, me.Role))
            throw new BusinessRuleException($"A ticket can't go from {ticket.Status} to {status}.");

        var now = clock.GetUtcNow();
        ticket.Events.Add(NewEvent(TicketEventType.StatusChanged, now, ticket.Status.ToString(), status.ToString()));

        ticket.Status = status;
        ticket.UpdatedAt = now;
        ticket.ResolvedAt = status switch
        {
            TicketStatus.Resolved => now,
            TicketStatus.Closed => ticket.ResolvedAt ?? now,
            _ => null
        };

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<TicketDetails> AssignAsync(int id, int? assigneeId, CancellationToken ct)
    {
        RequireStaff();
        var ticket = await LoadForUpdateAsync(id, ct);
        if (!ticket.IsOpen)
            throw new BusinessRuleException("Closed or resolved tickets can't be reassigned.");

        User? assignee = null;
        if (assigneeId is { } uid)
        {
            assignee = await db.Users.FindAsync([uid], ct) ?? throw new NotFoundException("User", uid);
            if (assignee.Role == UserRole.Employee || !assignee.IsActive)
                throw new BusinessRuleException("Tickets can only be assigned to active technicians or admins.");
        }

        var previous = ticket.AssigneeId is null
            ? null
            : await db.Users.Where(u => u.Id == ticket.AssigneeId).Select(u => u.FullName).FirstAsync(ct);

        var now = clock.GetUtcNow();
        ticket.Events.Add(NewEvent(TicketEventType.Assigned, now, previous, assignee?.FullName));
        ticket.AssigneeId = assignee?.Id;
        ticket.UpdatedAt = now;

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<TicketDetails> ChangePriorityAsync(int id, TicketPriority priority, CancellationToken ct)
    {
        RequireStaff();
        var ticket = await LoadForUpdateAsync(id, ct);
        if (ticket.Priority == priority)
            return await GetAsync(id, ct);

        var now = clock.GetUtcNow();
        ticket.Events.Add(NewEvent(TicketEventType.PriorityChanged, now, ticket.Priority.ToString(), priority.ToString()));
        ticket.Priority = priority;
        ticket.DueAt = SlaPolicy.DueAt(ticket.CreatedAt, priority);
        ticket.UpdatedAt = now;

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<CommentDto> AddCommentAsync(int id, AddCommentRequest r, CancellationToken ct)
    {
        if (r.IsInternal && !me.IsStaff)
            throw new ForbiddenException("Only help desk staff can add internal notes.");

        var ticket = await LoadForUpdateAsync(id, ct);
        if (ticket.Status == TicketStatus.Closed)
            throw new BusinessRuleException("Closed tickets can't receive new comments.");

        var now = clock.GetUtcNow();
        var comment = new Comment { Body = r.Body.Trim(), IsInternal = r.IsInternal, AuthorId = me.Id, CreatedAt = now };
        ticket.Comments.Add(comment);
        ticket.Events.Add(NewEvent(TicketEventType.Commented, now));
        ticket.UpdatedAt = now;

        // When the reporter answers a question, the ticket goes back to the technician's queue.
        if (!me.IsStaff && ticket.Status == TicketStatus.WaitingOnUser)
        {
            ticket.Events.Add(NewEvent(TicketEventType.StatusChanged, now, ticket.Status.ToString(), nameof(TicketStatus.InProgress)));
            ticket.Status = TicketStatus.InProgress;
        }

        await db.SaveChangesAsync(ct);

        var author = await db.Users.AsNoTracking().FirstAsync(u => u.Id == me.Id, ct);
        return new CommentDto(comment.Id, new UserSummary(author.Id, author.FullName), comment.Body, comment.IsInternal, comment.CreatedAt);
    }

    private async Task<Ticket> LoadForUpdateAsync(int id, CancellationToken ct) =>
        await VisibleTickets().FirstOrDefaultAsync(t => t.Id == id, ct) ?? throw new NotFoundException("Ticket", id);

    private void RequireStaff()
    {
        if (!me.IsStaff) throw new ForbiddenException("Only help desk staff can do this.");
    }

    private TicketEvent NewEvent(TicketEventType type, DateTimeOffset at, string? fromValue = null, string? toValue = null) =>
        new() { Type = type, ActorId = me.Id, FromValue = fromValue, ToValue = toValue, CreatedAt = at };

    private TicketDetails ToDetails(Ticket t)
    {
        var now = clock.GetUtcNow();
        var comments = t.Comments
            .Where(c => me.IsStaff || !c.IsInternal)
            .Select(c => new CommentDto(c.Id, new UserSummary(c.Author.Id, c.Author.FullName), c.Body, c.IsInternal, c.CreatedAt))
            .ToList();
        var events = t.Events
            .Select(e => new TicketEventDto(e.Id, e.Type, new UserSummary(e.Actor.Id, e.Actor.FullName), e.FromValue, e.ToValue, e.CreatedAt))
            .ToList();

        return new TicketDetails(
            t.Id,
            KeyPrefix + t.Number,
            t.Title,
            t.Description,
            t.Category,
            t.Priority,
            t.Status,
            new UserSummary(t.CreatedBy.Id, t.CreatedBy.FullName),
            t.Assignee is null ? null : new UserSummary(t.Assignee.Id, t.Assignee.FullName),
            t.Asset is null ? null : new AssetSummary(t.Asset.Id, t.Asset.Tag, t.Asset.Name, t.Asset.Type),
            t.CreatedAt,
            t.UpdatedAt,
            t.DueAt,
            t.ResolvedAt,
            t.IsOverdue(now),
            TicketWorkflow.AllowedNext(t.Status, me.Role),
            comments,
            events);
    }

    // Enums are stored as text, so sorting by the column would be alphabetical. Rank them explicitly instead.
    private static readonly System.Linq.Expressions.Expression<Func<Ticket, int>> PriorityRank = t =>
        t.Priority == TicketPriority.Critical ? 4 :
        t.Priority == TicketPriority.High ? 3 :
        t.Priority == TicketPriority.Medium ? 2 : 1;

    // Accepts "HD-1001", "hd-1001" or "1001"; returns -1 when the search term isn't a ticket number.
    public static int ParseTicketNumber(string term)
    {
        var digits = term.StartsWith(KeyPrefix, StringComparison.OrdinalIgnoreCase) ? term[KeyPrefix.Length..] : term;
        return int.TryParse(digits, out var n) ? n : -1;
    }
}
