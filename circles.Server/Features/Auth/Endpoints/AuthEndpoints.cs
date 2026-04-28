using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using circles.Server.Features.Auth.Dtos;
using circles.Server.Features.Auth.Models;
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

        group.MapPut("/profile", UpdateProfile)
            .RequireAuthorization()
            .WithName("UpdateProfile");

        group.MapGet("/profile/picture-upload-url", GetProfilePictureUploadUrl)
            .RequireAuthorization()
            .WithName("GetProfilePictureUploadUrl");

        return group;
    }

    private static async Task<IResult> Register(RegisterRequest request, UserManager<ApplicationUser> userManager)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return Results.BadRequest(new { errors = new[] { "Email and password are required." } });
        }

        var user = new ApplicationUser
        {
            UserName = request.Email,
            Email = request.Email,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? request.Email : request.DisplayName
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
        SignInManager<ApplicationUser> signInManager)
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

    private static async Task<IResult> Logout(SignInManager<ApplicationUser> signInManager)
    {
        await signInManager.SignOutAsync();
        return Results.Ok(new { message = "Logged out." });
    }

    private static async Task<IResult> GetCurrentUser(HttpContext httpContext, UserManager<ApplicationUser> userManager)
    {
        if (httpContext.User.Identity?.IsAuthenticated != true)
        {
            return Results.Ok(new { isAuthenticated = false, email = (string?)null });
        }

        var user = await userManager.GetUserAsync(httpContext.User);
        if (user is null)
        {
            return Results.Ok(new { isAuthenticated = false, email = (string?)null });
        }

        return Results.Ok(new
        {
            isAuthenticated = true,
            email = user.Email,
            displayName = user.DisplayName,
            bio = user.Bio,
            profilePictureUrl = user.ProfilePictureUrl
        });
    }

    private static async Task<IResult> UpdateProfile(
        UpdateProfileRequest request,
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager)
    {
        var user = await userManager.GetUserAsync(httpContext.User);
        if (user is null) return Results.Unauthorized();

        if (string.IsNullOrWhiteSpace(request.DisplayName))
        {
            return Results.BadRequest(new { errors = new[] { "Display name is required." } });
        }

        user.DisplayName = request.DisplayName;
        user.Bio = request.Bio;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return Results.BadRequest(new { errors });
        }

        return Results.Ok(new
        {
            displayName = user.DisplayName,
            bio = user.Bio,
            profilePictureUrl = user.ProfilePictureUrl
        });
    }

    private static async Task<IResult> GetProfilePictureUploadUrl(
        HttpContext httpContext,
        UserManager<ApplicationUser> userManager,
        BlobServiceClient blobServiceClient)
    {
        var user = await userManager.GetUserAsync(httpContext.User);
        if (user is null) return Results.Unauthorized();

        const string containerName = "profile-pictures";
        var containerClient = blobServiceClient.GetBlobContainerClient(containerName);
        await containerClient.CreateIfNotExistsAsync(Azure.Storage.Blobs.Models.PublicAccessType.Blob);

        var blobName = $"{user.Id}/profile.jpg";
        var blobClient = containerClient.GetBlobClient(blobName);

        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = containerName,
            BlobName = blobName,
            Resource = "b",
            ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(5),
            ContentType = "image/jpeg"
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Write | BlobSasPermissions.Create);

        var sasUri = blobClient.GenerateSasUri(sasBuilder);

        var publicUrl = blobClient.Uri.ToString();

        // Save the permanent URL to the user's profile
        user.ProfilePictureUrl = publicUrl;
        await userManager.UpdateAsync(user);

        return Results.Ok(new { uploadUrl = sasUri.ToString(), publicUrl });
    }
}
