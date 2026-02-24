using circles.Server.Data;
using circles.Server.Features.Circles;
using circles.Server.Features.Posts;
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

app.UseOutputCache();

var api = app.MapGroup("/api");

// Map feature endpoints
api.MapGroup("/circles").MapCircleEndpoints();
api.MapGroup("/posts").MapPostEndpoints();

app.MapDefaultEndpoints();

app.UseFileServer();

app.Run();

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
