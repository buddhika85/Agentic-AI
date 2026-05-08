using Microsoft.EntityFrameworkCore;

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
    }
}
