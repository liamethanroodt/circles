namespace circles.Server.Features.Auth.Dtos;

public record RegisterRequest(string Email, string Password, string DisplayName);
public record LoginRequest(string Email, string Password);
public record UpdateProfileRequest(string DisplayName, string? Bio);

public record ConfirmEmailRequest(string UserId, string Token);

