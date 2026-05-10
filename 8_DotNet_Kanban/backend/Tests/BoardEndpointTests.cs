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

        // First GET triggers board seeding
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

        var updatedColumns = new object[]
        {
            new
            {
                id = firstColId,
                title = firstColTitle,
                position = 0,
                cards = new[]
                {
                    new
                    {
                        id = "0", title = "New Card", details = "Card details", position = 0,
                        priority = "High", label = "bug", dueDate = (DateTime?)null
                    }
                }
            }
        };
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
        var card = cards[0];
        Assert.Equal("New Card", card.GetProperty("title").GetString());
        Assert.Equal("High", card.GetProperty("priority").GetString());
        Assert.Equal("bug", card.GetProperty("label").GetString());
    }

    // ── Multi-board: list boards ──────────────────────────────────────────────

    [Fact]
    public async Task ListBoards_ReturnsAtLeastOneBoard()
    {
        // Ensure default board is seeded by hitting /api/board
        await _client.SendAsync(AuthGet("/api/board"));

        var res = await _client.SendAsync(AuthGet("/api/boards"));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var boards = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(boards.GetArrayLength() >= 1);
    }

    // ── Multi-board: create board ─────────────────────────────────────────────

    [Fact]
    public async Task CreateBoard_ReturnsNewBoardWithThreeColumns()
    {
        var res = await _client.SendAsync(await AuthPost("/api/boards",
            new { name = "Sprint Board" }));

        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        var board = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Sprint Board", board.GetProperty("name").GetString());
        Assert.Equal(3, board.GetProperty("columns").GetArrayLength());
    }

    // ── Multi-board: get specific board ──────────────────────────────────────

    [Fact]
    public async Task GetSpecificBoard_ValidId_ReturnsBoard()
    {
        // Create a board first
        var createRes = await _client.SendAsync(await AuthPost("/api/boards",
            new { name = "Project Alpha" }));
        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var newId = created.GetProperty("id").GetString()!;

        var res = await _client.SendAsync(AuthGet($"/api/boards/{newId}"));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var board = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Project Alpha", board.GetProperty("name").GetString());
    }

    // ── Multi-board: get non-existent board ───────────────────────────────────

    [Fact]
    public async Task GetSpecificBoard_WrongUser_Returns404()
    {
        var res = await _client.SendAsync(AuthGet("/api/boards/99999"));
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ── Multi-board: delete board ─────────────────────────────────────────────

    [Fact]
    public async Task DeleteBoard_ValidId_Returns204()
    {
        var createRes = await _client.SendAsync(await AuthPost("/api/boards",
            new { name = "Temp Board" }));
        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var newId = created.GetProperty("id").GetString()!;

        var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/boards/{newId}");
        req.Headers.Add("Authorization", $"Bearer {_token}");
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        // Should return 404 now
        var getRes = await _client.SendAsync(AuthGet($"/api/boards/{newId}"));
        Assert.Equal(HttpStatusCode.NotFound, getRes.StatusCode);
    }

    // ── Multi-board: save specific board ─────────────────────────────────────

    [Fact]
    public async Task SaveSpecificBoard_UpdatesNameAndCards()
    {
        var createRes = await _client.SendAsync(await AuthPost("/api/boards",
            new { name = "Work Board" }));
        var created = await createRes.Content.ReadFromJsonAsync<JsonElement>();
        var newId = created.GetProperty("id").GetString()!;
        var cols = created.GetProperty("columns");
        var firstColId = cols[0].GetProperty("id").GetString()!;
        var firstColTitle = cols[0].GetProperty("title").GetString()!;

        object[] saveColumns =
        [
            new
            {
                id = firstColId,
                title = firstColTitle,
                position = 0,
                cards = new object[]
                {
                    new
                    {
                        id = "0", title = "Task A", details = "", position = 0,
                        priority = "Low", label = "", dueDate = (DateTime?)null
                    }
                }
            },
            new { id = cols[1].GetProperty("id").GetString()!, title = "In Progress", position = 1, cards = Array.Empty<object>() },
            new { id = cols[2].GetProperty("id").GetString()!, title = "Done", position = 2, cards = Array.Empty<object>() }
        ];

        var saveRes = await _client.SendAsync(await AuthPost($"/api/boards/{newId}", new
        {
            board = new
            {
                id = newId,
                name = "Work Board — Updated",
                columns = saveColumns
            }
        }));

        Assert.Equal(HttpStatusCode.OK, saveRes.StatusCode);
        var saved = await saveRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Work Board — Updated", saved.GetProperty("name").GetString());
        Assert.Equal(1, saved.GetProperty("columns")[0].GetProperty("cards").GetArrayLength());
    }

    // ── Create board: empty name returns 400 ─────────────────────────────────

    [Fact]
    public async Task CreateBoard_EmptyName_Returns400()
    {
        var res = await _client.SendAsync(await AuthPost("/api/boards",
            new { name = "" }));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
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
                        position = card.GetProperty("position").GetInt32(),
                        priority = card.TryGetProperty("priority", out var p) ? p.GetString()! : "Medium",
                        label = card.TryGetProperty("label", out var l) ? l.GetString()! : "",
                        dueDate = (DateTime?)null
                    };
                }).ToArray()
            };
        }).ToArray();
}
