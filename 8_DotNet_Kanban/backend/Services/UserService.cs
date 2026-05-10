using Microsoft.EntityFrameworkCore;

public class UserService(AppDbContext db)
{
    public async Task<(bool Success, string? Error)> RegisterAsync(string username, string password, string email)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
            return (false, "Username must be at least 3 characters");

        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
            return (false, "Password must be at least 6 characters");

        if (await db.Users.AnyAsync(u => u.Username == username))
            return (false, "Username already taken");

        if (!string.IsNullOrWhiteSpace(email) && await db.Users.AnyAsync(u => u.Email == email))
            return (false, "Email already registered");

        db.Users.Add(new User
        {
            Username = username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Email = email ?? "",
            Role = UserRole.User,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<List<UserDto>> GetAllUsersAsync()
    {
        return await db.Users
            .OrderBy(u => u.Username)
            .Select(u => new UserDto(u.Id, u.Username, u.Email, u.Role.ToString(), u.CreatedAt))
            .ToListAsync();
    }

    public async Task<UserDto?> GetUserAsync(int id)
    {
        var u = await db.Users.FindAsync(id);
        return u is null ? null : new UserDto(u.Id, u.Username, u.Email, u.Role.ToString(), u.CreatedAt);
    }

    public async Task<bool> DeleteUserAsync(int id)
    {
        var user = await db.Users.FindAsync(id);
        if (user is null) return false;

        // Clear card assignments before deleting (avoids FK constraint violation)
        await db.Cards
            .Where(c => c.AssignedToUserId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.AssignedToUserId, (int?)null));

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ChangePasswordAsync(int userId, string currentPassword, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            return false;

        var user = await db.Users.FindAsync(userId);
        if (user is null || !BCrypt.Net.BCrypt.Verify(currentPassword, user.PasswordHash))
            return false;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> AdminResetPasswordAsync(int targetUserId, string newPassword)
    {
        if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 6)
            return false;

        var user = await db.Users.FindAsync(targetUserId);
        if (user is null) return false;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetRoleAsync(int targetUserId, UserRole role)
    {
        var user = await db.Users.FindAsync(targetUserId);
        if (user is null) return false;

        user.Role = role;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<UserSummaryDto>> GetUserSummariesAsync()
    {
        return await db.Users
            .OrderBy(u => u.Username)
            .Select(u => new UserSummaryDto(u.Id, u.Username))
            .ToListAsync();
    }

    public async Task<bool> UpdateProfileAsync(int userId, string? email)
    {
        var user = await db.Users.FindAsync(userId);
        if (user is null) return false;

        if (!string.IsNullOrWhiteSpace(email))
        {
            if (await db.Users.AnyAsync(u => u.Email == email && u.Id != userId))
                return false;
            user.Email = email;
        }

        await db.SaveChangesAsync();
        return true;
    }
}
