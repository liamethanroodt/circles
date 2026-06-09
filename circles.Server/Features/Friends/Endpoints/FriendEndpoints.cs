using System.Security.Claims;
using circles.Server.Data;
using circles.Server.Features.Auth.Models;
using circles.Server.Features.Auth.Services;
using circles.Server.Features.Friends.Dtos;
using circles.Server.Features.Friends.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Features.Friends.Endpoints;

public static class FriendEndpoints
{
    public static RouteGroupBuilder MapFriendEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/request", SendFriendRequest)
            .RequireAuthorization()
            .WithName("SendFriendRequest");

        group.MapGet("/", GetFriends)
            .RequireAuthorization()
            .WithName("GetFriends");

        group.MapGet("/requests", GetFriendRequests)
            .RequireAuthorization()
            .WithName("GetFriendRequests");

        group.MapPut("/requests/{id:guid}/accept", AcceptFriendRequest)
            .RequireAuthorization()
            .WithName("AcceptFriendRequest");

        group.MapPut("/requests/{id:guid}/decline", DeclineFriendRequest)
            .RequireAuthorization()
            .WithName("DeclineFriendRequest");

        group.MapDelete("/{userId}", RemoveFriend)
            .RequireAuthorization()
            .WithName("RemoveFriend");

        return group;
    }

    private static async Task<IResult> SendFriendRequest(
        SendFriendRequestRequest request,
        ClaimsPrincipal user,
        UserManager<ApplicationUser> userManager,
        CirclesDbContext db,
        IAppEmailSender emailSender)
    {
        var requesterId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (requesterId is null) return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(request.AddresseeEmail))
            return Results.BadRequest(new { errors = new[] { "Email is required." } });

        var requester = await userManager.FindByIdAsync(requesterId);
        var addressee = await userManager.FindByEmailAsync(request.AddresseeEmail);

        if (addressee is null || !addressee.EmailConfirmed)
            return Results.BadRequest(new { errors = new[] { "No account found with that email address." } });

        if (addressee.Id == requesterId)
            return Results.BadRequest(new { errors = new[] { "You can't send a friend request to yourself." } });

        var existing = await db.Friendships.FirstOrDefaultAsync(f =>
            (f.RequesterId == requesterId && f.AddresseeId == addressee.Id) ||
            (f.RequesterId == addressee.Id && f.AddresseeId == requesterId));

        if (existing is not null)
        {
            if (existing.Status == FriendshipStatus.Accepted)
                return Results.BadRequest(new { errors = new[] { "You are already friends with this user." } });
            if (existing.Status == FriendshipStatus.Pending)
                return Results.BadRequest(new { errors = new[] { "A friend request is already pending." } });

            // Previously declined — allow re-sending by replacing the old record
            db.Friendships.Remove(existing);
        }

        var friendship = new Friendship
        {
            Id = Guid.NewGuid(),
            RequesterId = requesterId,
            AddresseeId = addressee.Id,
            Status = FriendshipStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
        db.Friendships.Add(friendship);
        await db.SaveChangesAsync();

        await emailSender.SendAsync(
            addressee.Email!,
            $"{requester!.DisplayName} wants to be your friend on Circles",
            $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#1e293b">You have a new friend request!</h2>
              <p><strong>{requester.DisplayName}</strong> wants to be your friend on Circles.</p>
              <p>Open the app to accept or decline their request.</p>
            </div>
            """);

        return Results.Ok(new { message = "Friend request sent." });
    }

    private static async Task<IResult> GetFriends(
        ClaimsPrincipal user,
        UserManager<ApplicationUser> userManager,
        CirclesDbContext db)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var friendships = await db.Friendships
            .Where(f => f.Status == FriendshipStatus.Accepted &&
                        (f.RequesterId == userId || f.AddresseeId == userId))
            .ToListAsync();

        var friendIds = friendships
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .ToList();

        var friends = await userManager.Users
            .Where(u => friendIds.Contains(u.Id))
            .Select(u => new FriendDto(u.Id, u.DisplayName, u.ProfilePictureUrl))
            .ToListAsync();

        return Results.Ok(friends);
    }

    private static async Task<IResult> GetFriendRequests(
        ClaimsPrincipal user,
        UserManager<ApplicationUser> userManager,
        CirclesDbContext db)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var pending = await db.Friendships
            .Where(f => f.Status == FriendshipStatus.Pending &&
                        (f.RequesterId == userId || f.AddresseeId == userId))
            .ToListAsync();

        if (pending.Count == 0) return Results.Ok(Array.Empty<FriendRequestDto>());

        var allUserIds = pending
            .SelectMany(f => new[] { f.RequesterId, f.AddresseeId })
            .Distinct()
            .ToList();

        var users = await userManager.Users
            .Where(u => allUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var requests = pending.Select(f => new FriendRequestDto(
            f.Id,
            f.RequesterId,
            users.TryGetValue(f.RequesterId, out var req) ? req.DisplayName : string.Empty,
            users.TryGetValue(f.RequesterId, out var reqPic) ? reqPic.ProfilePictureUrl : null,
            f.AddresseeId,
            users.TryGetValue(f.AddresseeId, out var addr) ? addr.DisplayName : string.Empty,
            users.TryGetValue(f.AddresseeId, out var addrPic) ? addrPic.ProfilePictureUrl : null,
            f.Status.ToString().ToLower(),
            f.RequesterId == userId ? "sent" : "received",
            f.CreatedAt
        )).ToList();

        return Results.Ok(requests);
    }

    private static async Task<IResult> AcceptFriendRequest(
        Guid id,
        ClaimsPrincipal user,
        UserManager<ApplicationUser> userManager,
        CirclesDbContext db,
        IAppEmailSender emailSender)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var friendship = await db.Friendships.FindAsync(id);
        if (friendship is null || friendship.AddresseeId != userId)
            return Results.NotFound();

        if (friendship.Status != FriendshipStatus.Pending)
            return Results.BadRequest(new { errors = new[] { "This request is no longer pending." } });

        friendship.Status = FriendshipStatus.Accepted;
        friendship.RespondedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var accepter = await userManager.FindByIdAsync(userId);
        var requester = await userManager.FindByIdAsync(friendship.RequesterId);
        if (requester?.Email is not null)
        {
            await emailSender.SendAsync(
                requester.Email,
                $"{accepter!.DisplayName} accepted your friend request",
                $"""
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="color:#1e293b">Your friend request was accepted!</h2>
                  <p><strong>{accepter.DisplayName}</strong> is now your friend on Circles.</p>
                </div>
                """);
        }

        return Results.Ok(new { message = "Friend request accepted." });
    }

    private static async Task<IResult> DeclineFriendRequest(
        Guid id,
        ClaimsPrincipal user,
        CirclesDbContext db)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var friendship = await db.Friendships.FindAsync(id);
        if (friendship is null || friendship.AddresseeId != userId)
            return Results.NotFound();

        if (friendship.Status != FriendshipStatus.Pending)
            return Results.BadRequest(new { errors = new[] { "This request is no longer pending." } });

        friendship.Status = FriendshipStatus.Declined;
        friendship.RespondedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Results.Ok(new { message = "Friend request declined." });
    }

    private static async Task<IResult> RemoveFriend(
        string userId,
        ClaimsPrincipal user,
        CirclesDbContext db)
    {
        var currentUserId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (currentUserId is null) return Results.Unauthorized();

        var friendship = await db.Friendships.FirstOrDefaultAsync(f =>
            f.Status == FriendshipStatus.Accepted &&
            ((f.RequesterId == currentUserId && f.AddresseeId == userId) ||
             (f.RequesterId == userId && f.AddresseeId == currentUserId)));

        if (friendship is null) return Results.NotFound();

        db.Friendships.Remove(friendship);
        await db.SaveChangesAsync();

        return Results.NoContent();
    }
}
