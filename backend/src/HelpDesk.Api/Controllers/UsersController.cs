using HelpDesk.Api.Auth;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Domain;
using HelpDesk.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HelpDesk.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthConstants.StaffPolicy)]
[Route("api/users")]
public class UsersController(IUserService users) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<UserDto>> List([FromQuery] UserRole? role, CancellationToken ct) => users.ListAsync(role, ct);

    // People a ticket can be assigned to (active technicians and admins).
    [HttpGet("assignable")]
    public Task<IReadOnlyList<UserSummary>> Assignable(CancellationToken ct) => users.ListAssignableAsync(ct);

    [Authorize(Policy = AuthConstants.AdminPolicy)]
    [HttpPost]
    public async Task<ActionResult<UserDto>> Create(CreateUserRequest request, CancellationToken ct)
    {
        var created = await users.CreateAsync(request, ct);
        return Created($"/api/users/{created.Id}", created);
    }

    [Authorize(Policy = AuthConstants.AdminPolicy)]
    [HttpPut("{id:int}")]
    public Task<UserDto> Update(int id, UpdateUserRequest request, CancellationToken ct) => users.UpdateAsync(id, request, ct);
}
