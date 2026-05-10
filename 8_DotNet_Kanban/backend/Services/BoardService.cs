using Microsoft.EntityFrameworkCore;

public class BoardService(AppDbContext db)
{
    private const int MaxColumns = 5;

    // ── Board listing ────────────────────────────────────────────────────────

    public async Task<List<BoardSummaryDto>> GetBoardsAsync(int userId)
    {
        return await db.Boards
            .Where(b => b.UserId == userId)
            .OrderByDescending(b => b.UpdatedAt)
            .Select(b => new BoardSummaryDto(
                b.Id.ToString(),
                b.Name,
                b.CreatedAt,
                b.UpdatedAt,
                b.Columns.SelectMany(c => c.Cards).Count()
            ))
            .ToListAsync();
    }

    // ── Get / create board ───────────────────────────────────────────────────

    public async Task<BoardDto> GetBoardAsync(int userId, int? boardId = null)
    {
        Board? board;

        if (boardId.HasValue)
        {
            board = await db.Boards
                .Include(b => b.Columns).ThenInclude(c => c.Cards).ThenInclude(c => c.AssignedToUser)
                .FirstOrDefaultAsync(b => b.Id == boardId && b.UserId == userId);

            if (board is null)
                throw new KeyNotFoundException("Board not found");
        }
        else
        {
            board = await db.Boards
                .Include(b => b.Columns).ThenInclude(c => c.Cards).ThenInclude(c => c.AssignedToUser)
                .Where(b => b.UserId == userId)
                .OrderBy(b => b.CreatedAt)
                .FirstOrDefaultAsync();

            if (board is null)
                board = await SeedDefaultBoardAsync(userId);
        }

        return MapToDto(board);
    }

    // ── Create board ─────────────────────────────────────────────────────────

    public async Task<BoardDto> CreateBoardAsync(int userId, string name)
    {
        var board = new Board
        {
            UserId = userId,
            Name = name,
            Columns =
            [
                new Column { Title = "To Do",       Position = 0, Cards = [] },
                new Column { Title = "In Progress",  Position = 1, Cards = [] },
                new Column { Title = "Done",         Position = 2, Cards = [] }
            ]
        };
        db.Boards.Add(board);
        await db.SaveChangesAsync();

        var loaded = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards).ThenInclude(c => c.AssignedToUser)
            .FirstAsync(b => b.Id == board.Id);
        return MapToDto(loaded);
    }

    // ── Delete board ─────────────────────────────────────────────────────────

    public async Task<bool> DeleteBoardAsync(int userId, int boardId)
    {
        var board = await db.Boards.FirstOrDefaultAsync(b => b.Id == boardId && b.UserId == userId);
        if (board is null) return false;

        db.Boards.Remove(board);
        await db.SaveChangesAsync();
        return true;
    }

    // ── Save board ───────────────────────────────────────────────────────────

    public async Task<BoardDto> SaveBoardAsync(int userId, int boardId, BoardDto dto)
    {
        var board = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards)
            .FirstOrDefaultAsync(b => b.Id == boardId && b.UserId == userId)
            ?? throw new KeyNotFoundException("Board not found");

        board.Name = dto.Name;
        board.UpdatedAt = DateTime.UtcNow;

        if (dto.Columns.Count > MaxColumns)
            dto = dto with { Columns = dto.Columns.Take(MaxColumns).ToList() };

        // --- Pass 1: sync columns ---
        var existingColumns = board.Columns.ToDictionary(c => c.Id);
        var keepColumnIds = dto.Columns
            .Select(c => int.TryParse(c.Id, out var id) ? id : 0)
            .Where(id => id > 0).ToHashSet();

        db.Columns.RemoveRange(existingColumns.Values.Where(c => !keepColumnIds.Contains(c.Id)));

        var syncedColumns = new List<Column>();
        foreach (var colDto in dto.Columns)
        {
            Column col;
            if (int.TryParse(colDto.Id, out var colId) && existingColumns.TryGetValue(colId, out var existing))
                col = existing;
            else
            {
                col = new Column { BoardId = board.Id, Cards = [] };
                db.Columns.Add(col);
            }
            col.Title = colDto.Title;
            col.Position = colDto.Position;
            syncedColumns.Add(col);
        }

        await db.SaveChangesAsync();

        // --- Pass 2: sync cards ---
        for (int i = 0; i < dto.Columns.Count; i++)
        {
            var colDto = dto.Columns[i];
            var col = syncedColumns[i];

            if (!db.Entry(col).Collection(c => c.Cards).IsLoaded)
                await db.Entry(col).Collection(c => c.Cards).LoadAsync();

            var existingCards = col.Cards.ToDictionary(c => c.Id);
            var keepCardIds = colDto.Cards
                .Select(c => int.TryParse(c.Id, out var id) ? id : 0)
                .Where(id => id > 0).ToHashSet();

            db.Cards.RemoveRange(existingCards.Values.Where(c => !keepCardIds.Contains(c.Id)));

            foreach (var cardDto in colDto.Cards)
            {
                Card card;
                if (int.TryParse(cardDto.Id, out var cardId) && existingCards.TryGetValue(cardId, out var existingCard))
                    card = existingCard;
                else
                {
                    card = new Card { ColumnId = col.Id };
                    col.Cards.Add(card);
                }
                card.Title = cardDto.Title;
                card.Details = cardDto.Details;
                card.Position = cardDto.Position;
                card.Priority = Enum.TryParse<CardPriority>(cardDto.Priority, true, out var p) ? p : CardPriority.Medium;
                card.Label = cardDto.Label;
                card.DueDate = cardDto.DueDate;
                card.AssignedToUserId = cardDto.AssignedToUserId;
                card.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        var refreshed = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards).ThenInclude(c => c.AssignedToUser)
            .FirstAsync(b => b.Id == board.Id);

        return MapToDto(refreshed);
    }

    // ── Legacy save (uses first board) for AI endpoint ───────────────────────

    public async Task<BoardDto> SaveBoardAsync(int userId, BoardDto dto)
    {
        if (!int.TryParse(dto.Id, out var boardId))
            throw new InvalidOperationException("Invalid board ID");

        return await SaveBoardAsync(userId, boardId, dto);
    }

    // ── Seed default board ───────────────────────────────────────────────────

    private async Task<Board> SeedDefaultBoardAsync(int userId)
    {
        var board = new Board
        {
            UserId = userId,
            Name = "My Board",
            Columns =
            [
                new Column
                {
                    Title = "To Do", Position = 0,
                    Cards = [new Card { Title = "Welcome!", Details = "Your first card", Position = 0 }]
                },
                new Column { Title = "In Progress", Position = 1, Cards = [] },
                new Column { Title = "Done",        Position = 2, Cards = [] }
            ]
        };
        db.Boards.Add(board);
        await db.SaveChangesAsync();
        return board;
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    public static BoardDto MapToDto(Board board) => new(
        board.Id.ToString(),
        board.Name,
        board.Columns.OrderBy(c => c.Position).Select(col => new ColumnDto(
            col.Id.ToString(),
            col.Title,
            col.Position,
            col.Cards.OrderBy(c => c.Position).Select(card => new CardDto(
                card.Id.ToString(),
                card.Title,
                card.Details,
                card.Position,
                card.Priority.ToString(),
                card.Label,
                card.DueDate,
                card.AssignedToUserId,
                card.AssignedToUser?.Username
            )).ToList()
        )).ToList()
    );
}
