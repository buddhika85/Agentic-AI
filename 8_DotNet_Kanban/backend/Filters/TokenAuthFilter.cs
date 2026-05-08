public class TokenAuthFilter(AuthService auth) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var token = ctx.HttpContext.Request.Headers.Authorization
            .ToString().Replace("Bearer ", "").Trim();

        var user = await auth.ValidateTokenAsync(token);
        if (user is null) return Results.Unauthorized();

        ctx.HttpContext.Items["User"] = user;
        return await next(ctx);
    }
}
