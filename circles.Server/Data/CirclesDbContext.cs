using circles.Server.Features.Auth.Models;
using circles.Server.Features.Circles.Models;
using circles.Server.Features.Posts.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Data;

public class CirclesDbContext : IdentityDbContext<ApplicationUser>
{
    public CirclesDbContext(DbContextOptions<CirclesDbContext> options) : base(options)
    {
    }

    public DbSet<Circle> Circles => Set<Circle>();
    public DbSet<CircleMember> CircleMembers => Set<CircleMember>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<PostMedia> PostMedia => Set<PostMedia>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<CircleMember>(entity =>
        {
            entity.HasKey(e => new { e.CircleId, e.UserId });
            entity.Property(e => e.Role).IsRequired();
            entity.Property(e => e.JoinedAt).IsRequired();
            entity.HasOne(e => e.Circle)
                .WithMany()
                .HasForeignKey(e => e.CircleId)
                .OnDelete(DeleteBehavior.Cascade);
        });

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
            entity.HasMany(e => e.Media)
                .WithOne(e => e.Post)
                .HasForeignKey(e => e.PostId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PostMedia>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.BlobUrl).IsRequired();
            entity.Property(e => e.MediaType).IsRequired().HasMaxLength(10);
        });
    }
}
