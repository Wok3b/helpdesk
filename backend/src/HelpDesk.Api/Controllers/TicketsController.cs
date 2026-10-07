using HelpDesk.Api.Auth;
using HelpDesk.Api.Common;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HelpDesk.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/tickets")]
public class TicketsController(ITicketService tickets) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<TicketListItem>> List([FromQuery] TicketQuery query, CancellationToken ct) =>
        tickets.ListAsync(query, ct);

    [HttpGet("{id:int}")]
    public Task<TicketDetails> Get(int id, CancellationToken ct) => tickets.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<TicketDetails>> Create(CreateTicketRequest request, CancellationToken ct)
    {
        var created = await tickets.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPatch("{id:int}/status")]
    public Task<TicketDetails> ChangeStatus(int id, ChangeStatusRequest request, CancellationToken ct) =>
        tickets.ChangeStatusAsync(id, request.Status!.Value, ct);

    [Authorize(Policy = AuthConstants.StaffPolicy)]
    [HttpPatch("{id:int}/assignee")]
    public Task<TicketDetails> Assign(int id, AssignTicketRequest request, CancellationToken ct) =>
        tickets.AssignAsync(id, request.AssigneeId, ct);

    [Authorize(Policy = AuthConstants.StaffPolicy)]
    [HttpPatch("{id:int}/priority")]
    public Task<TicketDetails> ChangePriority(int id, ChangePriorityRequest request, CancellationToken ct) =>
        tickets.ChangePriorityAsync(id, request.Priority!.Value, ct);

    [HttpPost("{id:int}/comments")]
    public async Task<ActionResult<CommentDto>> AddComment(int id, AddCommentRequest request, CancellationToken ct)
    {
        var comment = await tickets.AddCommentAsync(id, request, ct);
        return CreatedAtAction(nameof(Get), new { id }, comment);
    }
}
