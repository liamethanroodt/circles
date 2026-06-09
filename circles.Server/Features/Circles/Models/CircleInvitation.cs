namespace circles.Server.Features.Circles.Models;

public enum InvitationStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}

public class CircleInvitation
{
    public Guid Id { get; set; }
    public Guid CircleId { get; set; }
    public Circle Circle { get; set; } = null!;
    public string InviterId { get; set; } = string.Empty;
    public string InviteeId { get; set; } = string.Empty;
    public InvitationStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}
