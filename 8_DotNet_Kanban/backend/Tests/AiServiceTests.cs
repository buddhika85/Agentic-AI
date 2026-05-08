using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Xunit;

public class AiServiceTests
{
    // ── Infrastructure ───────────────────────────────────────────────────────

    // Wraps a pre-built response so AiService gets a controllable HTTP client.
    private sealed class FakeHandler(HttpResponseMessage response) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(response);
    }

    private sealed class StubFactory(HttpClient client) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => client;
    }

    // Builds the JSON envelope that OpenRouter returns around the AI content string.
    private static AiService MakeService(string aiContent,
        HttpStatusCode status = HttpStatusCode.OK)
    {
        HttpResponseMessage httpResponse;

        if (status == HttpStatusCode.OK)
        {
            var envelope = JsonSerializer.Serialize(new
            {
                choices = new[]
                {
                    new { message = new { content = aiContent } }
                }
            });
            httpResponse = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(envelope, Encoding.UTF8, "application/json")
            };
        }
        else
        {
            httpResponse = new HttpResponseMessage(status)
            {
                Content = new StringContent("error body", Encoding.UTF8, "text/plain")
            };
        }

        var client = new HttpClient(new FakeHandler(httpResponse))
        {
            BaseAddress = new Uri("https://openrouter.ai/api/v1/")
        };
        return new AiService(new StubFactory(client));
    }

    private static readonly BoardDto EmptyBoard = new("1", "Test Board", []);

    // ── Tests ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ChatAsync_ValidJsonWithNullUpdate_ReturnsMessageAndNullBoard()
    {
        var service = MakeService("""{"message":"Hello!","board_update":null}""");

        var result = await service.ChatAsync("hi", EmptyBoard);

        Assert.Equal("Hello!", result.Message);
        Assert.Null(result.BoardUpdate);
    }

    [Fact]
    public async Task ChatAsync_ValidJsonWithBoardUpdate_DeserializesBoardUpdate()
    {
        // ParseAiResponse uses default JsonSerializer.Deserialize (case-sensitive PascalCase),
        // which matches the PascalCase JSON that BuildSystemPrompt sends to the AI.
        var aiContent = """
            {
              "message": "Board updated!",
              "board_update": {
                "Id": "1",
                "Name": "Updated Board",
                "Columns": [
                  { "Id": "10", "Title": "Backlog", "Position": 0, "Cards": [] }
                ]
              }
            }
            """;
        var service = MakeService(aiContent);

        var result = await service.ChatAsync("add a backlog column", EmptyBoard);

        Assert.Equal("Board updated!", result.Message);
        Assert.NotNull(result.BoardUpdate);
        Assert.Equal("Updated Board", result.BoardUpdate!.Name);
        Assert.Single(result.BoardUpdate.Columns);
        Assert.Equal("Backlog", result.BoardUpdate.Columns[0].Title);
    }

    [Fact]
    public async Task ChatAsync_MarkdownFencedContent_StripsFencesAndParses()
    {
        var fenced = "```json\n{\"message\":\"Fenced response\",\"board_update\":null}\n```";
        var service = MakeService(fenced);

        var result = await service.ChatAsync("hi", EmptyBoard);

        Assert.Equal("Fenced response", result.Message);
        Assert.Null(result.BoardUpdate);
    }

    [Fact]
    public async Task ChatAsync_NonJsonContent_ReturnsFallbackMessage()
    {
        var plainText = "Sorry, I cannot help with that right now.";
        var service = MakeService(plainText);

        var result = await service.ChatAsync("hi", EmptyBoard);

        Assert.Equal(plainText, result.Message);
        Assert.Null(result.BoardUpdate);
    }

    [Fact]
    public async Task ChatAsync_HttpErrorResponse_ThrowsHttpRequestException()
    {
        var service = MakeService("", HttpStatusCode.TooManyRequests);

        var ex = await Assert.ThrowsAsync<HttpRequestException>(
            () => service.ChatAsync("hi", EmptyBoard));

        Assert.Equal(HttpStatusCode.TooManyRequests, ex.StatusCode);
    }
}
