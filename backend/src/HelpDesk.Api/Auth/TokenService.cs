using System.Security.Claims;
using System.Text;
using HelpDesk.Api.Domain;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace HelpDesk.Api.Auth;

public static class AuthConstants
{
    public const string RoleClaim = "role";
    public const string NameClaim = "name";

    public const string StaffPolicy = "Staff";
    public const string AdminPolicy = "Admin";
}

public class JwtOptions
{
    public const string Section = "Jwt";

    public string Issuer { get; set; } = "HelpDesk";
    public string Audience { get; set; } = "HelpDesk";

    // At least 32 characters. Comes from configuration / environment, never from source control in production.
    public string SigningKey { get; set; } = "";
    public int LifetimeMinutes { get; set; } = 480;

    public SymmetricSecurityKey Key => new(Encoding.UTF8.GetBytes(SigningKey));
}

public class TokenService(IOptions<JwtOptions> options, TimeProvider clock)
{
    private readonly JwtOptions _jwt = options.Value;

    public (string Token, DateTimeOffset ExpiresAt) CreateToken(User user)
    {
        var now = clock.GetUtcNow();
        var expires = now.AddMinutes(_jwt.LifetimeMinutes);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _jwt.Issuer,
            Audience = _jwt.Audience,
            IssuedAt = now.UtcDateTime,
            NotBefore = now.UtcDateTime,
            Expires = expires.UtcDateTime,
            SigningCredentials = new SigningCredentials(_jwt.Key, SecurityAlgorithms.HmacSha256),
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(AuthConstants.NameClaim, user.FullName),
                new Claim(AuthConstants.RoleClaim, user.Role.ToString())
            ])
        };

        return (new JsonWebTokenHandler().CreateToken(descriptor), expires);
    }
}
