namespace circles.Server.Features.Auth.Services;

public interface IAppEmailSender
{
    Task SendAsync(string to, string subject, string htmlBody);
}
