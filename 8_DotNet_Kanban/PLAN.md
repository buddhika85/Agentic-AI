# Kanban Studio — .NET Rebuild Plan

Rebuild of the Kanban Studio project using ASP.NET Core Minimal APIs, MSSQL, Angular, and Docker.
The finished product is a single-board Kanban workspace with an AI chat assistant, deployed as a
unified Docker Compose stack (two containers: API + DB) served on port 8000.

---

## Progress Summary

| Step | Description | Status |
|------|-------------|--------|
| 1 | Scaffold the Solution | ✅ Complete |
| 2 | Database (MSSQL + EF Core) | ✅ Complete |
| 3 | Authentication | ✅ Complete |
| 4 | Board API Endpoints | ✅ Complete |
| 5 | AI Chat Endpoint | ✅ Complete |
| 6 | Angular Frontend | ✅ Complete |
| 7 | Docker & Docker Compose | ✅ Complete |
| 8 | Tests | ✅ Complete |
| 9 | Run & Verify | ✅ Complete |

### Notes on completed work

- **Angular version:** 20 (not 18 as originally planned) — standalone components, signals API
- **Auth:** Custom session-token auth (64-char hex, stored in `Sessions` DB table) — not JWT
- **Tailwind:** v3 via PostCSS (`tailwind.config.js` + `postcss.config.js`) — v4 was attempted but incompatible with Angular 20's esbuild builder
- **AI model:** `openai/gpt-oss-120b:free` via OpenRouter
- **Extra features implemented beyond the original plan:**
  - Add / delete (empty) / rename columns inline
  - Drag-to-reorder columns (CDK horizontal drag-drop)
  - Max 5 columns enforced in both frontend (`submitColumn`) and backend (`SaveBoardAsync`)
  - Card details field on card creation (not just title)
  - AI board updates capped at 5 columns on both frontend and backend

---

## Feature Requirements & Business Rules

This section documents all confirmed requirements, including decisions made during development that
differ from or extend the original plan.

### Board

| Rule | Detail |
|------|--------|
| Single board per user | Each user has exactly one board, auto-seeded on first login |
| Board name | Editable (persisted via `POST /api/board`) |

### Columns

| Rule | Detail |
|------|--------|
| **Max 5 columns per board** | Hard limit enforced in both `BoardService.SaveBoardAsync()` (backend, silently truncates to 5) and `submitColumn()` + `applyAiBoardUpdate()` (frontend) — AI cannot bypass this |
| Add column | "+ Add column" button appears to the right of existing columns; hidden when at the 5-column limit |
| **Delete column** | Only permitted when the column has **zero cards** — a trash icon appears in the column header exclusively when `cards.length === 0` |
| Rename column | Click the column title to edit it inline; Enter or blur saves, Escape cancels |
| Reorder columns | Columns can be dragged horizontally by their grip handle to reorder; position is persisted immediately |
| Default columns | New boards are seeded with three columns: "To Do", "In Progress", "Done" |

### Cards

| Rule | Detail |
|------|--------|
| Card fields | Each card has a **title** (required) and **details** (optional free-text) |
| Add card | Form in the column footer accepts both title and details before creation |
| Edit card | Click any card to open inline edit mode (title + details); Save / Cancel / Delete buttons |
| Delete card | Available from the card's inline edit mode (no empty-column requirement) |
| Reorder cards | Cards can be dragged within a column or moved to another column via CDK drag-drop |

### AI Assistant

