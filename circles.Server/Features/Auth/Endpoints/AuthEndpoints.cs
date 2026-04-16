using circles.Server.Features.Auth.Dtos;
using Microsoft.AspNetCore.Identity;

namespace circles.Server.Features.Auth.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/register", Register)
            .WithName("Register");

        group.MapPost("/login", Login)
            .WithName("Login");

        group.MapPost("/logout", Logout)
            .RequireAuthorization()
            .WithName("Logout");

        group.MapGet("/me", GetCurrentUser)
            .WithName("GetCurrentUser");

        return group;
    }

    private static async Task<IResult> Register(RegisterRequest request, UserManager<IdentityUser> userManager)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(new { errors = new[] { "Email and password are required." } });
        }

        var user = new IdentityUser
        {
            UserName = request.Email,
            Email = request.Email
        };

        var result = await userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return Results.BadRequest(new { errors });
        }

        return Results.Ok(new { message = "Registration successful." });
    }

    private static async Task<IResult> Login(
        LoginRequest request,
        SignInManager<IdentityUser> signInManager)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(new { errors = new[] { "Email and password are required." } });
        }

        var result = await signInManager.PasswordSignInAsync(
            request.Email,
            request.Password,
            isPersistent: true,
            lockoutOnFailure: false);

        if (!result.Succeeded)
        {
            return Results.BadRequest(new { errors = new[] { "Invalid email or password." } });
        }

        return Results.Ok(new { isAuthenticated = true, email = request.Email });
    }

    private static async Task<IResult> Logout(SignInManager<IdentityUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return Results.Ok(new { message = "Logged out." });
    }

    private static IResult GetCurrentUser(HttpContext httpContext)
    {
        if (httpContext.User.Identity?.IsAuthenticated == true)
        {
            return Results.Ok(new
            {
                isAuthenticated = true,
                email = httpContext.User.Identity.Name
            });
        }

        return Results.Ok(new { isAuthenticated = false, email = (string?)null });
    }
}