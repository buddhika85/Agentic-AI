using System.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new() { Title = "Kanban API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        Description = "Enter your session token"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            []
        }
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<BoardService>();
builder.Services.AddScoped<AiService>();
builder.Services.AddScoped<UserService>();

builder.Services.AddHttpClient("openrouter", client =>
{
    client.BaseAddress = new Uri("https://openrouter.ai/api/v1/");
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
        "Bearer", builder.Configuration["OPENROUTER_API_KEY"]);
    client.DefaultRequestHeaders.Add("HTTP-Referer", "http://localhost:5290");
});

var app = builder.Build();

// Auto-migrate and seed users
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var startupLogger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();

    for (var attempt = 1; attempt <= 5; attempt++)
    {
        try
        {
            db.Database.Migrate();
            break;
        }
        catch (Exception ex) when (attempt < 5)
        {
            startupLogger.LogWarning(
                "Migration attempt {Attempt}/5 failed: {Message}. Retrying in {Delay}s...",
                attempt, ex.Message, attempt * 2);
            Thread.Sleep(TimeSpan.FromSeconds(attempt * 2));
        }
    }

    // Seed default user
    if (!db.Users.Any(u => u.Username == "user"))
    {
        db.Users.Add(new User
        {
            Username = "user",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
            Email = "user@example.com",
            Role = UserRole.User,
            CreatedAt = DateTime.UtcNow
        });
    }

    // Seed admin user
    if (!db.Users.Any(u => u.Username == "admin"))
    {
        db.Users.Add(new User
        {
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123!"),
            Email = "admin@example.com",
            Role = UserRole.Admin,
            CreatedAt = DateTime.UtcNow
        });
    }

    db.SaveChanges();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Kanban API v1");
        options.RoutePrefix = "swagger";
    });
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }))
   .WithName("HealthCheck")
   .WithTags("Health");

AuthEndpoints.Map(app);
BoardEndpoints.Map(app);
AiEndpoints.Map(app);
UserEndpoints.Map(app);

// SPA catch-all — must stay last
app.MapFallbackToFile("index.html");

app.Run();

// Required by WebApplicationFactory<Program> in the test project
public partial class Program { }
