using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.MsSql;
using Xunit;

public class AuthEndpointTests : IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder().Build();
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;

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
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _db.DisposeAsync();
    }

    // ── Login ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Login_ValidCredentials_Returns200WithToken()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "user", password = "password" });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(token));
        Assert.Equal(64, token!.Length);
    }

    [Fact]
    public async Task Login_WrongPassword_Returns401()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "user", password = "wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    [Fact]
    public async Task Login_UnknownUser_Returns401()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "nobody", password = "password" });

        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── Verify ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Verify_WithValidToken_Returns200AndUsername()
    {
        var token = await LoginAndGetToken();

        var req = new HttpRequestMessage(HttpMethod.Get, "/api/auth/verify");
        req.Headers.Add("Authorization", $"Bearer {token}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("user", body.GetProperty("username").GetString());
    }

    [Fact]
    public async Task Verify_WithoutToken_Returns401()
    {
        var res = await _client.GetAsync("/api/auth/verify");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── Logout ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Logout_InvalidatesToken_SubsequentVerifyReturns401()
    {
        var token = await LoginAndGetToken();

        var logoutReq = new HttpRequestMessage(HttpMethod.Post, "/api/auth/logout");
        logoutReq.Headers.Add("Authorization", $"Bearer {token}");
        await _client.SendAsync(logoutReq);

        var verifyReq = new HttpRequestMessage(HttpMethod.Get, "/api/auth/verify");
        verifyReq.Headers.Add("Authorization", $"Bearer {token}");
        var verifyRes = await _client.SendAsync(verifyReq);

        Assert.Equal(HttpStatusCode.Unauthorized, verifyRes.StatusCode);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private async Task<string> LoginAndGetToken()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "user", password = "password" });
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }
}
