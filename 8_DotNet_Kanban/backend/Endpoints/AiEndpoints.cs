public static class AiEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/ai/chat", async (HttpContext ctx, ChatRequest req, BoardService boards, AiService ai) =>
        {
            var user = (User)ctx.Items["User"]!;
            var board = await boards.GetBoardAsync(user.Id);

            ChatResponse response;
            try
            {
                response = await ai.ChatAsync(req.Message, board);
            }
            catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
            {
                return Results.Problem(
                    detail: "AI rate limit reached — wait a moment and try again.",
                    statusCode: 429);
            }
            catch (HttpRequestException ex)
            {
                return Results.Problem(
                    detail: $"AI service error: {ex.Message}",
                    statusCode: 502);
            }

            if (response.BoardUpdate is not null)
                await boards.SaveBoardAsync(user.Id, response.BoardUpdate);

            return Results.Ok(new { message = response.Message, board_update = response.BoardUpdate });
        })
        .WithName("AiChat")
        .WithTags("AI")
        .AddEndpointFilter<TokenAuthFilter>();
    }
}
