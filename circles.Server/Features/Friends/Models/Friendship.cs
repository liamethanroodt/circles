namespace circles.Server.Features.Friends.Models;

public enum FriendshipStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2
}

public class Friendship
{
    public Guid Id { get; set; }
    public string RequesterId { get; set; } = string.Empty;
    public string AddresseeId { get; set; } = string.Empty;
    public FriendshipStatus Status { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}
