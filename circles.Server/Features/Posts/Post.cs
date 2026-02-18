namespace circles.Server.Features.Posts;

public class Post
{
    public Guid Id { get; set; }
    public Guid CircleId { get; set; }
    public string Value { get; set; } = string.Empty;
}
