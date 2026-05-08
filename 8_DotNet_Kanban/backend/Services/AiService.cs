using System.Net.Http.Json;
using System.Text.Json;

public class AiService(IHttpClientFactory factory)
{
    private const string Model = "openai/gpt-oss-120b:free";

    public async Task<ChatResponse> ChatAsync(string userMessage, BoardDto currentBoard)
    {
        var client = factory.CreateClient("openrouter");
        var systemPrompt = BuildSystemPrompt(currentBoard);

        var body = new
        {
            model = Model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user",   content = userMessage }
            }
        };

        var response = await client.PostAsJsonAsync("chat/completions", body);

        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new HttpRequestException(
                $"OpenRouter returned {(int)response.StatusCode}: {error}",
                null,
                response.StatusCode);
        }

        var result = await response.Content.ReadFromJsonAsync<JsonDocument>()
            ?? throw new InvalidOperationException("Empty AI response");

        var raw = result.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "";

        return ParseAiResponse(raw);
    }

    private static string BuildSystemPrompt(BoardDto board)
    {
        var boardJson = JsonSerializer.Serialize(board);
        return $$"""
            You are a Kanban board assistant. The current board state is:
            {{boardJson}}

            Respond ONLY with valid JSON in this exact format:
            {
              "message": "<your reply to the user>",
              "board_update": <full updated board object, or null if no changes needed>
            }

            You can create, move, rename, or delete cards and columns.
            Always return the complete board state in board_update when making changes.
            Return null for board_update if no board changes are needed.
            """;
    }

    private static ChatResponse ParseAiResponse(string raw)
    {
        var json = raw.Trim();

        // Strip markdown code fences if present
        if (json.StartsWith("```"))
        {
            var lines = json.Split('\n');
            json = string.Join('\n', lines[1..^1]).Trim();
        }

        try
        {
            var doc = JsonDocument.Parse(json);
            var message = doc.RootElement.GetProperty("message").GetString() ?? raw;
            BoardDto? boardUpdate = null;

            if (doc.RootElement.TryGetProperty("board_update", out var bu)
                && bu.ValueKind != JsonValueKind.Null)
            {
                boardUpdate = JsonSerializer.Deserialize<BoardDto>(bu.GetRawText());
            }

            return new ChatResponse(message, boardUpdate);
        }
        catch
        {
            // Model didn't return valid JSON — surface response as plain message
            return new ChatResponse(raw, null);
        }
    }
}
