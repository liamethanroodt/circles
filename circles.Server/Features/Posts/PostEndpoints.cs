using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Features.Posts;

public static class PostEndpoints
{
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

        return group;
    }

    private static async Task<IResult> GetAllPosts(CirclesDbContext db)
    {
        var posts = await db.Posts.ToListAsync();
        return Results.Ok(posts);
    }

    private static async Task<IResult> GetPostById(Guid id, CirclesDbContext db)
    {
        var post = await db.Posts.FindAsync(id);
        return post is not null ? Results.Ok(post) : Results.NotFound();
    }

    private static async Task<IResult> GetPostsByCircleId(Guid circleId, CirclesDbContext db)
    {
        var posts = await db.Posts.Where(p => p.CircleId == circleId).ToListAsync();
        return Results.Ok(posts);
    }

    private static async Task<IResult> CreatePost(CreatePostRequest request, CirclesDbContext db)
    {
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
            Value = request.Value
        };

        db.Posts.Add(post);
        await db.SaveChangesAsync();
        return Results.Created($"/api/posts/{post.Id}", post);
    }
}
