namespace circles.Server.Features.Circles.Models;

public enum CircleMemberRole
{
    Member,
    Owner
}

public class CircleMember
{
    public Guid CircleId { get; set; }
    public Circle Circle { get; set; } = null!;

    public string UserId { get; set; } = string.Empty;

    public CircleMemberRole Role { get; set; }

    public DateTime JoinedAt { get; set; }
}
