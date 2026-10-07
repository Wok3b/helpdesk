namespace HelpDesk.Api.Domain;

public class Ticket
{
    public int Id { get; set; }

    // Filled by a SQL Server sequence (see TicketConfiguration), shown to users as "HD-1001".
    public int Number { get; set; }

    public required string Title { get; set; }
    public required string Description { get; set; }
    public TicketCategory Category { get; set; }
    public TicketPriority Priority { get; set; }
    public TicketStatus Status { get; set; } = TicketStatus.New;

    public int CreatedById { get; set; }
    public User CreatedBy { get; set; } = null!;

    public int? AssigneeId { get; set; }
    public User? Assignee { get; set; }

    public int? AssetId { get; set; }
    public Asset? Asset { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public DateTimeOffset DueAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }

    public List<Comment> Comments { get; set; } = [];
    public List<TicketEvent> Events { get; set; } = [];

    public bool IsOpen => Status is not (TicketStatus.Resolved or TicketStatus.Closed);

    public bool IsOverdue(DateTimeOffset now) => IsOpen && now > DueAt;
}
