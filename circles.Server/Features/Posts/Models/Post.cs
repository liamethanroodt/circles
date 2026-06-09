namespace circles.Server.Features.Posts.Models;

public class Post
{
    public Guid Id { get; set; }
    public Guid CircleId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string Value { get; set; } = string.Empty;
    public ICollection<PostMedia> Media { get; set; } = [];
}
