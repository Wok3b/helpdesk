using HelpDesk.Api.Domain;
using HelpDesk.Api.Services;
using Shouldly;

namespace HelpDesk.Tests.Unit;

public class TicketWorkflowTests
{
    [Theory]
    [InlineData(TicketStatus.New, TicketStatus.InProgress)]
    [InlineData(TicketStatus.InProgress, TicketStatus.WaitingOnUser)]
    [InlineData(TicketStatus.WaitingOnUser, TicketStatus.Resolved)]
    [InlineData(TicketStatus.Resolved, TicketStatus.Closed)]
    [InlineData(TicketStatus.Resolved, TicketStatus.InProgress)]
    public void Technician_can_move_a_ticket_along_the_workflow(TicketStatus from, TicketStatus to) =>
        TicketWorkflow.CanTransition(from, to, UserRole.Technician).ShouldBeTrue();

    [Theory]
    [InlineData(TicketStatus.New, TicketStatus.Resolved)]
    [InlineData(TicketStatus.InProgress, TicketStatus.New)]
    [InlineData(TicketStatus.Closed, TicketStatus.InProgress)]
    [InlineData(TicketStatus.InProgress, TicketStatus.InProgress)]
    public void Technician_cannot_skip_steps_or_reopen_closed_tickets(TicketStatus from, TicketStatus to) =>
        TicketWorkflow.CanTransition(from, to, UserRole.Technician).ShouldBeFalse();

    [Fact]
    public void Only_an_admin_can_reopen_a_closed_ticket()
    {
        TicketWorkflow.CanTransition(TicketStatus.Closed, TicketStatus.InProgress, UserRole.Admin).ShouldBeTrue();
        TicketWorkflow.CanTransition(TicketStatus.Closed, TicketStatus.InProgress, UserRole.Technician).ShouldBeFalse();
    }

    [Fact]
    public void Reporter_can_only_confirm_or_reject_a_fix()
    {
        TicketWorkflow.AllowedNext(TicketStatus.Resolved, UserRole.Employee)
            .ShouldBe([TicketStatus.InProgress, TicketStatus.Closed], ignoreOrder: true);

        foreach (var status in Enum.GetValues<TicketStatus>().Where(s => s != TicketStatus.Resolved))
            TicketWorkflow.AllowedNext(status, UserRole.Employee).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("HD-1001", 1001)]
    [InlineData("hd-42", 42)]
    [InlineData("1005", 1005)]
    [InlineData("printer", -1)]
    [InlineData("HD-", -1)]
    public void Search_term_is_recognised_as_a_ticket_number(string term, int expected) =>
        TicketService.ParseTicketNumber(term).ShouldBe(expected);
}
