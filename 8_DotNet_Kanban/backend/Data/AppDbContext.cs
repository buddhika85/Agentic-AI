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

        mb.Entity<User>()
            .HasIndex(u => u.Username).IsUnique();

        mb.Entity<User>()
            .HasIndex(u => u.Email).IsUnique();

        mb.Entity<User>()
            .Property(u => u.Role)
            .HasConversion<string>();

        mb.Entity<Card>()
            .Property(c => c.Priority)
            .HasConversion<string>();

        mb.Entity<Column>()
            .HasOne(c => c.Board).WithMany(b => b.Columns)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<Card>()
            .HasOne(c => c.Column).WithMany(col => col.Cards)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
