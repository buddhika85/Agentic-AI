public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token);
public record RegisterRequest(string Username, string Password, string? Email);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public record UpdateProfileRequest(string? Email);
public record UserDto(int Id, string Username, string Email, string Role, DateTime CreatedAt);
public record UserSummaryDto(int Id, string Username);
public record AdminResetPasswordRequest(string NewPassword);
