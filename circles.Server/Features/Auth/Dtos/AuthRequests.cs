namespace circles.Server.Features.Auth.Dtos;

public record RegisterRequest(string Email, string Password);
public record LoginRequest(string Email, string Password);
