using HelpDesk.Api.Contracts;
using HelpDesk.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HelpDesk.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IUserService users) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    public Task<LoginResponse> Login(LoginRequest request, CancellationToken ct) => users.LoginAsync(request, ct);

    [Authorize]
    [HttpGet("me")]
    public Task<UserDto> Me(CancellationToken ct) => users.GetCurrentAsync(ct);
}
