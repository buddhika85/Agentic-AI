using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.MsSql;
using Xunit;

public class UserEndpointTests : IAsyncLifetime
{
    private readonly MsSqlContainer _db = new MsSqlBuilder().Build();
    private WebApplicationFactory<Program> _factory = null!;
    private HttpClient _client = null!;
    private string _userToken = null!;
    private string _adminToken = null!;

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

        _userToken = await LoginAndGetToken("user", "password");
        _adminToken = await LoginAndGetToken("admin", "admin123!");
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _factory.DisposeAsync();
        await _db.DisposeAsync();
    }

    // ── Registration ─────────────────────────────────────────────────────────

    [Fact]
    public async Task Register_ValidCredentials_Returns200WithToken()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "newuser",
            password = "secure123",
            email = "newuser@example.com"
        });

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString();
        Assert.False(string.IsNullOrEmpty(token));
        Assert.Equal(64, token!.Length);
    }

    [Fact]
    public async Task Register_DuplicateUsername_Returns400()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "user",  // already seeded
            password = "newpass123",
            email = "other@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Contains("taken", body.GetProperty("error").GetString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Register_ShortPassword_Returns400()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "brandnew",
            password = "abc",  // too short
            email = "brandnew@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Register_ShortUsername_Returns400()
    {
        var res = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "ab",  // too short
            password = "password123",
            email = "ab@example.com"
        });

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Register_NewUser_CanLoginAfterward()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "logintest",
            password = "testpass123",
            email = "logintest@example.com"
        });

        var token = await LoginAndGetToken("logintest", "testpass123");
        Assert.False(string.IsNullOrEmpty(token));
    }

    // ── Verify returns role ───────────────────────────────────────────────────

    [Fact]
    public async Task Verify_AdminUser_ReturnsAdminRole()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/auth/verify");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Admin", body.GetProperty("role").GetString());
    }

    [Fact]
    public async Task Verify_RegularUser_ReturnsUserRole()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/auth/verify");
        req.Headers.Add("Authorization", $"Bearer {_userToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("User", body.GetProperty("role").GetString());
    }

    // ── Change password ───────────────────────────────────────────────────────

    [Fact]
    public async Task ChangePassword_ValidCurrentPassword_Succeeds()
    {
        // Register a fresh user to change its password
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "changepwuser",
            password = "oldpassword",
            email = "changepw@example.com"
        });
        var token = await LoginAndGetToken("changepwuser", "oldpassword");

        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/change-password");
        req.Headers.Add("Authorization", $"Bearer {token}");
        req.Content = JsonContent.Create(new
        {
            currentPassword = "oldpassword",
            newPassword = "newpassword123"
        });
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Old password should no longer work
        var loginRes = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "changepwuser", password = "oldpassword" });
        Assert.Equal(HttpStatusCode.Unauthorized, loginRes.StatusCode);

        // New password should work
        var newLoginRes = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "changepwuser", password = "newpassword123" });
        Assert.Equal(HttpStatusCode.OK, newLoginRes.StatusCode);
    }

    [Fact]
    public async Task ChangePassword_WrongCurrentPassword_Returns400()
    {
        var req = new HttpRequestMessage(HttpMethod.Post, "/api/auth/change-password");
        req.Headers.Add("Authorization", $"Bearer {_userToken}");
        req.Content = JsonContent.Create(new
        {
            currentPassword = "wrongpassword",
            newPassword = "newpassword123"
        });
        var res = await _client.SendAsync(req);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ── Admin: list users ─────────────────────────────────────────────────────

    [Fact]
    public async Task ListUsers_AdminToken_ReturnsAllUsers()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var users = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(users.GetArrayLength() >= 2); // at least 'user' and 'admin'
    }

    [Fact]
    public async Task ListUsers_RegularToken_Returns403()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users");
        req.Headers.Add("Authorization", $"Bearer {_userToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
    }

    [Fact]
    public async Task ListUsers_NoToken_Returns401()
    {
        var res = await _client.GetAsync("/api/admin/users");
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    // ── Admin: get user ───────────────────────────────────────────────────────

    [Fact]
    public async Task GetUser_AdminToken_ReturnsUser()
    {
        // First list to get a user id
        var listReq = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users");
        listReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var listRes = await _client.SendAsync(listReq);
        var users = await listRes.Content.ReadFromJsonAsync<JsonElement>();
        var userId = users[0].GetProperty("id").GetInt32();

        var req = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/users/{userId}");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var user = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(user.TryGetProperty("username", out _));
    }

    [Fact]
    public async Task GetUser_NonExistentId_Returns404()
    {
        var req = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users/99999");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
    }

    // ── Admin: delete user ────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteUser_AdminToken_Returns204()
    {
        // Register a user to delete
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "deleteme",
            password = "deleteme123",
            email = "deleteme@example.com"
        });

        // Find the user's id
        var listReq = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users");
        listReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var listRes = await _client.SendAsync(listReq);
        var users = await listRes.Content.ReadFromJsonAsync<JsonElement>();
        var deleteUser = Enumerable.Range(0, users.GetArrayLength())
            .Select(i => users[i])
            .First(u => u.GetProperty("username").GetString() == "deleteme");
        var userId = deleteUser.GetProperty("id").GetInt32();

        var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/admin/users/{userId}");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.NoContent, res.StatusCode);

        // Verify deleted
        var checkReq = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/users/{userId}");
        checkReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var checkRes = await _client.SendAsync(checkReq);
        Assert.Equal(HttpStatusCode.NotFound, checkRes.StatusCode);
    }

    [Fact]
    public async Task DeleteUser_SelfDelete_Returns400()
    {
        // Get admin's own ID
        var verifyReq = new HttpRequestMessage(HttpMethod.Get, "/api/auth/verify");
        verifyReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var verifyRes = await _client.SendAsync(verifyReq);
        var verifyBody = await verifyRes.Content.ReadFromJsonAsync<JsonElement>();
        var adminId = verifyBody.GetProperty("id").GetInt32();

        var req = new HttpRequestMessage(HttpMethod.Delete, $"/api/admin/users/{adminId}");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ── Admin: reset password ─────────────────────────────────────────────────

    [Fact]
    public async Task AdminResetPassword_ValidUserId_ChangesPassword()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "resetpwuser",
            password = "oldpassword",
            email = "resetpw@example.com"
        });

        var listReq = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users");
        listReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var listRes = await _client.SendAsync(listReq);
        var users = await listRes.Content.ReadFromJsonAsync<JsonElement>();
        var target = Enumerable.Range(0, users.GetArrayLength())
            .Select(i => users[i])
            .First(u => u.GetProperty("username").GetString() == "resetpwuser");
        var userId = target.GetProperty("id").GetInt32();

        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/users/{userId}/reset-password");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        req.Content = JsonContent.Create(new { newPassword = "brandnewpass123" });
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        // Verify new password works
        var loginRes = await _client.PostAsJsonAsync("/api/auth/login",
            new { username = "resetpwuser", password = "brandnewpass123" });
        Assert.Equal(HttpStatusCode.OK, loginRes.StatusCode);
    }

    // ── Admin: set role ───────────────────────────────────────────────────────

    [Fact]
    public async Task SetRole_PromoteToAdmin_UpdatesRole()
    {
        await _client.PostAsJsonAsync("/api/auth/register", new
        {
            username = "promoteuser",
            password = "promotepass123",
            email = "promote@example.com"
        });

        var listReq = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users");
        listReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var listRes = await _client.SendAsync(listReq);
        var users = await listRes.Content.ReadFromJsonAsync<JsonElement>();
        var target = Enumerable.Range(0, users.GetArrayLength())
            .Select(i => users[i])
            .First(u => u.GetProperty("username").GetString() == "promoteuser");
        var userId = target.GetProperty("id").GetInt32();

        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/users/{userId}/role");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        req.Content = JsonContent.Create(new { role = "Admin" });
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.OK, res.StatusCode);

        var getReq = new HttpRequestMessage(HttpMethod.Get, $"/api/admin/users/{userId}");
        getReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var getRes = await _client.SendAsync(getReq);
        var updated = await getRes.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Admin", updated.GetProperty("role").GetString());
    }

    [Fact]
    public async Task SetRole_InvalidRole_Returns400()
    {
        var listReq = new HttpRequestMessage(HttpMethod.Get, "/api/admin/users");
        listReq.Headers.Add("Authorization", $"Bearer {_adminToken}");
        var listRes = await _client.SendAsync(listReq);
        var users = await listRes.Content.ReadFromJsonAsync<JsonElement>();
        var userId = users[0].GetProperty("id").GetInt32();

        var req = new HttpRequestMessage(HttpMethod.Post, $"/api/admin/users/{userId}/role");
        req.Headers.Add("Authorization", $"Bearer {_adminToken}");
        req.Content = JsonContent.Create(new { role = "SuperUser" });
        var res = await _client.SendAsync(req);

        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<string> LoginAndGetToken(string username, string password)
    {
        var res = await _client.PostAsJsonAsync("/api/auth/login",
            new { username, password });
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("token").GetString()!;
    }
}
