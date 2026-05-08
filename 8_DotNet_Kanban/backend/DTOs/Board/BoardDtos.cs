public record CardDto(string Id, string Title, string Details, int Position);
public record ColumnDto(string Id, string Title, int Position, List<CardDto> Cards);
public record BoardDto(string Id, string Name, List<ColumnDto> Columns);
public record SaveBoardRequest(BoardDto Board);
