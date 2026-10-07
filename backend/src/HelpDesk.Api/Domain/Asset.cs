namespace HelpDesk.Api.Domain;

public class Asset
{
    public int Id { get; set; }

    // Inventory label stuck on the device, e.g. "LT-0042".
    public required string Tag { get; set; }

    public required string Name { get; set; }
    public AssetType Type { get; set; }
    public AssetStatus Status { get; set; } = AssetStatus.InStock;
    public string? SerialNumber { get; set; }

    public int? AssignedToId { get; set; }
    public User? AssignedTo { get; set; }

    public DateOnly? PurchaseDate { get; set; }
    public DateOnly? WarrantyUntil { get; set; }
    public string? Notes { get; set; }

    public List<Ticket> Tickets { get; set; } = [];
}
