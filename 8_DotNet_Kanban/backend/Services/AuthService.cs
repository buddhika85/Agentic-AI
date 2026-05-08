using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

public class AuthService(AppDbContext db)
{
    public async Task<string?> LoginAsync(string username, string password)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;

        var expired = db.Sessions.Where(s => s.ExpiresAt < DateTime.UtcNow);
        db.Sessions.RemoveRange(expired);

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLower();
        db.Sessions.Add(new Session
        {
            Token = token,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddHours(8)
        });
        await db.SaveChangesAsync();
        return token;
    }

    public async Task<User?> ValidateTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return null;

        var session = await db.Sessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.Token == token && s.ExpiresAt > DateTime.UtcNow);

        return session?.User;
    }

    public async Task LogoutAsync(string token)
    {
        var session = await db.Sessions.FindAsync(token);
        if (session is not null)
        {
            db.Sessions.Remove(session);
            await db.SaveChangesAsync();
        }
    }
}
