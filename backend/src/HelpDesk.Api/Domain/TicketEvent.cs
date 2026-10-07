namespace HelpDesk.Api.Domain;

// Append-only history of a ticket, shown as a timeline in the UI.
public class TicketEvent
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;
    public int ActorId { get; set; }
    public User Actor { get; set; } = null!;
    public TicketEventType Type { get; set; }
    public string? FromValue { get; set; }
    public string? ToValue { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
