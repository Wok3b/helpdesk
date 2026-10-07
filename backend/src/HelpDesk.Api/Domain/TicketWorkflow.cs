namespace HelpDesk.Api.Domain;

// The ticket lifecycle as a small state machine: which status changes are allowed, and for whom.
public static class TicketWorkflow
{
    private static readonly Dictionary<TicketStatus, TicketStatus[]> StaffTransitions = new()
    {
        [TicketStatus.New] = [TicketStatus.InProgress, TicketStatus.Closed],
        [TicketStatus.InProgress] = [TicketStatus.WaitingOnUser, TicketStatus.Resolved],
        [TicketStatus.WaitingOnUser] = [TicketStatus.InProgress, TicketStatus.Resolved],
        [TicketStatus.Resolved] = [TicketStatus.InProgress, TicketStatus.Closed],
        [TicketStatus.Closed] = []
    };

    // The person who reported the problem can only confirm the fix or say it isn't fixed.
    private static readonly Dictionary<TicketStatus, TicketStatus[]> ReporterTransitions = new()
    {
        [TicketStatus.Resolved] = [TicketStatus.InProgress, TicketStatus.Closed]
    };

    public static IReadOnlyList<TicketStatus> AllowedNext(TicketStatus current, UserRole role)
    {
        if (role == UserRole.Admin && current == TicketStatus.Closed)
            return [TicketStatus.InProgress];

        var table = role == UserRole.Employee ? ReporterTransitions : StaffTransitions;
        return table.TryGetValue(current, out var next) ? next : [];
    }

    public static bool CanTransition(TicketStatus from, TicketStatus to, UserRole role) =>
        AllowedNext(from, role).Contains(to);
}
