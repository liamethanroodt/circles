using Microsoft.AspNetCore.Identity;

namespace circles.Server.Features.Auth.Models;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;
    public string? Bio { get; set; }
    public string? ProfilePictureUrl { get; set; }
}
