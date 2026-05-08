using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.MsSql;
using Xunit;

public class BoardEndpointTests : IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder().Build();
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;
    private string _token = null!;
    private string _boardId = null!;

    // Captured before any test runs — verifies seeding without ordering dependency
    private int _seedColumnCount;

    public async Task InitializeAsync()
    {
        await _db.StartAsync();
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(host =>
                host.ConfigureAppConfiguration((_, cfg) =>
                    cfg.AddInMemoryCollection(new Dictionary<string, string?> {
                        ["ConnectionStrings:Default"] = _db.GetConnectionString(),
                        ["OPENROUTER_API_KEY"] = "test-key"
                    })));
        _client = _factory.CreateClient();

        var loginRes = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "user", password = "password" });
        _token = (await loginRes.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("token").GetString()!;

        // First GET triggers board seeding — capture count before any test modifies it
        var boardRes = await _client.SendAsync(AuthGet("/api/board"));
        var board = await boardRes.Content.ReadFromJsonAsync<JsonElement>();
        _boardId = board.GetProperty("id").GetString()!;
        _seedColumnCount = board.GetProperty("columns").GetArrayLength();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _db.DisposeAsync();
    }

    // ── Board seeding ────────────────────────────────────────────────────────

    [Fact]
    public void GetBoard_NewUser_SeedsThreeDefaultColumns() =>
        Assert.Equal(3, _seedColumnCount);

    // ── Auth guard ───────────────────────────────────────────────────────────

    [Fact]
    public async Task GetBoard_WithoutToken_Returns401()
    {
        var res = await _client.GetAsync("/api/board");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── Name update ──────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveBoard_UpdatesName_Persists()
    {
        var board = await ResetBoard();
        var columns = board.GetProperty("columns");

        await _client.SendAsync(await AuthPost("/api/board", new
        {
            board = new
            {
                id = _boardId,
                name = "Renamed Board",
                columns = BuildColumnsPayload(columns)
            }
        }));

        var refreshed = await (await _client.SendAsync(AuthGet("/api/board")))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Renamed Board", refreshed.GetProperty("name").GetString());
    }

    // ── Column cap ───────────────────────────────────────────────────────────

    [Fact]
    public async Task SaveBoard_SixColumns_TruncatesToFive()
    {
        var sixCols = Enumerable.Range(0, 6).Select(i => new
        {
            id = "0",
            title = $"Col {i}",
            position = i,
            cards = Array.Empty<object>()
        }).ToArray();

        var res = await _client.SendAsync(await AuthPost("/api/board", new
        {
            board = new { id = _boardId, name = "My Board", columns = sixCols }
        }));

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var saved = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(5, saved.GetProperty("columns").GetArrayLength());
    }

    // ── Card persistence ─────────────────────────────────────────────────────

    [Fact]
    public async Task SaveBoard_NewCard_AppearsOnNextGet()
    {
        var board = await ResetBoard();
        var columns = board.GetProperty("columns");
        var firstColId = columns[0].GetProperty("id").GetString()!;
        var firstColTitle = columns[0].GetProperty("title").GetString()!;

        // Build payload: first column gets a new card, others stay empty
        var updatedColumns = new object[]
        {
            new
            {
                id = firstColId,
                title = firstColTitle,
                position = 0,
                cards = new[]
                {
                    new { id = "0", title = "New Card", details = "Card details", position = 0 }
                }
            }
        };
        // Append remaining columns as-is
        var rest = Enumerable.Range(1, columns.GetArrayLength() - 1).Select(i =>
            (object)new
            {
                id = columns[i].GetProperty("id").GetString()!,
                title = columns[i].GetProperty("title").GetString()!,
                position = i,
                cards = Array.Empty<object>()
            }).ToArray();

        await _client.SendAsync(await AuthPost("/api/board", new
        {
            board = new
            {
                id = _boardId,
                name = "My Board",
                columns = updatedColumns.Concat(rest).ToArray()
            }
        }));

        var refreshed = await (await _client.SendAsync(AuthGet("/api/board")))
            .Content.ReadFromJsonAsync<JsonElement>();

        var refreshedCols = refreshed.GetProperty("columns");
        var targetCol = Enumerable.Range(0, refreshedCols.GetArrayLength())
            .Select(i => refreshedCols[i])
            .First(c => c.GetProperty("id").GetString() == firstColId
                     || c.GetProperty("title").GetString() == firstColTitle);

        var cards = targetCol.GetProperty("cards");
        Assert.True(cards.GetArrayLength() >= 1);
        var titles = Enumerable.Range(0, cards.GetArrayLength())
            .Select(i => cards[i].GetProperty("title").GetString());
        Assert.Contains("New Card", titles);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private HttpRequestMessage AuthGet(string path)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Add("Authorization", $"Bearer {_token}");
        return req;
    }

    private async Task<HttpRequestMessage> AuthPost(string path, object body)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, path);
        req.Headers.Add("Authorization", $"Bearer {_token}");
        req.Content = JsonContent.Create(body);
        return await Task.FromResult(req);
    }

    // Resets board to 3 clean columns (no cards) and returns the fresh board state.
    private async Task<JsonElement> ResetBoard()
    {
        await _client.SendAsync(await AuthPost("/api/board", new
        {
            board = new
            {
                id = _boardId,
                name = "My Board",
                columns = new[]
                {
                    new { id = "0", title = "To Do",       position = 0, cards = Array.Empty<object>() },
                    new { id = "0", title = "In Progress", position = 1, cards = Array.Empty<object>() },
                    new { id = "0", title = "Done",        position = 2, cards = Array.Empty<object>() }
                }
            }
        }));

        var res = await _client.SendAsync(AuthGet("/api/board"));
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    // Converts a JsonElement columns array into a plain object array for round-trip saves.
    private static object[] BuildColumnsPayload(JsonElement columns) =>
        Enumerable.Range(0, columns.GetArrayLength()).Select(i =>
        {
            var col = columns[i];
            var cards = col.GetProperty("cards");
            return (object)new
            {
                id = col.GetProperty("id").GetString()!,
                title = col.GetProperty("title").GetString()!,
                position = col.GetProperty("position").GetInt32(),
                cards = Enumerable.Range(0, cards.GetArrayLength()).Select(j =>
                {
                    var card = cards[j];
                    return (object)new
                    {
                        id = card.GetProperty("id").GetString()!,
                        title = card.GetProperty("title").GetString()!,
                        details = card.GetProperty("details").GetString()!,
                        position = card.GetProperty("position").GetInt32()
                    };
                }).ToArray()
            };
        }).ToArray();
}
