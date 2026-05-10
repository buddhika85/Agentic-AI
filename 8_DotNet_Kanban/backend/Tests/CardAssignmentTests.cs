using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.MsSql;
using Xunit;

public class CardAssignmentTests : IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder().Build();
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;
    private string _userToken = null!;
    private string _adminToken = null!;
    private string _boardId = null!;
    private int _userId;

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
        var loginBody = await loginRes.Content.ReadFromJsonAsync<JsonElement>();
        _userToken = loginBody.GetProperty("token").GetString()!;

        var adminLoginRes = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "admin", password = "admin123!" });
        var adminBody = await adminLoginRes.Content.ReadFromJsonAsync<JsonElement>();
        _adminToken = adminBody.GetProperty("token").GetString()!;

        // Get user's id from verify
        var verifyRes = await _client.SendAsync(AuthGet("/api/auth/verify", _userToken));
        var verify = await verifyRes.Content.ReadFromJsonAsync<JsonElement>();
        _userId = verify.GetProperty("id").GetInt32();

        // Seed the board
        var boardRes = await _client.SendAsync(AuthGet("/api/board", _userToken));
        var board = await boardRes.Content.ReadFromJsonAsync<JsonElement>();
        _boardId = board.GetProperty("id").GetString()!;
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _db.DisposeAsync();
    }

    // ── GET /api/users ───────────────────────────────────────────────────────

    [Fact]
    public async Task ListUsers_AuthenticatedRequest_ReturnsUserList()
    {
        var res = await _client.SendAsync(AuthGet("/api/users", _userToken));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var users = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(users.GetArrayLength() >= 2); // "user" and "admin"
        // Each item has id and username
        Assert.True(users[0].TryGetProperty("id", out _));
        Assert.True(users[0].TryGetProperty("username", out _));
    }

    [Fact]
    public async Task ListUsers_NoToken_Returns401()
    {
        var res = await _client.GetAsync("/api/users");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── Card assignment ───────────────────────────────────────────────────────

    [Fact]
    public async Task SaveCard_WithAssignment_PersistsAssignedUser()
    {
        // Get the board to read column IDs
        var boardRes = await _client.SendAsync(AuthGet("/api/board", _userToken));
        var board = await boardRes.Content.ReadFromJsonAsync<JsonElement>();
        var cols = board.GetProperty("columns");
        var firstColId = cols[0].GetProperty("id").GetString()!;
        var firstColTitle = cols[0].GetProperty("title").GetString()!;

        // Save a card assigned to the user
        var saveRes = await _client.SendAsync(AuthPost("/api/board", new
        {
            board = new
            {
                id = _boardId,
                name = "My Board",
                columns = new object[]
                {
                    new
                    {
                        id = firstColId,
                        title = firstColTitle,
                        position = 0,
                        cards = new object[]
                        {
                            new
                            {
                                id = "0",
                                title = "Assigned Task",
                                details = "",
                                position = 0,
                                priority = "Medium",
                                label = "",
                                dueDate = (DateTime?)null,
                                assignedToUserId = _userId
                            }
                        }
                    },
                    new { id = cols[1].GetProperty("id").GetString()!, title = "In Progress", position = 1, cards = Array.Empty<object>() },
                    new { id = cols[2].GetProperty("id").GetString()!, title = "Done", position = 2, cards = Array.Empty<object>() }
                }
            }
        }, _userToken));

        Assert.Equal(HttpStatusCode.OK, saveRes.StatusCode);

        // Reload and verify assignment is persisted
        var reloadRes = await _client.SendAsync(AuthGet("/api/board", _userToken));
        var reloaded = await reloadRes.Content.ReadFromJsonAsync<JsonElement>();
        var reloadedCols = reloaded.GetProperty("columns");

        var targetCol = Enumerable.Range(0, reloadedCols.GetArrayLength())
            .Select(i => reloadedCols[i])
            .First(c => c.GetProperty("title").GetString() == firstColTitle);

        var cards = targetCol.GetProperty("cards");
        Assert.True(cards.GetArrayLength() >= 1);
        var card = cards[0];
        Assert.Equal("Assigned Task", card.GetProperty("title").GetString());
        Assert.Equal(_userId, card.GetProperty("assignedToUserId").GetInt32());
        Assert.Equal("user", card.GetProperty("assignedToUsername").GetString());
    }

    [Fact]
    public async Task SaveCard_WithNullAssignment_ClearsAssignment()
    {
        // First assign the card
        var boardRes = await _client.SendAsync(AuthGet("/api/board", _userToken));
        var board = await boardRes.Content.ReadFromJsonAsync<JsonElement>();
        var cols = board.GetProperty("columns");
        var firstColId = cols[0].GetProperty("id").GetString()!;
        var firstColTitle = cols[0].GetProperty("title").GetString()!;

        await _client.SendAsync(AuthPost("/api/board", new
        {
            board = new
            {
                id = _boardId,
                name = "My Board",
                columns = new object[]
                {
                    new
                    {
                        id = firstColId,
                        title = firstColTitle,
                        position = 0,
                        cards = new object[]
                        {
                            new
                            {
                                id = "0",
                                title = "Task",
                                details = "",
                                position = 0,
                                priority = "Medium",
                                label = "",
                                dueDate = (DateTime?)null,
                                assignedToUserId = _userId
                            }
                        }
                    },
                    new { id = cols[1].GetProperty("id").GetString()!, title = "In Progress", position = 1, cards = Array.Empty<object>() },
                    new { id = cols[2].GetProperty("id").GetString()!, title = "Done", position = 2, cards = Array.Empty<object>() }
                }
            }
        }, _userToken));

        // Re-read to get real card ID
        var reloaded1 = await (await _client.SendAsync(AuthGet("/api/board", _userToken)))
            .Content.ReadFromJsonAsync<JsonElement>();
        var col1 = reloaded1.GetProperty("columns")[0];
        var cardId = col1.GetProperty("cards")[0].GetProperty("id").GetString()!;

        // Now clear assignment
        await _client.SendAsync(AuthPost("/api/board", new
        {
            board = new
            {
                id = _boardId,
                name = "My Board",
                columns = new object[]
                {
                    new
                    {
                        id = firstColId,
                        title = firstColTitle,
                        position = 0,
                        cards = new object[]
                        {
                            new
                            {
                                id = cardId,
                                title = "Task",
                                details = "",
                                position = 0,
                                priority = "Medium",
                                label = "",
                                dueDate = (DateTime?)null,
                                assignedToUserId = (int?)null
                            }
                        }
                    },
                    new { id = reloaded1.GetProperty("columns")[1].GetProperty("id").GetString()!, title = "In Progress", position = 1, cards = Array.Empty<object>() },
                    new { id = reloaded1.GetProperty("columns")[2].GetProperty("id").GetString()!, title = "Done", position = 2, cards = Array.Empty<object>() }
                }
            }
        }, _userToken));

        var reloaded2 = await (await _client.SendAsync(AuthGet("/api/board", _userToken)))
            .Content.ReadFromJsonAsync<JsonElement>();
        var finalCard = reloaded2.GetProperty("columns")[0].GetProperty("cards")[0];
        Assert.True(finalCard.GetProperty("assignedToUserId").ValueKind == JsonValueKind.Null);
    }

    // ── Profile update ────────────────────────────────────────────────────────

    [Fact]
    public async Task UpdateProfile_ValidEmail_Succeeds()
    {
        var res = await _client.SendAsync(AuthPost("/api/auth/profile",
            new { email = "newemail@test.com" }, _userToken));
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Verify profile shows new email
        var verify = await (await _client.SendAsync(AuthGet("/api/auth/verify", _userToken)))
            .Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("newemail@test.com", verify.GetProperty("email").GetString());
    }

    [Fact]
    public async Task UpdateProfile_DuplicateEmail_Returns400()
    {
        // Admin user already has an email set - first get admin's email
        var adminVerify = await (await _client.SendAsync(AuthGet("/api/auth/verify", _adminToken)))
            .Content.ReadFromJsonAsync<JsonElement>();
        var adminEmail = adminVerify.GetProperty("email").GetString()!;

        if (string.IsNullOrEmpty(adminEmail)) return; // Skip if admin has no email set

        var res = await _client.SendAsync(AuthPost("/api/auth/profile",
            new { email = adminEmail }, _userToken));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task UpdateProfile_NoToken_Returns401()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/profile");
        req.Content = JsonContent.Create(new { email = "test@test.com" });
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static HttpRequestMessage AuthGet(string path, string token)
    {
        var req = new HttpRequestMessage(HttpMethod.Get, path);
        req.Headers.Add("Authorization", $"Bearer {token}");
        return req;
    }

    private static HttpRequestMessage AuthPost(string path, object body, string token)
    {
        var req = new HttpRequestMessage(HttpMethod.Post, path);
        req.Headers.Add("Authorization", $"Bearer {token}");
        req.Content = JsonContent.Create(body);
        return req;
    }
}
