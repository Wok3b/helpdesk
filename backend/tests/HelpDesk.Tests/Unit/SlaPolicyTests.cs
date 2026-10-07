using HelpDesk.Api.Domain;
using Shouldly;

namespace HelpDesk.Tests.Unit;

public class SlaPolicyTests
{
    [Theory]
    [InlineData(TicketPriority.Critical, 4)]
    [InlineData(TicketPriority.High, 24)]
    [InlineData(TicketPriority.Medium, 72)]
    [InlineData(TicketPriority.Low, 120)]
    public void Due_date_is_creation_time_plus_resolution_time(TicketPriority priority, int hours)
    {
        var createdAt = new DateTimeOffset(2026, 10, 7, 9, 0, 0, TimeSpan.Zero);

        SlaPolicy.DueAt(createdAt, priority).ShouldBe(createdAt.AddHours(hours));
    }

    [Fact]
    public void Higher_priority_always_gets_a_shorter_deadline()
    {
        var ordered = Enum.GetValues<TicketPriority>().Select(SlaPolicy.ResolutionTime).ToList();

        ordered.ShouldBe(ordered.OrderByDescending(t => t).ToList());
    }

    [Fact]
    public void Open_ticket_past_its_due_date_is_overdue_but_a_resolved_one_is_not()
    {
        var now = new DateTimeOffset(2026, 10, 7, 12, 0, 0, TimeSpan.Zero);
        var ticket = new Ticket { Title = "t", Description = "d", DueAt = now.AddMinutes(-1), Status = TicketStatus.InProgress };

        ticket.IsOverdue(now).ShouldBeTrue();

        ticket.Status = TicketStatus.Resolved;
        ticket.IsOverdue(now).ShouldBeFalse();
    }
}
