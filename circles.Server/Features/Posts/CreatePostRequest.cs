using System.ComponentModel.DataAnnotations;

namespace circles.Server.Features.Posts;

public class CreatePostRequest
{
    [Required(ErrorMessage = "Post must belong to a valid circle.")]
    public Guid CircleId { get; set; }

    [Required(ErrorMessage = "Post content is required and cannot be empty.")]
    public string Value { get; set; } = string.Empty;

    public List<PostMediaRequest> Media { get; set; } = [];
}

public class PostMediaRequest
{
    [Required]
    public string BlobUrl { get; set; } = string.Empty;

    [Required]
    public string MediaType { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }
}
