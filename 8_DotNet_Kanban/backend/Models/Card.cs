public enum CardPriority { Low, Medium, High }

public class Card
{
    public int Id { get; set; }
    public int ColumnId { get; set; }
    public Column Column { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Details { get; set; } = "";
    public int Position { get; set; }
    public CardPriority Priority { get; set; } = CardPriority.Medium;
    public string Label { get; set; } = "";
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
