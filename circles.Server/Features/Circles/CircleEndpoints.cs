using System.ComponentModel.DataAnnotations;
using circles.Server.Data;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Features.Circles;

public static class CircleEndpoints
{
    public static RouteGroupBuilder MapCircleEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetAllCircles)
            .CacheOutput(policy => policy
                .Expire(TimeSpan.FromMinutes(5))
                .Tag("circles"))
            .WithName("GetAllCircles");

        group.MapGet("/{id:guid}", GetCircleById)
            .CacheOutput(policy => policy
                .Expire(TimeSpan.FromMinutes(5))
                .SetVaryByRouteValue("id")
                .Tag("circles"))
            .WithName("GetCircleById");

        group.MapPost("/", CreateCircle)
            .AddEndpointFilter<ValidationFilter>()
            .WithName("CreateCircle");

        return group;
    }

    private static async Task<IResult> GetAllCircles(CirclesDbContext db)
    {
        var circles = await db.Circles.ToListAsync();
        return Results.Ok(circles);
    }

    private static async Task<IResult> GetCircleById(Guid id, CirclesDbContext db)
    {
        var circle = await db.Circles.FindAsync(id);
        return circle is not null ? Results.Ok(circle) : Results.NotFound();
    }

    private static async Task<IResult> CreateCircle(CreateCircleRequest request, CirclesDbContext db, IOutputCacheStore cache)
    {
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
        await db.SaveChangesAsync();

        // Clear the cache so fresh data is fetched
        await cache.EvictByTagAsync("circles", default);

        return Results.Created($"/api/circles/{circle.Id}", circle);
    }
}
