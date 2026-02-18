using System.Text.Json;

namespace circles.Server;

public class ValidationFilter : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        try
        {
            return await next(context);
        }
        catch (JsonException ex)
        {
            return Results.BadRequest(new 
            { 
                errors = new[] { $"Invalid JSON format: {ex.Message}" }
            });
        }
        catch (BadHttpRequestException ex)
        {
            return Results.BadRequest(new 
            { 
                errors = new[] { $"Invalid request: {ex.Message}" }
            });
        }
    }
}
