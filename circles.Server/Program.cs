using circles.Server.Data;
using circles.Server.Features.Auth;
using circles.Server.Features.Circles;
using circles.Server.Features.Posts;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();
builder.AddRedisClientBuilder("cache")
    .WithOutputCache();
builder.AddSqlServerClient("circlesdb");

// Add DbContext
builder.Services.AddDbContext<CirclesDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("circlesdb")));

// Add Identity
builder.Services.AddIdentity<IdentityUser, IdentityRole>(options =>
{
    options.Password.RequireDigit = true;
    options.Password.RequiredLength = 6;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
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

var app = builder.Build();

// Apply database migrations automatically
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<CirclesDbContext>();
    dbContext.Database.Migrate();
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
api.MapGroup("/circles").MapCircleEndpoints().RequireAuthorization();
api.MapGroup("/posts").MapPostEndpoints().RequireAuthorization();

app.MapDefaultEndpoints();

app.UseFileServer();

app.Run();
