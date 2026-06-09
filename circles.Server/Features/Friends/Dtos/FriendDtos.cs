namespace circles.Server.Features.Friends.Dtos;

public record SendFriendRequestRequest(string AddresseeEmail);

public record FriendDto(
    string UserId,
    string DisplayName,
    string? ProfilePictureUrl);

public record FriendRequestDto(
    Guid Id,
    string RequesterId,
    string RequesterDisplayName,
    string? RequesterProfilePictureUrl,
    string AddresseeId,
    string AddresseeDisplayName,
    string? AddresseeProfilePictureUrl,
    string Status,
    string Direction,
    DateTime CreatedAt);
