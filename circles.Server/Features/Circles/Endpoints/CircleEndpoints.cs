using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using circles.Server.Data;
using circles.Server.Features.Circles.Dtos;
using circles.Server.Features.Circles.Models;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Features.Circles.Endpoints;

public static class CircleEndpoints
{
    public static RouteGroupBuilder MapCircleEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetAllCircles)
            .RequireAuthorization()
            .WithName("GetAllCircles");

        group.MapGet("/{id:guid}", GetCircleById)
            .RequireAuthorization()
            .CacheOutput(policy => policy
                .Expire(TimeSpan.FromMinutes(5))
                .SetVaryByRouteValue("id")
                .Tag("circles"))
            .WithName("GetCircleById");

        group.MapPost("/", CreateCircle)
            .RequireAuthorization()
            .AddEndpointFilter<ValidationFilter>()
            .WithName("CreateCircle");

        group.MapDelete("/{id:guid}/leave", LeaveCircle)
            .RequireAuthorization()
            .WithName("LeaveCircle");

        return group;
    }

    private static async Task<IResult> GetAllCircles(ClaimsPrincipal user, CirclesDbContext db)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var circles = await db.CircleMembers
            .Where(m => m.UserId == userId)
            .Select(m => m.Circle)
            .ToListAsync();

        return Results.Ok(circles);
    }

    private static async Task<IResult> GetCircleById(Guid id, ClaimsPrincipal user, CirclesDbContext db)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var isMember = await db.CircleMembers.AnyAsync(m => m.CircleId == id && m.UserId == userId);
        if (!isMember) return Results.NotFound();

        var circle = await db.Circles.FindAsync(id);
        return circle is not null ? Results.Ok(circle) : Results.NotFound();
    }

    private static async Task<IResult> CreateCircle(CreateCircleRequest request, ClaimsPrincipal user, CirclesDbContext db, IOutputCacheStore cache)
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

        var circle = new Circle
        {
            Id = Guid.NewGuid(),
            Name = request.Name
        };

        db.Circles.Add(circle);

        db.CircleMembers.Add(new CircleMember
        {
            CircleId = circle.Id,
            UserId = userId,
            Role = CircleMemberRole.Owner,
            JoinedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        await cache.EvictByTagAsync("circles", default);

        return Results.Created($"/api/circles/{circle.Id}", circle);
    }

    private static async Task<IResult> LeaveCircle(Guid id, ClaimsPrincipal user, CirclesDbContext db, IOutputCacheStore cache)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var membership = await db.CircleMembers.FirstOrDefaultAsync(m => m.CircleId == id && m.UserId == userId);
        if (membership is null) return Results.NotFound();

        db.CircleMembers.Remove(membership);

        // If the leaving user was the owner, transfer ownership to the next member by join date
        if (membership.Role == CircleMemberRole.Owner)
        {
            var nextMember = await db.CircleMembers
                .Where(m => m.CircleId == id && m.UserId != userId)
                .OrderBy(m => m.JoinedAt)
                .FirstOrDefaultAsync();

            if (nextMember is not null)
            {
                nextMember.Role = CircleMemberRole.Owner;
            }
            else
            {
                // No remaining members — delete the circle (cascade removes posts/media)
                var circle = await db.Circles.FindAsync(id);
                if (circle is not null) db.Circles.Remove(circle);
            }
        }

        await db.SaveChangesAsync();
        await cache.EvictByTagAsync("circles", default);

        return Results.NoContent();
    }
}
