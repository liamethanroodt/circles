using System.Text;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;
using circles.Server.Features.Auth.Dtos;
using circles.Server.Features.Auth.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;

namespace circles.Server.Features.Auth.Endpoints;

public static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/register", Register)
            .WithName("Register");

        group.MapPost("/login", Login)
            .WithName("Login");

        group.MapPost("/confirm-email", ConfirmEmail)
            .WithName("ConfirmEmail");

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

    /// <summary>
    /// Creates a new account and sends a confirmation email.
    ///
    /// Steps:
    /// 1. Create the <see cref="ApplicationUser"/> record with <c>EmailConfirmed = false</c>.
    /// 2. Ask <see cref="UserManager{TUser}"/> for a data-protected email confirmation token.
    ///    Under the hood this uses ASP.NET Core Data Protection (registered via AddDefaultTokenProviders)
    ///    to create a time-limited, purpose-scoped token tied to the user's current security stamp.
    /// 3. Base64Url-encode both the user ID and the token so they are safe to embed in a URL
    ///    query string without further percent-encoding.
    /// 4. Build the confirmation link pointing at the frontend's /confirm-email page.
    /// 5. Delegate the actual email send to <see cref="IEmailSender{TUser}"/>, which in
    ///    development delivers to MailPit and in production uses a real SMTP relay.
    /// </summary>
    private static async Task<IResult> Register(
        RegisterRequest request,
        UserManager<ApplicationUser> userManager,
        IEmailSender<ApplicationUser> emailSender,
        IConfiguration configuration)
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

        // Generate a data-protected confirmation token. ASP.NET Core Identity stores a
        // SecurityStamp on the user; the token embeds that stamp so the token is
        // automatically invalidated if the user changes their password or email.
        var rawToken = await userManager.GenerateEmailConfirmationTokenAsync(user);

        // WebEncoders.Base64UrlEncode converts the UTF-8 bytes of the token into a
        // URL-safe Base64 string (RFC 4648 §5) — no '+', '/', or '=' characters that
        // would require percent-encoding in a query string.
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(rawToken));
        var encodedUserId = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(user.Id));

        // AppSettings:FrontendUrl is set to the real domain in production and to the
        // Vite dev-server URL by .NET Aspire during development.
        var frontendUrl = (configuration["AppSettings:FrontendUrl"] ?? string.Empty).TrimEnd('/');
        var confirmationLink = $"{frontendUrl}/confirm-email?userId={encodedUserId}&token={encodedToken}";

        await emailSender.SendConfirmationLinkAsync(user, user.Email!, confirmationLink);

        return Results.Ok(new { message = "Registration successful. Please check your email to confirm your account." });
    }

    /// <summary>
    /// Verifies the confirmation token and marks the user's email as confirmed.
    ///
    /// Called by the frontend's /confirm-email page immediately after it mounts.
    /// Steps:
    /// 1. Base64Url-decode the user ID and token that were embedded in the email link.
    /// 2. Look up the user by ID.
    /// 3. Call <see cref="UserManager{TUser}.ConfirmEmailAsync"/> which re-derives the
    ///    data-protected token and checks it against the stored SecurityStamp.
    ///    If valid, it sets <c>EmailConfirmed = true</c> in the database.
    /// </summary>
    private static async Task<IResult> ConfirmEmail(
        ConfirmEmailRequest request,
        UserManager<ApplicationUser> userManager)
    {
        if (string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Token))
        {
            return Results.BadRequest(new { errors = new[] { "Invalid confirmation link." } });
        }

        string userId;
        string token;

        try
        {
            userId = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.UserId));
            token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token));
        }
        catch (FormatException)
        {
            return Results.BadRequest(new { errors = new[] { "Invalid confirmation link." } });
        }

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            // Return the same generic message to avoid disclosing whether the user exists.
            return Results.BadRequest(new { errors = new[] { "Invalid confirmation link." } });
        }

        var result = await userManager.ConfirmEmailAsync(user, token);
        if (!result.Succeeded)
        {
            var errors = result.Errors.Select(e => e.Description).ToArray();
            return Results.BadRequest(new { errors });
        }

        return Results.Ok(new { message = "Email confirmed successfully." });
    }

    /// <summary>
    /// Signs in an existing user using cookie-based authentication.
    ///
    /// <see cref="SignInManager{TUser}.PasswordSignInAsync"/> checks three things:
    /// 1. <c>IsNotAllowed</c> — true when <c>RequireConfirmedEmail = true</c> and
    ///    <c>EmailConfirmed = false</c>. We surface a clear, actionable error here.
    /// 2. <c>IsLockedOut</c> — not enabled in this app but handled defensively.
    /// 3. <c>Succeeded</c> — credentials are valid and all sign-in requirements are met.
    /// </summary>
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

        if (result.IsNotAllowed)
        {
            // The user exists and the password is correct, but their email is not yet confirmed.
            // Give a specific message so the user knows to check their inbox.
            return Results.BadRequest(new { errors = new[] { "Please confirm your email address before signing in." }, emailUnconfirmed = true });
        }

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
