public enum UserRole { User, Admin }

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Email { get; set; } = "";
    public UserRole Role { get; set; } = UserRole.User;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Session> Sessions { get; set; } = [];
    public ICollection<Board> Boards { get; set; } = [];
}
