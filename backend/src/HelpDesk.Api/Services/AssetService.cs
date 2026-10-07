using HelpDesk.Api.Auth;
using HelpDesk.Api.Common;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Data;
using HelpDesk.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace HelpDesk.Api.Services;

public interface IAssetService
{
    Task<PagedResult<AssetDto>> ListAsync(AssetQuery query, CancellationToken ct);
    Task<AssetDto> GetAsync(int id, CancellationToken ct);
    Task<AssetDto> CreateAsync(SaveAssetRequest request, CancellationToken ct);
    Task<AssetDto> UpdateAsync(int id, SaveAssetRequest request, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}

public class AssetService(AppDbContext db, ICurrentUser me) : IAssetService
{
    // Employees see the equipment assigned to them, so they can pick it when reporting a problem.
    private IQueryable<Asset> VisibleAssets() =>
        me.IsStaff ? db.Assets : db.Assets.Where(a => a.AssignedToId == me.Id);

    public async Task<PagedResult<AssetDto>> ListAsync(AssetQuery q, CancellationToken ct)
    {
        var assets = VisibleAssets().AsNoTracking();

        if (q.Type is { } type) assets = assets.Where(a => a.Type == type);
        if (q.Status is { } status) assets = assets.Where(a => a.Status == status);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim();
            assets = assets.Where(a => a.Tag.Contains(term) || a.Name.Contains(term) || (a.SerialNumber != null && a.SerialNumber.Contains(term)));
        }

        return await assets.OrderBy(a => a.Tag).Select(ToDtoExpression).ToPagedAsync(q.Page, q.PageSize, ct);
    }

    public async Task<AssetDto> GetAsync(int id, CancellationToken ct) =>
        await VisibleAssets().AsNoTracking().Where(a => a.Id == id).Select(ToDtoExpression).FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Asset", id);

    public async Task<AssetDto> CreateAsync(SaveAssetRequest r, CancellationToken ct)
    {
        RequireStaff();
        await EnsureTagIsFreeAsync(r.Tag, exceptId: null, ct);
        await EnsureAssigneeExistsAsync(r.AssignedToId, ct);

        var asset = new Asset { Tag = r.Tag, Name = r.Name };
        Apply(asset, r);
        db.Assets.Add(asset);
        await db.SaveChangesAsync(ct);
        return await GetAsync(asset.Id, ct);
    }

    public async Task<AssetDto> UpdateAsync(int id, SaveAssetRequest r, CancellationToken ct)
    {
        RequireStaff();
        var asset = await db.Assets.FindAsync([id], ct) ?? throw new NotFoundException("Asset", id);
        await EnsureTagIsFreeAsync(r.Tag, exceptId: id, ct);
        await EnsureAssigneeExistsAsync(r.AssignedToId, ct);

        Apply(asset, r);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        if (me.Role != UserRole.Admin) throw new ForbiddenException("Only admins can delete assets.");
        var asset = await db.Assets.FindAsync([id], ct) ?? throw new NotFoundException("Asset", id);
        db.Assets.Remove(asset);
        await db.SaveChangesAsync(ct);
    }

    private static void Apply(Asset asset, SaveAssetRequest r)
    {
        asset.Tag = r.Tag.Trim().ToUpperInvariant();
        asset.Name = r.Name.Trim();
        asset.Type = r.Type;
        asset.Status = r.Status;
        asset.SerialNumber = string.IsNullOrWhiteSpace(r.SerialNumber) ? null : r.SerialNumber.Trim();
        asset.AssignedToId = r.AssignedToId;
        asset.PurchaseDate = r.PurchaseDate;
        asset.WarrantyUntil = r.WarrantyUntil;
        asset.Notes = string.IsNullOrWhiteSpace(r.Notes) ? null : r.Notes.Trim();
    }

    private async Task EnsureTagIsFreeAsync(string tag, int? exceptId, CancellationToken ct)
    {
        var normalized = tag.Trim().ToUpperInvariant();
        if (await db.Assets.AnyAsync(a => a.Tag == normalized && a.Id != exceptId, ct))
            throw new ConflictException($"Asset tag {normalized} is already in use.");
    }

    private async Task EnsureAssigneeExistsAsync(int? userId, CancellationToken ct)
    {
        if (userId is { } id && !await db.Users.AnyAsync(u => u.Id == id && u.IsActive, ct))
            throw new NotFoundException("User", id);
    }

    private void RequireStaff()
    {
        if (!me.IsStaff) throw new ForbiddenException("Only help desk staff can manage equipment.");
    }

    private static readonly System.Linq.Expressions.Expression<Func<Asset, AssetDto>> ToDtoExpression = a => new AssetDto(
        a.Id,
        a.Tag,
        a.Name,
        a.Type,
        a.Status,
        a.SerialNumber,
        a.AssignedTo == null ? null : new UserSummary(a.AssignedTo.Id, a.AssignedTo.FullName),
        a.PurchaseDate,
        a.WarrantyUntil,
        a.Notes,
        a.Tickets.Count(t => t.Status != TicketStatus.Resolved && t.Status != TicketStatus.Closed));
}
