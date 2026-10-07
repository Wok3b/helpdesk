using System.ComponentModel.DataAnnotations;
using HelpDesk.Api.Domain;

namespace HelpDesk.Api.Contracts;

// ---------- Users & auth ----------

public record UserSummary(int Id, string FullName);

public record UserDto(int Id, string FullName, string Email, UserRole Role, string? Department, bool IsActive);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record LoginResponse(string Token, DateTimeOffset ExpiresAt, UserDto User);

public record CreateUserRequest(
    [Required, StringLength(120, MinimumLength = 2)] string FullName,
    [Required, EmailAddress, StringLength(200)] string Email,
    [Required, StringLength(100, MinimumLength = 8)] string Password,
    UserRole Role,
    [StringLength(80)] string? Department);

public record UpdateUserRequest(
    [Required, StringLength(120, MinimumLength = 2)] string FullName,
    UserRole Role,
    [StringLength(80)] string? Department,
    bool IsActive);

// ---------- Tickets ----------

public record TicketListItem(
    int Id,
    string Key,
    string Title,
    TicketCategory Category,
    TicketPriority Priority,
    TicketStatus Status,
    UserSummary CreatedBy,
    UserSummary? Assignee,
    DateTimeOffset CreatedAt,
    DateTimeOffset DueAt,
    bool IsOverdue,
    int CommentCount);

public record TicketDetails(
    int Id,
    string Key,
    string Title,
    string Description,
    TicketCategory Category,
    TicketPriority Priority,
    TicketStatus Status,
    UserSummary CreatedBy,
    UserSummary? Assignee,
    AssetSummary? Asset,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset DueAt,
    DateTimeOffset? ResolvedAt,
    bool IsOverdue,
    IReadOnlyList<TicketStatus> AllowedTransitions,
    IReadOnlyList<CommentDto> Comments,
    IReadOnlyList<TicketEventDto> Events);

public record CommentDto(int Id, UserSummary Author, string Body, bool IsInternal, DateTimeOffset CreatedAt);

public record TicketEventDto(int Id, TicketEventType Type, UserSummary Actor, string? FromValue, string? ToValue, DateTimeOffset CreatedAt);

public record CreateTicketRequest(
    [Required, StringLength(150, MinimumLength = 5)] string Title,
    [Required, StringLength(4000, MinimumLength = 10)] string Description,
    TicketCategory Category,
    TicketPriority Priority,
    int? AssetId);

public record ChangeStatusRequest([Required] TicketStatus? Status);

public record AssignTicketRequest(int? AssigneeId);

public record ChangePriorityRequest([Required] TicketPriority? Priority);

public record AddCommentRequest(
    [Required, StringLength(4000, MinimumLength = 1)] string Body,
    bool IsInternal);

public enum TicketSort { CreatedAt, UpdatedAt, DueAt, Priority, Number }

public enum SortDirection { Asc, Desc }

public class TicketQuery
{
    public TicketStatus? Status { get; set; }
    public TicketPriority? Priority { get; set; }
    public TicketCategory? Category { get; set; }
    public int? AssigneeId { get; set; }
    public bool? Unassigned { get; set; }
    public bool? Overdue { get; set; }
    public bool? OpenOnly { get; set; }

    [StringLength(100)]
    public string? Search { get; set; }

    public TicketSort Sort { get; set; } = TicketSort.CreatedAt;
    public SortDirection Dir { get; set; } = SortDirection.Desc;
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// ---------- Assets ----------

public record AssetSummary(int Id, string Tag, string Name, AssetType Type);

public record AssetDto(
    int Id,
    string Tag,
    string Name,
    AssetType Type,
    AssetStatus Status,
    string? SerialNumber,
    UserSummary? AssignedTo,
    DateOnly? PurchaseDate,
    DateOnly? WarrantyUntil,
    string? Notes,
    int OpenTicketCount);

public record SaveAssetRequest(
    [Required, StringLength(20, MinimumLength = 2)] string Tag,
    [Required, StringLength(120, MinimumLength = 2)] string Name,
    AssetType Type,
    AssetStatus Status,
    [StringLength(60)] string? SerialNumber,
    int? AssignedToId,
    DateOnly? PurchaseDate,
    DateOnly? WarrantyUntil,
    [StringLength(1000)] string? Notes);

public class AssetQuery
{
    public AssetType? Type { get; set; }
    public AssetStatus? Status { get; set; }

    [StringLength(100)]
    public string? Search { get; set; }

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

// ---------- Dashboard ----------

public record CountBy(string Key, int Count);

public record DailyTicketStats(DateOnly Day, int Created, int Resolved);

public record TechnicianWorkload(int UserId, string FullName, int OpenAssigned, int OverdueAssigned);

public record DashboardDto(
    int OpenTickets,
    int OverdueTickets,
    int UnassignedTickets,
    int ResolvedLast7Days,
    double? AvgResolutionHours,
    IReadOnlyList<CountBy> ByStatus,
    IReadOnlyList<CountBy> ByPriority,
    IReadOnlyList<CountBy> ByCategory,
    IReadOnlyList<DailyTicketStats> Daily,
    IReadOnlyList<TechnicianWorkload> Workload);
