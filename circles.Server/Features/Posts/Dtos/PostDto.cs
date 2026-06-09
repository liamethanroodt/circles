namespace circles.Server.Features.Posts.Dtos;

public record PostDto(
    Guid Id,
    Guid CircleId,
    string Value,
    string AuthorId,
    string AuthorDisplayName,
    string? AuthorProfilePictureUrl,
    DateTime CreatedAt,
    List<PostMediaDto> Media
);

public record PostMediaDto(
    Guid Id,
    string BlobUrl,
    string MediaType,
    int DisplayOrder
);
