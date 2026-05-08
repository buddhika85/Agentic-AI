using Microsoft.EntityFrameworkCore;

public class BoardService(AppDbContext db)
{
    public async Task<BoardDto> GetBoardAsync(int userId)
    {
        var board = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards)
            .FirstOrDefaultAsync(b => b.UserId == userId);

        if (board is null)
            board = await SeedDefaultBoardAsync(userId);

        return MapToDto(board);
    }

    public async Task<BoardDto> SaveBoardAsync(int userId, BoardDto dto)
    {
        var board = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards)
            .FirstOrDefaultAsync(b => b.UserId == userId)
            ?? throw new InvalidOperationException("Board not found");

        board.Name = dto.Name;
        board.UpdatedAt = DateTime.UtcNow;

        const int MaxColumns = 5;
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

        // Flush so new columns get database IDs before we add cards
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
                card.UpdatedAt = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync();

        var refreshed = await db.Boards
            .Include(b => b.Columns).ThenInclude(c => c.Cards)
            .FirstAsync(b => b.Id == board.Id);

        return MapToDto(refreshed);
    }

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
                    Cards = [ new Card { Title = "Welcome!", Details = "Your first card", Position = 0 } ]
                },
                new Column { Title = "In Progress", Position = 1, Cards = [] },
                new Column { Title = "Done",        Position = 2, Cards = [] }
            ]
        };
        db.Boards.Add(board);
        await db.SaveChangesAsync();
        return board;
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
