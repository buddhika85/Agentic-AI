public static class UserEndpoints
{
    public static void Map(WebApplication app)
    {
        // ── Auth endpoints ───────────────────────────────────────────────────

        var auth = app.MapGroup("/api/auth").WithTags("Auth");

        auth.MapPost("/register", async (RegisterRequest req, UserService users, AuthService authSvc) =>
        {
            var (success, error) = await users.RegisterAsync(req.Username, req.Password, req.Email ?? "");
            if (!success)
                return Results.BadRequest(new { error });

            var token = await authSvc.LoginAsync(req.Username, req.Password);
            return Results.Ok(new LoginResponse(token!));
        })
        .WithName("Register")
        .AllowAnonymous();

        auth.MapPost("/change-password",
            async (HttpContext ctx, ChangePasswordRequest req, UserService users) =>
        {
            var user = (User)ctx.Items["User"]!;
            var ok = await users.ChangePasswordAsync(user.Id, req.CurrentPassword, req.NewPassword);
            return ok ? Results.Ok() : Results.BadRequest(new { error = "Current password is incorrect or new password is too short" });
        })
        .WithName("ChangePassword")
        .AddEndpointFilter<TokenAuthFilter>();

        // ── Admin: user management ───────────────────────────────────────────

        var admin = app.MapGroup("/api/admin/users")
            .WithTags("Admin")
            .AddEndpointFilter<TokenAuthFilter>()
            .AddEndpointFilter<AdminAuthFilter>();

        admin.MapGet("/", async (UserService users) =>
        {
            var list = await users.GetAllUsersAsync();
            return Results.Ok(list);
        })
        .WithName("ListUsers");

        admin.MapGet("/{id:int}", async (int id, UserService users) =>
        {
            var user = await users.GetUserAsync(id);
            return user is null ? Results.NotFound() : Results.Ok(user);
        })
        .WithName("GetUser");

        admin.MapDelete("/{id:int}", async (HttpContext ctx, int id, UserService users) =>
        {
            var requestingUser = (User)ctx.Items["User"]!;
            if (requestingUser.Id == id)
                return Results.BadRequest(new { error = "Cannot delete your own account" });

            var deleted = await users.DeleteUserAsync(id);
            return deleted ? Results.NoContent() : Results.NotFound();
        })
        .WithName("DeleteUser");

        admin.MapPost("/{id:int}/reset-password",
            async (int id, AdminResetPasswordRequest req, UserService users) =>
        {
            var ok = await users.AdminResetPasswordAsync(id, req.NewPassword);
            return ok ? Results.Ok() : Results.BadRequest(new { error = "User not found or invalid password" });
        })
        .WithName("AdminResetPassword");

        admin.MapPost("/{id:int}/role",
            async (int id, SetRoleRequest req, UserService users) =>
        {
            if (!Enum.TryParse<UserRole>(req.Role, true, out var role))
                return Results.BadRequest(new { error = "Invalid role. Use 'User' or 'Admin'" });

            var ok = await users.SetRoleAsync(id, role);
            return ok ? Results.Ok() : Results.NotFound();
        })
        .WithName("SetUserRole");
    }
}

public record SetRoleRequest(string Role);
