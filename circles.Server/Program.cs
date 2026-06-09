using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using circles.Server.Data;
using circles.Server.Features.Auth.Endpoints;
using circles.Server.Features.Auth.Models;
using circles.Server.Features.Auth.Services;
using circles.Server.Features.Circles.Endpoints;
using circles.Server.Features.Friends.Endpoints;
using circles.Server.Features.Posts.Endpoints;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();
builder.AddRedisClientBuilder("cache")
    .WithOutputCache();
builder.AddSqlServerClient("circlesdb");
builder.AddAzureBlobServiceClient("blobs");

// Add DbContext
builder.Services.AddDbContext<CirclesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("circlesdb")));

// Bind SMTP settings from the "SmtpSettings" configuration section.
// In development these are partially overridden by the MailPit connection string that
// .NET Aspire injects; in production set real SMTP values here or via environment variables.
builder.Services.Configure<SmtpSettings>(builder.Configuration.GetSection("SmtpSettings"));

// Register our MailKit-based email sender. ASP.NET Core Identity resolves
// IEmailSender<ApplicationUser> internally and we also inject it explicitly in endpoints.
builder.Services.AddTransient<IEmailSender<ApplicationUser>, EmailSender>();
builder.Services.AddTransient<IAppEmailSender, EmailSender>();

// Add Identity
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.SignIn.RequireConfirmedEmail = true;
})
.AddEntityFrameworkStores<CirclesDbContext>()
.AddDefaultTokenProviders();

// Configure cookie authentication
builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromDays(7);
    options.SlidingExpiration = true;
    options.Events.OnRedirectToLogin = context =>
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return Task.CompletedTask;
    };
    options.Events.OnRedirectToAccessDenied = context =>
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return Task.CompletedTask;
    };
});

builder.Services.AddAuthorization();

// Add services to the container.
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        if (context.HttpContext.Response.StatusCode == 400)
        {
            var endpoint = context.HttpContext.GetEndpoint();
            if (endpoint != null && context.Exception != null)
            {
                context.ProblemDetails.Extensions["errors"] = new[]
                {
                    $"Invalid request format. Please ensure all fields have the correct data types. Error: {context.Exception.Message}"
                };
            }
        }
    };
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

var app = builder.Build();

// Apply database migrations automatically
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CirclesDbContext>();
    dbContext.Database.Migrate();
}

// Configure Azurite CORS in development so the browser can PUT directly to blob storage
if (app.Environment.IsDevelopment())
{
    var blobServiceClient = app.Services.GetRequiredService<BlobServiceClient>();
    var properties = await blobServiceClient.GetPropertiesAsync();
    properties.Value.Cors.Clear();
    properties.Value.Cors.Add(new BlobCorsRule
    {
        AllowedOrigins = "*",
        AllowedMethods = "PUT,GET,OPTIONS",
        AllowedHeaders = "*",
        ExposedHeaders = "*",
        MaxAgeInSeconds = 86400
    });
    await blobServiceClient.SetPropertiesAsync(properties.Value);
}

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference();
}

app.UseAuthentication();
app.UseAuthorization();
app.UseOutputCache();

var api = app.MapGroup("/api");

// Map auth endpoints (public)
api.MapGroup("/auth").MapAuthEndpoints();

// Map feature endpoints (require authentication)
api.MapGroup("/circles").MapCircleEndpoints().MapCircleInvitationSendEndpoint().RequireAuthorization();
api.MapGroup("/posts").MapPostEndpoints().RequireAuthorization();
api.MapGroup("/users").MapUserEndpoints().RequireAuthorization();
api.MapGroup("/friends").MapFriendEndpoints().RequireAuthorization();
api.MapGroup("/invitations").MapInvitationEndpoints().RequireAuthorization();

app.MapDefaultEndpoints();

app.UseFileServer();

app.Run();
