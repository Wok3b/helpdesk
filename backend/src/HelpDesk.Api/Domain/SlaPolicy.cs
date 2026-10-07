namespace HelpDesk.Api.Domain;

// How long the help desk has to resolve a ticket, by priority.
public static class SlaPolicy
{
    public static TimeSpan ResolutionTime(TicketPriority priority) => priority switch
    {
        TicketPriority.Critical => TimeSpan.FromHours(4),
        TicketPriority.High => TimeSpan.FromDays(1),
        TicketPriority.Medium => TimeSpan.FromDays(3),
        TicketPriority.Low => TimeSpan.FromDays(5),
        _ => throw new ArgumentOutOfRangeException(nameof(priority), priority, null)
    };

    public static DateTimeOffset DueAt(DateTimeOffset createdAt, TicketPriority priority) =>
        createdAt + ResolutionTime(priority);
}
