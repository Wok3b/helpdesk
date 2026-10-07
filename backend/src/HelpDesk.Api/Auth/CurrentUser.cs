using HelpDesk.Api.Domain;
using Microsoft.IdentityModel.JsonWebTokens;

namespace HelpDesk.Api.Auth;

public interface ICurrentUser
{
    int Id { get; }
    UserRole Role { get; }
    bool IsStaff { get; }
}

// Reads the signed-in user from the JWT claims of the current request.
public class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private HttpContext Context => accessor.HttpContext ?? throw new InvalidOperationException("No active HTTP request.");

    public int Id => int.Parse(Context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value
                               ?? throw new UnauthorizedAccessException("Missing user id claim."));

    public UserRole Role => Enum.Parse<UserRole>(Context.User.FindFirst(AuthConstants.RoleClaim)?.Value
                                                ?? throw new UnauthorizedAccessException("Missing role claim."));

    public bool IsStaff => Role is UserRole.Technician or UserRole.Admin;
}
