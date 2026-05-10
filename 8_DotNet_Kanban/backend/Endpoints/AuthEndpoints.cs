public static class AuthEndpoints
{
    public static void Map(WebApplication app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/login", async (LoginRequest req, AuthService auth) =>
        {
            var token = await auth.LoginAsync(req.Username, req.Password);
            return token is null ? Results.Unauthorized() : Results.Ok(new LoginResponse(token));
        })
        .WithName("Login")
        .AllowAnonymous();

        group.MapPost("/logout", async (HttpContext ctx, AuthService auth) =>
        {
            var token = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "").Trim();
            await auth.LogoutAsync(token);
            return Results.Ok();
        })
        .WithName("Logout")
        .AddEndpointFilter<TokenAuthFilter>();

        group.MapGet("/verify", (HttpContext ctx) =>
        {
            var user = (User)ctx.Items["User"]!;
            return Results.Ok(new { user.Username, user.Email, Role = user.Role.ToString(), user.Id });
        })
        .WithName("VerifyToken")
        .AddEndpointFilter<TokenAuthFilter>();
    }
}
