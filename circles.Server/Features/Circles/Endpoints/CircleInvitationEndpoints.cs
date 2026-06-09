using System.Security.Claims;
using circles.Server.Data;
using circles.Server.Features.Auth.Models;
using circles.Server.Features.Auth.Services;
using circles.Server.Features.Circles.Dtos;
using circles.Server.Features.Circles.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.EntityFrameworkCore;

namespace circles.Server.Features.Circles.Endpoints;

public static class CircleInvitationEndpoints
{
    /// <summary>
    /// Registers the invite-send endpoint on the /circles group:
    ///   POST /api/circles/{circleId}/invitations
    /// </summary>
    public static RouteGroupBuilder MapCircleInvitationSendEndpoint(this RouteGroupBuilder group)
    {
        group.MapPost("/{circleId:guid}/invitations", SendInvitation)
            .RequireAuthorization()
            .WithName("SendCircleInvitation");

        return group;
    }

    /// <summary>
    /// Registers the invitation management endpoints on the /invitations group:
    ///   GET    /api/invitations
    ///   PUT    /api/invitations/{id}/accept
    ///   PUT    /api/invitations/{id}/decline
    /// </summary>
    public static RouteGroupBuilder MapInvitationEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetInvitations)
            .RequireAuthorization()
            .WithName("GetInvitations");

        group.MapPut("/{id:guid}/accept", AcceptInvitation)
            .RequireAuthorization()
            .WithName("AcceptInvitation");

        group.MapPut("/{id:guid}/decline", DeclineInvitation)
            .RequireAuthorization()
            .WithName("DeclineInvitation");

        return group;
    }

    private static async Task<IResult> SendInvitation(
        Guid circleId,
        SendCircleInvitationRequest request,
        ClaimsPrincipal user,
        UserManager<ApplicationUser> userManager,
        CirclesDbContext db,
        IAppEmailSender emailSender)
    {
        var inviterId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (inviterId is null) return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(request.InviteeId))
            return Results.BadRequest(new { errors = new[] { "InviteeId is required." } });

        var isMember = await db.CircleMembers.AnyAsync(m => m.CircleId == circleId && m.UserId == inviterId);
        if (!isMember) return Results.NotFound();

        var invitee = await userManager.FindByIdAsync(request.InviteeId);
        if (invitee is null || !invitee.EmailConfirmed)
            return Results.BadRequest(new { errors = new[] { "User not found." } });

        if (invitee.Id == inviterId)
            return Results.BadRequest(new { errors = new[] { "You can't invite yourself." } });

        var alreadyMember = await db.CircleMembers.AnyAsync(m => m.CircleId == circleId && m.UserId == invitee.Id);
        if (alreadyMember)
            return Results.BadRequest(new { errors = new[] { "This user is already a member of this circle." } });

        var alreadyInvited = await db.CircleInvitations.AnyAsync(i =>
            i.CircleId == circleId && i.InviteeId == invitee.Id && i.Status == InvitationStatus.Pending);
        if (alreadyInvited)
            return Results.BadRequest(new { errors = new[] { "This user already has a pending invitation to this circle." } });

        var circle = await db.Circles.FindAsync(circleId);
        var inviter = await userManager.FindByIdAsync(inviterId);

        var invitation = new CircleInvitation
        {
            Id = Guid.NewGuid(),
            CircleId = circleId,
            InviterId = inviterId,
            InviteeId = invitee.Id,
            Status = InvitationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
        db.CircleInvitations.Add(invitation);
        await db.SaveChangesAsync();

        await emailSender.SendAsync(
            invitee.Email!,
            $"{inviter!.DisplayName} invited you to join \"{circle!.Name}\" on Circles",
            $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#1e293b">You've been invited to a circle!</h2>
              <p><strong>{inviter.DisplayName}</strong> has invited you to join the circle <strong>{circle.Name}</strong> on Circles.</p>
              <p>Open the app to accept or decline the invitation.</p>
            </div>
            """);

        return Results.Ok(new { message = "Invitation sent." });
    }

    private static async Task<IResult> GetInvitations(
        ClaimsPrincipal user,
        UserManager<ApplicationUser> userManager,
        CirclesDbContext db)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var invitations = await db.CircleInvitations
            .Include(i => i.Circle)
            .Where(i => i.InviteeId == userId && i.Status == InvitationStatus.Pending)
            .ToListAsync();

        if (invitations.Count == 0) return Results.Ok(Array.Empty<CircleInvitationDto>());

        var inviterIds = invitations.Select(i => i.InviterId).Distinct().ToList();
        var inviters = await userManager.Users
            .Where(u => inviterIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var result = invitations.Select(i => new CircleInvitationDto(
            i.Id,
            i.CircleId,
            i.Circle.Name,
            i.InviterId,
            inviters.TryGetValue(i.InviterId, out var inviter) ? inviter.DisplayName : string.Empty,
            inviters.TryGetValue(i.InviterId, out var inviterPic) ? inviterPic.ProfilePictureUrl : null,
            i.CreatedAt
        )).ToList();

        return Results.Ok(result);
    }

    private static async Task<IResult> AcceptInvitation(
        Guid id,
        ClaimsPrincipal user,
        CirclesDbContext db,
        IOutputCacheStore cache)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var invitation = await db.CircleInvitations.FindAsync(id);
        if (invitation is null || invitation.InviteeId != userId)
            return Results.NotFound();

        if (invitation.Status != InvitationStatus.Pending)
            return Results.BadRequest(new { errors = new[] { "This invitation is no longer pending." } });

        var alreadyMember = await db.CircleMembers.AnyAsync(m =>
            m.CircleId == invitation.CircleId && m.UserId == userId);

        if (!alreadyMember)
        {
            db.CircleMembers.Add(new CircleMember
            {
                CircleId = invitation.CircleId,
                UserId = userId,
                Role = CircleMemberRole.Member,
                JoinedAt = DateTime.UtcNow
            });
        }

        invitation.Status = InvitationStatus.Accepted;
        invitation.RespondedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        await cache.EvictByTagAsync("circles", default);

        return Results.Ok(new { message = "Invitation accepted.", circleId = invitation.CircleId });
    }

    private static async Task<IResult> DeclineInvitation(
        Guid id,
        ClaimsPrincipal user,
        CirclesDbContext db)
    {
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
        if (userId is null) return Results.Unauthorized();

        var invitation = await db.CircleInvitations.FindAsync(id);
        if (invitation is null || invitation.InviteeId != userId)
            return Results.NotFound();

        if (invitation.Status != InvitationStatus.Pending)
            return Results.BadRequest(new { errors = new[] { "This invitation is no longer pending." } });

        invitation.Status = InvitationStatus.Declined;
        invitation.RespondedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Results.Ok(new { message = "Invitation declined." });
    }
}
