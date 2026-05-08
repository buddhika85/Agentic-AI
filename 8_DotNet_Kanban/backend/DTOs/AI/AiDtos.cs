public record ChatRequest(string Message);
public record ChatResponse(string Message, BoardDto? BoardUpdate);
