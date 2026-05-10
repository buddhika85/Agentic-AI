public static class BoardEndpoints
{
    public static void Map(WebApplication app)
    {
        var group = app.MapGroup("/api/boards")
            .WithTags("Boards")
            .AddEndpointFilter<TokenAuthFilter>();

        // List all boards for the authenticated user
        group.MapGet("/", async (HttpContext ctx, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            var list = await boards.GetBoardsAsync(user.Id);
            return Results.Ok(list);
        })
        .WithName("ListBoards");

        // Create a new board
        group.MapPost("/", async (HttpContext ctx, CreateBoardRequest req, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            if (string.IsNullOrWhiteSpace(req.Name))
                return Results.BadRequest(new { error = "Board name is required" });

            var board = await boards.CreateBoardAsync(user.Id, req.Name.Trim());
            return Results.Created($"/api/boards/{board.Id}", board);
        })
        .WithName("CreateBoard");

        // Get a specific board
        group.MapGet("/{id:int}", async (HttpContext ctx, int id, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            try
            {
                var board = await boards.GetBoardAsync(user.Id, id);
                return Results.Ok(board);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        })
        .WithName("GetBoard");

        // Save (update) a specific board
        group.MapPost("/{id:int}", async (HttpContext ctx, int id, SaveBoardRequest req, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            try
            {
                var saved = await boards.SaveBoardAsync(user.Id, id, req.Board);
                return Results.Ok(saved);
            }
            catch (KeyNotFoundException)
            {
                return Results.NotFound();
            }
        })
        .WithName("SaveBoard");

        // Delete a board
        group.MapDelete("/{id:int}", async (HttpContext ctx, int id, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            var deleted = await boards.DeleteBoardAsync(user.Id, id);
            return deleted ? Results.NoContent() : Results.NotFound();
        })
        .WithName("DeleteBoard");

        // Legacy: get the user's first/default board (kept for backward compat)
        app.MapGet("/api/board", async (HttpContext ctx, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            var board = await boards.GetBoardAsync(user.Id);
            return Results.Ok(board);
        })
        .WithTags("Boards")
        .WithName("GetDefaultBoard")
        .AddEndpointFilter<TokenAuthFilter>();

        app.MapPost("/api/board", async (HttpContext ctx, SaveBoardRequest req, BoardService boards) =>
        {
            var user = (User)ctx.Items["User"]!;
            var saved = await boards.SaveBoardAsync(user.Id, req.Board);
            return Results.Ok(saved);
        })
        .WithTags("Boards")
        .WithName("SaveDefaultBoard")
        .AddEndpointFilter<TokenAuthFilter>();
    }
}
