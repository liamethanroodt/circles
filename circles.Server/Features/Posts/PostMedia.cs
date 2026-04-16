namespace circles.Server.Features.Posts;

public class PostMedia
{
    public Guid Id { get; set; }
    public Guid PostId { get; set; }
    public Post Post { get; set; } = null!;
    public string BlobUrl { get; set; } = string.Empty;

    // "image" or "video"
    public string MediaType { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
