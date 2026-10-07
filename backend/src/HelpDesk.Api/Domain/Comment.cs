namespace HelpDesk.Api.Domain;

public class Comment
{
    public int Id { get; set; }
    public int TicketId { get; set; }
    public Ticket Ticket { get; set; } = null!;
    public int AuthorId { get; set; }
    public User Author { get; set; } = null!;
    public required string Body { get; set; }

    // Internal notes are only visible to technicians and admins.
    public bool IsInternal { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