| Rule | Detail |
|------|--------|
| Model | `openai/gpt-oss-120b:free` via OpenRouter |
| Column cap | AI-returned board updates are capped at 5 columns on both frontend (`applyAiBoardUpdate`) and backend (`SaveBoardAsync`) |
| Sidebar label | "Powered by GPT-OSS 120B" |
| Board access | AI receives the full current board state with every message and may return a `board_update` to mutate the board |

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Step 1 — Scaffold the Solution](#step-1--scaffold-the-solution)
4. [Step 2 — Database (MSSQL + EF Core)](#step-2--database-mssql--ef-core)
5. [Step 3 — Authentication](#step-3--authentication)
6. [Step 4 — Board API Endpoints](#step-4--board-api-endpoints)
7. [Step 5 — AI Chat Endpoint](#step-5--ai-chat-endpoint)
8. [Step 6 — Angular Frontend](#step-6--angular-frontend)
9. [Step 7 — Docker & Docker Compose](#step-7--docker--docker-compose)
10. [Step 8 — Tests](#step-8--tests)
11. [Step 9 — Run & Verify](#step-9--run--verify)
12. [Environment Variables Reference](#environment-variables-reference)
13. [API Reference](#api-reference)

---

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | .NET 9 (ASP.NET Core Minimal APIs) |
| ORM | Entity Framework Core 9 |
| Database | Microsoft SQL Server 2022 (Docker image) |
| Auth | Custom session tokens (64-char hex, stored in DB — not JWT) |
| AI | OpenRouter REST API (model: `openai/gpt-oss-120b:free`) |
| Frontend | Angular 20 (standalone components, signals) |
| CSS | Tailwind CSS 3 via PostCSS |
| Drag-and-drop | `@angular/cdk` CDK DragDrop |
| Containerisation | Docker + Docker Compose v2 |
| Package managers | `dotnet CLI` (backend), `npm` (frontend) |
| Testing — backend | xUnit + Testcontainers.MsSql |
| Testing — frontend | Jest + Angular Testing Library |

---

## 2. Project Structure

```
8_DotNet_Kanban/
├── backend/                        # ASP.NET Core Web API project
│   ├── KanbanApi.csproj
│   ├── Program.cs                  # App entry point, DI, middleware, route registration
│   ├── appsettings.json            # Non-secret config
│   ├── appsettings.Development.json
│   ├── Data/
│   │   ├── AppDbContext.cs         # EF Core DbContext
│   │   └── Migrations/             # EF migration files (auto-generated)
│   ├── Models/
│   │   ├── User.cs
│   │   ├── Board.cs
│   │   ├── Column.cs
│   │   └── Card.cs
│   ├── DTOs/
│   │   ├── Auth/                   # LoginRequest, LoginResponse, etc.
│   │   ├── Board/                  # BoardDto, ColumnDto, CardDto, SaveBoardRequest
│   │   └── AI/                     # ChatRequest, ChatResponse, BoardUpdate
│   ├── Services/
│   │   ├── AuthService.cs          # Password hashing, token generation
│   │   ├── BoardService.cs         # Board read/write logic
│   │   └── AiService.cs            # OpenRouter HTTP client
│   ├── Endpoints/
│   │   ├── AuthEndpoints.cs        # /api/auth/* route group
│   │   ├── BoardEndpoints.cs       # /api/board route group
│   │   └── AiEndpoints.cs          # /api/ai/chat route group
│   └── Tests/
│       ├── AuthEndpointTests.cs
│       ├── BoardEndpointTests.cs
│       └── AiServiceTests.cs
├── frontend/                       # Angular project
│   ├── angular.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.ts                 # Bootstrap
│   │   ├── app/
│   │   │   ├── app.config.ts       # provideRouter, provideHttpClient, etc.
│   │   │   ├── app.component.ts    # Root shell (auth guard)
│   │   │   ├── auth/
│   │   │   │   ├── auth.service.ts # JWT storage, login/logout
│   │   │   │   ├── auth.guard.ts   # Route guard
│   │   │   │   └── login/
│   │   │   │       └── login.component.ts
│   │   │   ├── board/
│   │   │   │   ├── board.service.ts        # HTTP + 800ms debounce save
│   │   │   │   ├── board.component.ts      # Drag-drop host
│   │   │   │   ├── column/
│   │   │   │   │   └── column.component.ts
│   │   │   │   └── card/
│   │   │   │       ├── card.component.ts
│   │   │   │       └── card-edit/
│   │   │   │           └── card-edit.component.ts
│   │   │   └── chat/
│   │   │       └── chat-sidebar.component.ts
│   │   └── environments/
│   │       ├── environment.ts
│   │       └── environment.prod.ts
│   └── nginx.conf                  # Not needed — API serves static files
├── docker-compose.yml
├── docker-compose.override.yml     # Dev overrides (volume mounts, hot-reload)
├── Dockerfile                      # Multi-stage: Angular build → .NET runtime
├── .env                            # OPENROUTER_API_KEY, JWT_SECRET, SA_PASSWORD
├── .gitignore
└── PLAN.md                         # This file
```

---

## Step 1 — Scaffold the Solution ✅ Complete

### 1.1 Prerequisites

- .NET 9 SDK: https://dotnet.microsoft.com/download
- Node.js 20+
- Docker Desktop
- Angular CLI: `npm install -g @angular/cli`

### 1.2 Create the .NET project

```bash
mkdir 8_DotNet_Kanban && cd 8_DotNet_Kanban

# Create a minimal API project (no controllers)
dotnet new webapi -n KanbanApi --use-minimal-apis -o backend
cd backend

# Add EF Core + SQL Server provider
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet add package Microsoft.EntityFrameworkCore.Tools

# JWT auth
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer

# HTTP client factory (for OpenRouter calls)
dotnet add package Microsoft.Extensions.Http

# Install EF global tool (once per machine)
dotnet tool install --global dotnet-ef
```

### 1.3 Create the Angular project

```bash
cd ..
ng new frontend --routing=false --style=css --standalone --skip-git
cd frontend

# Drag-and-drop
npm install @angular/cdk

# Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init
```

Configure `tailwind.config.js`:
```js
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: { extend: {} },
  plugins: [],
};
```

Add to `src/styles.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Step 2 — Database (MSSQL + EF Core) ✅ Complete

### 2.1 Models

**`Models/User.cs`**
```csharp
public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Session> Sessions { get; set; } = [];
    public ICollection<Board> Boards { get; set; } = [];
}
```

**`Models/Session.cs`**
```csharp
public class Session
{
    public string Token { get; set; } = "";   // PK — 64-char hex
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; }
}
```

**`Models/Board.cs`**
```csharp
public class Board
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Name { get; set; } = "My Board";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Column> Columns { get; set; } = [];
}
```

**`Models/Column.cs`**
```csharp
public class Column
{
    public int Id { get; set; }
    public int BoardId { get; set; }
    public Board Board { get; set; } = null!;
    public string Title { get; set; } = "";
    public int Position { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Card> Cards { get; set; } = [];
}
```

**`Models/Card.cs`**
```csharp
public class Card
{
    public int Id { get; set; }
    public int ColumnId { get; set; }
    public Column Column { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Details { get; set; } = "";
    public int Position { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

### 2.2 DbContext

**`Data/AppDbContext.cs`**
```csharp
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<Column> Columns => Set<Column>();
    public DbSet<Card> Cards => Set<Card>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.Entity<Session>().HasKey(s => s.Token);

        mb.Entity<Column>()
            .HasOne(c => c.Board).WithMany(b => b.Columns)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<Card>()
            .HasOne(c => c.Column).WithMany(col => col.Cards)
            .OnDelete(DeleteBehavior.Cascade);

        // Seed default user (password: "password")
        mb.Entity<User>().HasData(new User
        {
            Id = 1,
            Username = "user",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("password"),
            CreatedAt = DateTime.UtcNow
        });
    }
}
```

> Add `BCrypt.Net-Next` package: `dotnet add package BCrypt.Net-Next`

### 2.3 Register EF Core in Program.cs

```csharp
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));
```

**`appsettings.json`**
```json
{
  "ConnectionStrings": {
    "Default": "Server=db;Database=KanbanDb;User Id=sa;Password=${SA_PASSWORD};TrustServerCertificate=True;"
  }
}
```

### 2.4 Create and apply migrations

```bash
cd backend
dotnet ef migrations add InitialCreate
dotnet ef database update   # only for local dev; Docker handles this at startup
```

### 2.5 Auto-migrate on startup (Program.cs)

```csharp
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();   // applies pending migrations; creates DB if absent
}
```

---

## Step 3 — Authentication ✅ Complete

### 3.1 Auth Service

**`Services/AuthService.cs`**
```csharp
public class AuthService(AppDbContext db, IConfiguration config)
{
    public async Task<string?> LoginAsync(string username, string password)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user is null || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            return null;

        // Remove expired sessions
        var expired = db.Sessions.Where(s => s.ExpiresAt < DateTime.UtcNow);
        db.Sessions.RemoveRange(expired);

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLower();
        db.Sessions.Add(new Session
        {
            Token = token,
            UserId = user.Id,
            ExpiresAt = DateTime.UtcNow.AddHours(8)
        });
        await db.SaveChangesAsync();
        return token;
    }

    public async Task<User?> ValidateTokenAsync(string token)
    {
        var session = await db.Sessions
            .Include(s => s.User)
            .FirstOrDefaultAsync(s => s.Token == token && s.ExpiresAt > DateTime.UtcNow);
        return session?.User;
    }

    public async Task LogoutAsync(string token)
    {
        var session = await db.Sessions.FindAsync(token);
        if (session is not null)
        {
            db.Sessions.Remove(session);
            await db.SaveChangesAsync();
        }
    }
}
```

### 3.2 Auth Endpoints

**`Endpoints/AuthEndpoints.cs`**
```csharp
public static class AuthEndpoints
{
    public static void Map(WebApplication app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", async (LoginRequest req, AuthService auth) =>
        {
            var token = await auth.LoginAsync(req.Username, req.Password);
            if (token is null) return Results.Unauthorized();
            return Results.Ok(new LoginResponse(token));
        });

        group.MapPost("/logout", async (HttpContext ctx, AuthService auth) =>
        {
            var token = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");
            await auth.LogoutAsync(token);
            return Results.Ok();
        });

        group.MapGet("/verify", async (HttpContext ctx, AuthService auth) =>
        {
            var token = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");
            var user = await auth.ValidateTokenAsync(token);
            return user is null ? Results.Unauthorized() : Results.Ok(new { user.Username });
        });
    }
}
```

DTOs:
```csharp
public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token);
```

### 3.3 Auth middleware helper

Create a small helper to extract and validate the token on protected routes:

```csharp
// Program.cs helper
static async Task<IResult> RequireAuth(HttpContext ctx, AuthService auth,
    Func<User, Task<IResult>> handler)
{
    var token = ctx.Request.Headers.Authorization.ToString().Replace("Bearer ", "");
    var user = await auth.ValidateTokenAsync(token);
    return user is null ? Results.Unauthorized() : await handler(user);
}
```

Or use a filter:
```csharp
// Extension method on RouteGroupBuilder
group.AddEndpointFilter<TokenAuthFilter>();
```

---

## Step 4 — Board API Endpoints ✅ Complete

### 4.1 Board DTOs

```csharp
public record CardDto(string Id, string Title, string Details, int Position);
public record ColumnDto(string Id, string Title, int Position, List<CardDto> Cards);
public record BoardDto(string Id, string Name, List<ColumnDto> Columns);
public record SaveBoardRequest(BoardDto Board);
```

> Use string IDs on the wire (matching Angular expectations) and int PKs in the DB.
> The mapping layer converts between the two.

### 4.2 Board Service

**`Services/BoardService.cs`**
```csharp
public class BoardService(AppDbContext db)
{
    public async Task<BoardDto?> GetBoardAsync(int userId)
    {
        var board = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards)
            .FirstOrDefaultAsync(b => b.UserId == userId);

        if (board is null)
        {
            // Seed default board for new user
            board = await SeedDefaultBoardAsync(userId);
        }
        return MapToDto(board);
    }

    public async Task<BoardDto> SaveBoardAsync(int userId, BoardDto dto)
    {
        var board = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards)
            .FirstOrDefaultAsync(b => b.UserId == userId)
            ?? throw new InvalidOperationException("Board not found");

        // Sync columns and cards from DTO (upsert + delete orphans)
        // ... mapping logic ...

        board.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return MapToDto(board);
    }

    private static BoardDto MapToDto(Board board) => new(
        board.Id.ToString(),
        board.Name,
        board.Columns.OrderBy(c => c.Position).Select(col => new ColumnDto(
            col.Id.ToString(),
            col.Title,
            col.Position,
            col.Cards.OrderBy(c => c.Position).Select(card => new CardDto(
                card.Id.ToString(), card.Title, card.Details, card.Position
            )).ToList()
        )).ToList()
    );
}
```

### 4.3 Board Endpoints

**`Endpoints/BoardEndpoints.cs`**
```csharp
public static class BoardEndpoints
{
    public static void Map(WebApplication app)
    {
        var group = app.MapGroup("/api/board").RequireAuthorization();

        group.MapGet("/", async (ClaimsPrincipal principal, BoardService boards) =>
        {
            var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var board = await boards.GetBoardAsync(userId);
            return Results.Ok(board);
        });

        group.MapPost("/", async (SaveBoardRequest req, ClaimsPrincipal principal, BoardService boards) =>
        {
            var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var saved = await boards.SaveBoardAsync(userId, req.Board);
            return Results.Ok(saved);
        });
    }
}
```

> Note: Use `AddAuthentication` + `AddJwtBearer` in Program.cs and `RequireAuthorization()` on
> groups, OR implement a custom token filter calling `AuthService.ValidateTokenAsync` — the latter
> matches the session-token approach used in the Python original.

---

## Step 5 — AI Chat Endpoint ✅ Complete

### 5.1 AI Service

**`Services/AiService.cs`**
```csharp
public class AiService(IHttpClientFactory factory, IConfiguration config)
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
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<OpenRouterResponse>()
            ?? throw new InvalidOperationException("Empty AI response");

        var raw = result.Choices[0].Message.Content;
        return ParseAiResponse(raw);
    }

    private static string BuildSystemPrompt(BoardDto board)
    {
        var boardJson = JsonSerializer.Serialize(board);
        return $"""
            You are a Kanban board assistant. The current board state is:
            {boardJson}

            Respond ONLY with valid JSON in this exact format:
            {{
              "message": "<your reply to the user>",
              "board_update": <full updated board object, or null if no changes needed>
            }}

            You can create, move, rename, or delete cards and columns.
            Always return the complete board state in board_update when making changes.
            """;
    }

    private static ChatResponse ParseAiResponse(string raw)
    {
        // Strip markdown code fences if present
        var json = raw.Trim();
        if (json.StartsWith("```")) json = string.Join('\n', json.Split('\n')[1..^1]);

        var doc = JsonDocument.Parse(json);
        var message = doc.RootElement.GetProperty("message").GetString() ?? "";
        BoardDto? boardUpdate = null;

        if (doc.RootElement.TryGetProperty("board_update", out var bu)
            && bu.ValueKind != JsonValueKind.Null)
        {
            boardUpdate = JsonSerializer.Deserialize<BoardDto>(bu.GetRawText());
        }

        return new ChatResponse(message, boardUpdate);
    }
}

public record ChatResponse(string Message, BoardDto? BoardUpdate);
```

### 5.2 Register HttpClient for OpenRouter

**`Program.cs`**
```csharp
builder.Services.AddHttpClient("openrouter", client =>
{
    client.BaseAddress = new Uri("https://openrouter.ai/api/v1/");
    client.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer",
            builder.Configuration["OPENROUTER_API_KEY"]);
    client.DefaultRequestHeaders.Add("HTTP-Referer", "http://localhost:8000");
});
```

### 5.3 AI Endpoint

**`Endpoints/AiEndpoints.cs`**
```csharp
public static class AiEndpoints
{
    public static void Map(WebApplication app)
    {
        app.MapPost("/api/ai/chat", async (
            ChatRequest req,
            ClaimsPrincipal principal,
            BoardService boards,
            AiService ai) =>
        {
            var userId = int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var board = await boards.GetBoardAsync(userId)
                ?? throw new InvalidOperationException("No board found");

            var response = await ai.ChatAsync(req.Message, board);

            if (response.BoardUpdate is not null)
                await boards.SaveBoardAsync(userId, response.BoardUpdate);

            return Results.Ok(new { message = response.Message, board_update = response.BoardUpdate });
        }).RequireAuthorization();
    }
}

public record ChatRequest(string Message);
```

---

## Step 6 — Angular Frontend ✅ Complete

### 6.1 Auth Service

**`src/app/auth/auth.service.ts`**
```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private token = signal<string | null>(localStorage.getItem('token'));

  isLoggedIn = computed(() => this.token() !== null);

  async login(username: string, password: string): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<{ token: string }>('/api/auth/login', { username, password })
      );
      localStorage.setItem('token', res.token);
      this.token.set(res.token);
      return true;
    } catch {
      return false;
    }
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post('/api/auth/logout', {}));
    localStorage.removeItem('token');
    this.token.set(null);
  }

  getToken(): string | null { return this.token(); }
}
```

### 6.2 HTTP Interceptor (attach token)

**`src/app/auth/auth.interceptor.ts`**
```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  if (!token) return next(req);
  return next(req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`)
  }));
};
```

Register in `app.config.ts`:
```typescript
provideHttpClient(withInterceptors([authInterceptor]))
```

### 6.3 Board Service (with 800ms debounce)

**`src/app/board/board.service.ts`**
```typescript
@Injectable({ providedIn: 'root' })
export class BoardService {
  private http = inject(HttpClient);
  board = signal<BoardData | null>(null);

  private saveSubject = new Subject<BoardData>();

  constructor() {
    // Debounce saves — do NOT reduce below 800ms (prevents flooding during drag-drop)
    this.saveSubject.pipe(debounceTime(800)).subscribe(b => this.persistBoard(b));
  }

  async loadBoard(): Promise<void> {
    const data = await firstValueFrom(this.http.get<BoardData>('/api/board'));
    this.board.set(data);
  }

  updateBoard(updated: BoardData): void {
    this.board.set(updated);
    this.saveSubject.next(updated);
  }

  private persistBoard(data: BoardData): void {
    this.http.post('/api/board', { board: data }).subscribe();
  }

  applyAiBoardUpdate(update: BoardData): void {
    this.board.set(update);
    // AI updates save immediately (no debounce needed — not user-triggered drag)
    this.persistBoard(update);
  }
}
```

### 6.4 Board Component (Drag-and-Drop)

**`src/app/board/board.component.ts`**
```typescript
@Component({
  selector: 'app-board',
  standalone: true,
  imports: [CdkDragDrop, CdkDropList, CdkDrag, ColumnComponent, ChatSidebarComponent],
  template: `
    <div class="flex h-screen">
      <div class="flex-1 overflow-x-auto p-4">
        <div class="flex gap-4"
             cdkDropListGroup>
          @for (col of board()?.columns; track col.id) {
            <app-column [column]="col"
                        (cardMoved)="onCardMoved($event)"
                        (cardEdited)="onCardEdited($event)" />
          }
        </div>
      </div>
      <app-chat-sidebar />
    </div>
  `
})
export class BoardComponent implements OnInit {
  private boardService = inject(BoardService);
  board = this.boardService.board;

  ngOnInit() { this.boardService.loadBoard(); }

  onCardMoved(event: CardMoveEvent): void {
    const updated = moveCard(this.board()!, event);
    this.boardService.updateBoard(updated);
  }

  onCardEdited(card: Card): void {
    const updated = updateCard(this.board()!, card);
    this.boardService.updateBoard(updated);
  }
}
```

### 6.5 Chat Sidebar

**`src/app/chat/chat-sidebar.component.ts`**
```typescript
@Component({
  selector: 'app-chat-sidebar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <aside class="w-80 border-l flex flex-col bg-white">
      <div class="flex-1 overflow-y-auto p-4 space-y-2">
        @for (msg of messages(); track $index) {
          <div [class]="msg.role === 'user' ? 'text-right' : 'text-left'">
            <span class="inline-block rounded px-3 py-2 text-sm"
                  [class.bg-blue-100]="msg.role === 'user'"
                  [class.bg-gray-100]="msg.role === 'assistant'">
              {{ msg.content }}
            </span>
          </div>
        }
      </div>
      <div class="p-4 border-t flex gap-2">
        <input [(ngModel)]="input" (keyup.enter)="send()"
               class="flex-1 border rounded px-3 py-2 text-sm"
               placeholder="Ask the AI..." />
        <button (click)="send()" class="px-4 py-2 bg-blue-600 text-white rounded text-sm">
          Send
        </button>
      </div>
    </aside>
  `
})
export class ChatSidebarComponent {
  private http = inject(HttpClient);
  private boardService = inject(BoardService);

  messages = signal<{ role: string; content: string }[]>([]);
  input = '';
  loading = signal(false);

  async send(): Promise<void> {
    if (!this.input.trim() || this.loading()) return;
    const msg = this.input.trim();
    this.input = '';
    this.messages.update(m => [...m, { role: 'user', content: msg }]);
    this.loading.set(true);

    try {
      const res = await firstValueFrom(
        this.http.post<{ message: string; board_update: BoardData | null }>(
          '/api/ai/chat', { message: msg }
        )
      );
      this.messages.update(m => [...m, { role: 'assistant', content: res.message }]);
      if (res.board_update) this.boardService.applyAiBoardUpdate(res.board_update);
    } finally {
      this.loading.set(false);
    }
  }
}
```

### 6.6 Angular Build for Production

In `angular.json`, set output path to `../backend/wwwroot`:
```json
"outputPath": "../backend/wwwroot"
```

In `Program.cs`:
```csharp
app.UseDefaultFiles();
app.UseStaticFiles();
// ... all API routes ...
app.MapFallbackToFile("index.html");  // SPA catch-all — must be last
```

---

## Step 7 — Docker & Docker Compose ✅ Complete

### 7.1 Multi-Stage Dockerfile

```dockerfile
# ── Stage 1: Build Angular ─────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build -- --configuration production

# ── Stage 2: Build .NET ────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS backend-build
WORKDIR /app/backend
COPY backend/*.csproj ./
RUN dotnet restore
COPY backend/ .
# Copy Angular output into wwwroot before publish
COPY --from=frontend-build /app/frontend/dist/frontend/browser ./wwwroot
RUN dotnet publish -c Release -o /publish

# ── Stage 3: Runtime ───────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=backend-build /publish .
EXPOSE 8000
ENV ASPNETCORE_URLS=http://+:8000
ENTRYPOINT ["dotnet", "KanbanApi.dll"]
```

### 7.2 Docker Compose

**`docker-compose.yml`**
```yaml
services:
  db:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      SA_PASSWORD: ${SA_PASSWORD}
      ACCEPT_EULA: "Y"
    ports:
      - "1433:1433"
    volumes:
      - mssql_data:/var/opt/mssql
    healthcheck:
      test: ["CMD", "/opt/mssql-tools/bin/sqlcmd", "-S", "localhost",
             "-U", "sa", "-P", "${SA_PASSWORD}", "-Q", "SELECT 1"]
      interval: 10s
      retries: 10
      start_period: 30s

  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      ConnectionStrings__Default: >
        Server=db;Database=KanbanDb;User Id=sa;
        Password=${SA_PASSWORD};TrustServerCertificate=True;
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
    depends_on:
      db:
        condition: service_healthy

volumes:
  mssql_data:
```

### 7.3 .env file

```
SA_PASSWORD=YourStr0ngP@ssword!
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx
```

> `SA_PASSWORD` must meet SQL Server complexity requirements (uppercase, lowercase, digit, symbol, 8+ chars).

### 7.4 Startup Scripts

**`scripts/start-dev.ps1`** (Windows)
```powershell
$ErrorActionPreference = "Stop"
Get-Content .env | ForEach-Object {
    if ($_ -match "^([^#][^=]*)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}
docker compose up --build
```

**`scripts/stop-dev.ps1`**
```powershell
docker compose down
```

---

## Step 8 — Tests ✅ Complete

### 8.1 Backend Tests (xUnit + Testcontainers)

```bash
dotnet add package xunit
dotnet add package Microsoft.AspNetCore.Mvc.Testing
dotnet add package Testcontainers.MsSql
```

**`Tests/AuthEndpointTests.cs`**
```csharp
public class AuthEndpointTests : IAsyncLifetime
{
    private MsSqlContainer _db = new MsSqlBuilder().Build();
    private WebApplicationFactory<Program> _factory = null!;

    public async Task InitializeAsync()
    {
        await _db.StartAsync();
        _factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
                builder.ConfigureAppConfiguration((_, cfg) =>
                    cfg.AddInMemoryCollection(new Dictionary<string, string?> {
                        ["ConnectionStrings:Default"] = _db.GetConnectionString()
                    })));
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsToken()
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { username = "user", password = "password" });
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.False(string.IsNullOrEmpty(body.GetProperty("token").GetString()));
    }

    [Fact]
    public async Task Login_WithWrongPassword_Returns401()
    {
        var client = _factory.CreateClient();
        var res = await client.PostAsJsonAsync("/api/auth/login",
            new { username = "user", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, res.StatusCode);
    }

    public async Task DisposeAsync()
    {
        await _factory.DisposeAsync();
        await _db.DisposeAsync();
    }
}
```

### 8.2 Frontend Tests (Jest)

```bash
cd frontend
npm install -D jest @types/jest jest-environment-jsdom
```

**`src/app/board/board.service.spec.ts`**
```typescript
describe('BoardService', () => {
  it('should debounce saves', fakeAsync(() => {
    const service = TestBed.inject(BoardService);
    const spy = spyOn(service as any, 'persistBoard');
    const board: BoardData = { id: '1', name: 'Test', columns: [] };

    service.updateBoard(board);
    service.updateBoard(board);
    service.updateBoard(board);

    tick(500);
    expect(spy).not.toHaveBeenCalled();

    tick(300);  // total 800ms elapsed
    expect(spy).toHaveBeenCalledTimes(1);
  }));
});
```

---

## Step 9 — Run & Verify ⬜ Not started

### Local development

```powershell
# From project root
./scripts/start-dev.ps1
```

Open http://localhost:8000 — login with `user` / `password`.

### Verify each layer

```powershell
# Health check
Invoke-RestMethod http://localhost:8000/api/health

# Login
$res = Invoke-RestMethod -Method POST http://localhost:8000/api/auth/login `
       -ContentType "application/json" `
       -Body '{"username":"user","password":"password"}'
$token = $res.token

# Get board
Invoke-RestMethod http://localhost:8000/api/board `
    -Headers @{ Authorization = "Bearer $token" }
```

### Run tests

```bash
# Backend
cd backend && dotnet test

# Frontend unit tests
cd frontend && npm test

# Frontend e2e (requires app running)
cd frontend && npx playwright test
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SA_PASSWORD` | Yes | SQL Server SA password (8+ chars, mixed case + symbol) |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for AI chat |
| `ASPNETCORE_URLS` | Docker | Set to `http://+:8000` in container |
| `ConnectionStrings__Default` | Docker | Full MSSQL connection string |

---

## API Reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/health` | No | Health check → `{ status: "ok" }` |
| POST | `/api/auth/login` | No | Login → `{ token: string }` |
| POST | `/api/auth/logout` | Bearer | Invalidate session |
| GET | `/api/auth/verify` | Bearer | Verify token → `{ username: string }` |
| GET | `/api/board` | Bearer | Fetch full board state |
| POST | `/api/board` | Bearer | Save board state (body: `{ board: BoardDto }`) |
| POST | `/api/ai/chat` | Bearer | AI chat → `{ message, board_update? }` |
| GET | `/{**path}` | No | SPA fallback → `index.html` (must be last) |

---

## Key Implementation Rules (carry over from Python original)

1. **800ms debounce on board saves** — `BoardService.updateBoard()` must debounce. Never reduce this; it prevents write floods during rapid drag-drop interactions.
2. **SPA catch-all last** — `app.MapFallbackToFile("index.html")` must be registered after all API routes or it will shadow them.
3. **AI board update merges** — when `board_update` is non-null in the AI response, call `BoardService.applyAiBoardUpdate()` on the frontend and `BoardService.SaveBoardAsync()` on the backend immediately (no debounce).
4. **Test isolation** — each backend test gets its own Testcontainers MSSQL instance; never share state between tests.
5. **Cascade deletes** — configure EF Core so deleting a Board cascades to Columns, and deleting a Column cascades to Cards.
6. **Auto-migrate on startup** — call `db.Database.Migrate()` inside a scoped service before `app.Run()` so the schema is always up to date in Docker.
