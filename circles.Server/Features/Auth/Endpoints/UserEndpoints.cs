using System.Security.Claims;
using circles.Server.Data;
using circles.Server.Features.Auth.Models;
using circles.Server.Features.Friends.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Features.Auth.Endpoints;

public static class UserEndpoints
{
    public static RouteGroupBuilder MapUserEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/search", SearchUsers)
            .RequireAuthorization()
            .WithName("SearchUsers");

        return group;
    }

    private static async Task<IResult> SearchUsers(
        string email,
        ClaimsPrincipal user,
        UserManager<ApplicationUser> userManager,
        CirclesDbContext db)
    {
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId is null) return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(email))
            return Results.BadRequest(new { errors = new[] { "Email is required." } });

        var found = await userManager.FindByEmailAsync(email);
        if (found is null || !found.EmailConfirmed || found.Id == currentUserId)
            return Results.NotFound();

        var friendship = await db.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == currentUserId && f.AddresseeId == found.Id) ||
            (f.RequesterId == found.Id && f.AddresseeId == currentUserId));

        string? friendshipStatus = friendship?.Status.ToString().ToLower();

        return Results.Ok(new
        {
            userId = found.Id,
            displayName = found.DisplayName,
            profilePictureUrl = found.ProfilePictureUrl,
            friendshipStatus
        });
    }
}
