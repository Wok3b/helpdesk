using System.Net;
using HelpDesk.Api.Common;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Shouldly;

namespace HelpDesk.Tests.Integration;

[Collection(ApiCollection.Name)]
public class TicketTests(ApiFactory api)
{
    private static CreateTicketRequest NewTicket(TicketPriority priority = TicketPriority.Medium) => new(
        $"Printer offline {Guid.NewGuid():N}"[..30],
        "The printer near HR shows offline on my laptop since this morning.",
        TicketCategory.Hardware,
        priority,
        AssetId: null);

    private async Task<TicketDetails> CreateAsJelenaAsync(TicketPriority priority = TicketPriority.Medium)
    {
        var jelena = await api.ClientForAsync(Users.Jelena);
        var response = await jelena.PostJsonAsync("/api/tickets", NewTicket(priority));
        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        return await response.ReadAsync<TicketDetails>();
    }

    [Fact]
    public async Task New_ticket_gets_a_number_a_status_and_an_SLA_deadline()
    {
        var ticket = await CreateAsJelenaAsync(TicketPriority.High);

        ticket.Key.ShouldMatch(@"^HD-\d{4,}$");
        ticket.Status.ShouldBe(TicketStatus.New);
        ticket.DueAt.ShouldBe(ticket.CreatedAt.AddDays(1));
        ticket.Events.ShouldHaveSingleItem().Type.ShouldBe(TicketEventType.Created);
    }

    [Fact]
    public async Task Invalid_input_is_rejected_with_field_errors()
    {
        var jelena = await api.ClientForAsync(Users.Jelena);

        var response = await jelena.PostJsonAsync("/api/tickets",
            new CreateTicketRequest("x", "short", TicketCategory.Network, TicketPriority.Low, null));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await response.ReadAsync<ValidationProblemDetails>();
        problem.Errors.Keys.ShouldBe(["Title", "Description"], ignoreOrder: true);
    }

    [Fact]
    public async Task Employees_cannot_see_each_others_tickets()
    {
        var ticket = await CreateAsJelenaAsync();
        var marko = await api.ClientForAsync(Users.Marko);

        (await marko.GetAsync($"/api/tickets/{ticket.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var markosList = await (await marko.GetAsync("/api/tickets?pageSize=100")).ReadAsync<PagedResult<TicketListItem>>();
        markosList.Items.ShouldAllBe(t => t.CreatedBy.FullName == "Marko Nikolić");
    }

    [Fact]
    public async Task Technician_takes_a_ticket_from_new_to_resolved_and_the_history_is_recorded()
    {
        var ticket = await CreateAsJelenaAsync();
        var tech = await api.ClientForAsync(Users.Tech);
        var me = await (await tech.GetAsync("/api/auth/me")).ReadAsync<UserDto>();

        (await tech.PatchJsonAsync($"/api/tickets/{ticket.Id}/assignee", new AssignTicketRequest(me.Id))).EnsureSuccessStatusCode();
        (await tech.PatchJsonAsync($"/api/tickets/{ticket.Id}/status", new ChangeStatusRequest(TicketStatus.InProgress))).EnsureSuccessStatusCode();
        var resolved = await (await tech.PatchJsonAsync($"/api/tickets/{ticket.Id}/status", new ChangeStatusRequest(TicketStatus.Resolved)))
            .ReadAsync<TicketDetails>();

        resolved.Status.ShouldBe(TicketStatus.Resolved);
        resolved.Assignee!.Id.ShouldBe(me.Id);
        resolved.ResolvedAt.ShouldNotBeNull();
        resolved.Events.Select(e => e.Type).ShouldBe(
            [TicketEventType.Created, TicketEventType.Assigned, TicketEventType.StatusChanged, TicketEventType.StatusChanged]);
    }

    [Fact]
    public async Task Skipping_a_workflow_step_is_a_400_with_an_explanation()
    {
        var ticket = await CreateAsJelenaAsync();
        var tech = await api.ClientForAsync(Users.Tech);

        var response = await tech.PatchJsonAsync($"/api/tickets/{ticket.Id}/status", new ChangeStatusRequest(TicketStatus.Resolved));

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await response.ReadAsync<ProblemDetails>()).Detail.ShouldBe("A ticket can't go from New to Resolved.");
    }

    [Fact]
    public async Task Employees_cannot_assign_tickets()
    {
        var ticket = await CreateAsJelenaAsync();
        var jelena = await api.ClientForAsync(Users.Jelena);

        var response = await jelena.PatchJsonAsync($"/api/tickets/{ticket.Id}/assignee", new AssignTicketRequest(2));

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Internal_notes_are_hidden_from_the_reporter()
    {
        var ticket = await CreateAsJelenaAsync();
        var tech = await api.ClientForAsync(Users.Tech);
        var jelena = await api.ClientForAsync(Users.Jelena);

        await tech.PostJsonAsync($"/api/tickets/{ticket.Id}/comments", new AddCommentRequest("Driver bug, rolling back.", IsInternal: true));
        await tech.PostJsonAsync($"/api/tickets/{ticket.Id}/comments", new AddCommentRequest("Please restart your laptop.", IsInternal: false));

        var staffView = await (await tech.GetAsync($"/api/tickets/{ticket.Id}")).ReadAsync<TicketDetails>();
        var reporterView = await (await jelena.GetAsync($"/api/tickets/{ticket.Id}")).ReadAsync<TicketDetails>();

        staffView.Comments.Count.ShouldBe(2);
        reporterView.Comments.ShouldHaveSingleItem().Body.ShouldBe("Please restart your laptop.");
    }

    [Fact]
    public async Task Reporter_reply_puts_a_waiting_ticket_back_in_progress()
    {
        var ticket = await CreateAsJelenaAsync();
        var tech = await api.ClientForAsync(Users.Tech);
        var jelena = await api.ClientForAsync(Users.Jelena);
        await tech.PatchJsonAsync($"/api/tickets/{ticket.Id}/status", new ChangeStatusRequest(TicketStatus.InProgress));
        await tech.PatchJsonAsync($"/api/tickets/{ticket.Id}/status", new ChangeStatusRequest(TicketStatus.WaitingOnUser));

        await jelena.PostJsonAsync($"/api/tickets/{ticket.Id}/comments", new AddCommentRequest("Restarted, still offline.", IsInternal: false));

        var after = await (await tech.GetAsync($"/api/tickets/{ticket.Id}")).ReadAsync<TicketDetails>();
        after.Status.ShouldBe(TicketStatus.InProgress);
    }

    [Fact]
    public async Task Ticket_can_be_found_by_its_key()
    {
        var ticket = await CreateAsJelenaAsync();
        var tech = await api.ClientForAsync(Users.Tech);

        var result = await (await tech.GetAsync($"/api/tickets?search={ticket.Key.ToLowerInvariant()}")).ReadAsync<PagedResult<TicketListItem>>();

        result.Items.ShouldHaveSingleItem().Id.ShouldBe(ticket.Id);
    }

    [Fact]
    public async Task Changing_priority_recalculates_the_deadline()
    {
        var ticket = await CreateAsJelenaAsync(TicketPriority.Low);
        var tech = await api.ClientForAsync(Users.Tech);

        var updated = await (await tech.PatchJsonAsync($"/api/tickets/{ticket.Id}/priority", new ChangePriorityRequest(TicketPriority.Critical)))
            .ReadAsync<TicketDetails>();

        updated.DueAt.ShouldBe(ticket.CreatedAt.AddHours(4));
        updated.Events.ShouldContain(e => e.Type == TicketEventType.PriorityChanged && e.FromValue == "Low" && e.ToValue == "Critical");
    }
}
