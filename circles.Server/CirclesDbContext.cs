using circles.Server.Features.Circles;
using circles.Server.Features.Posts;
using Microsoft.EntityFrameworkCore;

namespace circles.Server;

public class CirclesDbContext : DbContext
{
    public CirclesDbContext(DbContextOptions<CirclesDbContext> options) : base(options)
    {
    }

    public DbSet<Circle> Circles => Set<Circle>();
    public DbSet<Post> Posts => Set<Post>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Circle>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
        });

        modelBuilder.Entity<Post>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Value).IsRequired();
            entity.HasOne<Circle>()
                .WithMany()
                .HasForeignKey(e => e.CircleId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
