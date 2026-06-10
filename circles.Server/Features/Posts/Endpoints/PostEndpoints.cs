using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using circles.Server.Data;
using circles.Server.Features.Auth.Models;
using circles.Server.Features.Posts.Dtos;
using circles.Server.Features.Posts.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Features.Posts.Endpoints;

public static class PostEndpoints
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".webm"];
    private static readonly string[] VideoExtensions = [".mp4", ".mov", ".webm"];
    private const string ContainerName = "post-media";

    public static RouteGroupBuilder MapPostEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetAllPosts)
            .WithName("GetAllPosts");

        group.MapGet("/{id:guid}", GetPostById)
            .WithName("GetPostById");

        group.MapGet("/circle/{circleId:guid}", GetPostsByCircleId)
            .WithName("GetPostsByCircleId");

        group.MapPost("/", CreatePost)
            .AddEndpointFilter<ValidationFilter>()
            .WithName("CreatePost");

        group.MapGet("/media/upload-url", GetUploadUrl)
            .WithName("GetUploadUrl");

        return group;
    }

    private static async Task<IResult> GetAllPosts(CirclesDbContext db)
    {
        var posts = await db.Posts.Include(p => p.Media.OrderBy(m => m.DisplayOrder)).ToListAsync();
        return Results.Ok(posts);
    }

    private static async Task<IResult> GetPostById(Guid id, CirclesDbContext db)
    {
        var post = await db.Posts.Include(p => p.Media.OrderBy(m => m.DisplayOrder)).FirstOrDefaultAsync(p => p.Id == id);
        return post is not null ? Results.Ok(post) : Results.NotFound();
    }

    private static async Task<IResult> GetPostsByCircleId(Guid circleId, CirclesDbContext db, UserManager<ApplicationUser> userManager)
    {
        var posts = await db.Posts
            .Include(p => p.Media.OrderBy(m => m.DisplayOrder))
            .Where(p => p.CircleId == circleId)
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        if (posts.Count == 0) return Results.Ok(Array.Empty<PostDto>());

        var userIds = posts.Select(p => p.UserId).Distinct().ToList();
        var users = await userManager.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var result = posts.Select(p =>
        {
            users.TryGetValue(p.UserId, out var author);
            return new PostDto(
                p.Id,
                p.CircleId,
                p.Value,
                p.UserId,
                author?.DisplayName ?? string.Empty,
                author?.ProfilePictureUrl,
                p.CreatedAt,
                p.Media.Select(m => new PostMediaDto(m.Id, m.BlobUrl, m.MediaType, m.DisplayOrder)).ToList()
            );
        }).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> CreatePost(CreatePostRequest request, CirclesDbContext db, ClaimsPrincipal user)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var validationResults = new List<ValidationResult>();
        var validationContext = new ValidationContext(request);

        if (!Validator.TryValidateObject(request, validationContext, validationResults, true))
        {
            var errors = validationResults.Select(v => v.ErrorMessage);
            return Results.BadRequest(new { errors });
        }

        var circleExists = await db.Circles.AnyAsync(c => c.Id == request.CircleId);
        if (!circleExists)
        {
            return Results.BadRequest(new { errors = new[] { $"Circle with ID '{request.CircleId}' does not exist." } });
        }

        var post = new Post
        {
            Id = Guid.NewGuid(),
            CircleId = request.CircleId,
            UserId = userId,
            CreatedAt = DateTime.UtcNow,
            Value = request.Value,
            Media = request.Media.Select((m, i) => new PostMedia
            {
                Id = Guid.NewGuid(),
                BlobUrl = m.BlobUrl,
                MediaType = m.MediaType,
                DisplayOrder = m.DisplayOrder == 0 ? i : m.DisplayOrder
            }).ToList()
        };

        db.Posts.Add(post);
        await db.SaveChangesAsync();
        return Results.Created($"/api/posts/{post.Id}", post);
    }

    private static async Task<IResult> GetUploadUrl(string fileName, BlobServiceClient blobServiceClient)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();

        if (!AllowedExtensions.Contains(extension))
            return Results.BadRequest(new { errors = new[] { "File type not allowed. Allowed: jpg, png, gif, webp, mp4, mov, webm." } });

        var containerClient = blobServiceClient.GetBlobContainerClient(ContainerName);
        await containerClient.CreateIfNotExistsAsync(Azure.Storage.Blobs.Models.PublicAccessType.Blob);

        var blobName = $"{Guid.NewGuid()}{extension}";
        var blobClient = containerClient.GetBlobClient(blobName);

        var sasUri = blobClient.GenerateSasUri(
            BlobSasPermissions.Write | BlobSasPermissions.Create,
            DateTimeOffset.UtcNow.AddMinutes(5));

        var mediaType = VideoExtensions.Contains(extension) ? "video" : "image";

        return Results.Ok(new
        {
            uploadUrl = sasUri.ToString(),
            blobUrl = blobClient.Uri.ToString(),
            mediaType
        });
    }
}
