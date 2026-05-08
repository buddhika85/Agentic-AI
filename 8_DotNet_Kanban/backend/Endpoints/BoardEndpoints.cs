public static class BoardEndpoints
{
    public static void Map(WebApplication app)
    {
        var group = app.MapGroup("/api/board")
            .WithTags("Board")
            .AddEndpointFilter<TokenAuthFilter>();

        group.MapGet("/", async (HttpContext ctx, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            var board = await boards.GetBoardAsync(user.Id);
            return Results.Ok(board);
        })
        .WithName("GetBoard");

        group.MapPost("/", async (HttpContext ctx, SaveBoardRequest req, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            var saved = await boards.SaveBoardAsync(user.Id, req.Board);
            return Results.Ok(saved);
        })
        .WithName("SaveBoard");
    }
}
