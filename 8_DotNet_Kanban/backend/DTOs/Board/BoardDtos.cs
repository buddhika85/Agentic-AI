public record CardDto(
    string Id,
    string Title,
    string Details,
    int Position,
    string Priority,
    string Label,
    DateTime? DueDate,
    int? AssignedToUserId,
    string? AssignedToUsername
);

public record ColumnDto(string Id, string Title, int Position, List<CardDto> Cards);

public record BoardDto(string Id, string Name, List<ColumnDto> Columns);

public record BoardSummaryDto(string Id, string Name, DateTime CreatedAt, DateTime UpdatedAt, int CardCount);

public record SaveBoardRequest(BoardDto Board);

public record CreateBoardRequest(string Name);
