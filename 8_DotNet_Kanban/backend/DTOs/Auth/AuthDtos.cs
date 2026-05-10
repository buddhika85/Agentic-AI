public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token);
public record RegisterRequest(string Username, string Password, string Email);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record UserDto(int Id, string Username, string Email, string Role, DateTime CreatedAt);
public record AdminResetPasswordRequest(string NewPassword);
