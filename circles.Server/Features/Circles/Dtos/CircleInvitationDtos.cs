namespace circles.Server.Features.Circles.Dtos;

public record SendCircleInvitationRequest(string InviteeId);

public record CircleInvitationDto(
    Guid Id,
    Guid CircleId,
    string CircleName,
    string InviterId,
    string InviterDisplayName,
    string? InviterProfilePictureUrl,
    DateTime CreatedAt);
