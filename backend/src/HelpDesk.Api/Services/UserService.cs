using HelpDesk.Api.Auth;
using HelpDesk.Api.Common;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Data;
using HelpDesk.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HelpDesk.Api.Services;

public interface IUserService
{
    Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<UserDto> GetCurrentAsync(CancellationToken ct);
    Task<IReadOnlyList<UserDto>> ListAsync(UserRole? role, CancellationToken ct);
    Task<IReadOnlyList<UserSummary>> ListAssignableAsync(CancellationToken ct);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct);
    Task<UserDto> UpdateAsync(int id, UpdateUserRequest request, CancellationToken ct);
}

public class InvalidCredentialsException()
    : AppException("Wrong email or password.", StatusCodes.Status401Unauthorized, "Sign-in failed");

public class UserService(
    AppDbContext db,
    ICurrentUser me,
    TokenService tokens,
    IPasswordHasher<User> hasher,
    TimeProvider clock) : IUserService
{
    public async Task<LoginResponse> LoginAsync(LoginRequest r, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == r.Email.Trim(), ct);

        // Same error for "no such user" and "wrong password", so the API doesn't reveal which emails exist.
        if (user is null || !user.IsActive)
            throw new InvalidCredentialsException();

        var check = hasher.VerifyHashedPassword(user, user.PasswordHash, r.Password);
        if (check == PasswordVerificationResult.Failed)
            throw new InvalidCredentialsException();

        if (check == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, r.Password);
            await db.SaveChangesAsync(ct);
        }

        var (token, expiresAt) = tokens.CreateToken(user);
        return new LoginResponse(token, expiresAt, ToDto(user));
    }

    public async Task<UserDto> GetCurrentAsync(CancellationToken ct) =>
        ToDto(await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == me.Id, ct)
              ?? throw new NotFoundException("User", me.Id));

    public async Task<IReadOnlyList<UserDto>> ListAsync(UserRole? role, CancellationToken ct)
    {
        var users = db.Users.AsNoTracking();
        if (role is { } r) users = users.Where(u => u.Role == r);
        return await users.OrderBy(u => u.FullName)
            .Select(u => new UserDto(u.Id, u.FullName, u.Email, u.Role, u.Department, u.IsActive))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<UserSummary>> ListAssignableAsync(CancellationToken ct) =>
        await db.Users.AsNoTracking()
            .Where(u => u.IsActive && u.Role != UserRole.Employee)
            .OrderBy(u => u.FullName)
            .Select(u => new UserSummary(u.Id, u.FullName))
            .ToListAsync(ct);

    public async Task<UserDto> CreateAsync(CreateUserRequest r, CancellationToken ct)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
            throw new ConflictException($"A user with email {email} already exists.");

        var user = new User
        {
            FullName = r.FullName.Trim(),
            Email = email,
            Role = r.Role,
            Department = r.Department?.Trim(),
            CreatedAt = clock.GetUtcNow()
        };
        user.PasswordHash = hasher.HashPassword(user, r.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    public async Task<UserDto> UpdateAsync(int id, UpdateUserRequest r, CancellationToken ct)
    {
        var user = await db.Users.FindAsync([id], ct) ?? throw new NotFoundException("User", id);

        if (user.Id == me.Id && (r.Role != UserRole.Admin || !r.IsActive))
            throw new BusinessRuleException("You can't remove your own admin access.");

        user.FullName = r.FullName.Trim();
        user.Role = r.Role;
        user.Department = r.Department?.Trim();
        user.IsActive = r.IsActive;

        await db.SaveChangesAsync(ct);
        return ToDto(user);
    }

    private static UserDto ToDto(User u) => new(u.Id, u.FullName, u.Email, u.Role, u.Department, u.IsActive);
}
