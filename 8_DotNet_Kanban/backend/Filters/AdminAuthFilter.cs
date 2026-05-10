public class AdminAuthFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var user = ctx.HttpContext.Items["User"] as User;
        if (user?.Role != UserRole.Admin)
            return Results.StatusCode(403);

        return await next(ctx);
    }
}
