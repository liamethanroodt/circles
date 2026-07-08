using circles.Server.Features.Auth.Models;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using MimeKit;
using Resend;

namespace circles.Server.Features.Auth.Services;

/// <summary>
/// Implements ASP.NET Core Identity's <see cref="IEmailSender{TUser}"/> interface.
///
/// In development (Aspire injects a "mailpit" connection string) it uses MailKit to relay
/// through the local Mailpit container.  In production it uses the Resend API.
/// </summary>
public class EmailSender(IOptions<SmtpSettings> options, IConfiguration configuration, IResend resend)
    : IEmailSender<ApplicationUser>, IAppEmailSender
{
    private readonly SmtpSettings _settings = options.Value;

    // --- IEmailSender<ApplicationUser> implementation ----------------------------------------

    /// <summary>
    /// Called by the Register endpoint after creating a new user.
    /// Sends a branded HTML email containing the email confirmation link.
    /// </summary>
    public Task SendConfirmationLinkAsync(ApplicationUser user, string email, string confirmationLink) =>
        SendEmailAsync(
            to: email,
            subject: "Confirm your Circles account",
            htmlBody: $"""
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="color:#1e293b">Welcome to Circles, {user.DisplayName}!</h2>
                  <p>Thanks for signing up. Click the button below to confirm your email address and activate your account.</p>
                  <p style="text-align:center;margin:32px 0">
                    <a href="{confirmationLink}"
                       style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;
                              text-decoration:none;font-weight:600;display:inline-block">
                      Confirm Email
                    </a>
                  </p>
                  <p style="color:#64748b;font-size:13px">
                    Or copy this link into your browser:<br/>
                    <a href="{confirmationLink}" style="color:#2563eb">{confirmationLink}</a>
                  </p>
                  <p style="color:#94a3b8;font-size:12px">
                    This link expires in 24 hours. If you didn't create a Circles account, you can safely ignore this email.
                  </p>
                </div>
                """);

    /// <summary>Sends a password reset link (placeholder for future use).</summary>
    public Task SendPasswordResetLinkAsync(ApplicationUser user, string email, string resetLink) =>
        SendEmailAsync(email, "Reset your Circles password",
            $"<p>Click <a href=\"{resetLink}\">here</a> to reset your password.</p>");

    /// <summary>Sends a one-time password reset code (placeholder for future use).</summary>
    public Task SendPasswordResetCodeAsync(ApplicationUser user, string email, string resetCode) =>
        SendEmailAsync(email, "Reset your Circles password",
            $"<p>Your password reset code is: <strong>{resetCode}</strong></p>");

    // --- Private helpers ---------------------------------------------------------------------

    public Task SendAsync(string to, string subject, string htmlBody) =>
        SendEmailAsync(to, subject, htmlBody);

    private async Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        if (!string.IsNullOrEmpty(configuration.GetConnectionString("mailpit")))
        {
            await SendViaMailpitAsync(to, subject, htmlBody);
        }
        else
        {
            await SendViaResendAsync(to, subject, htmlBody);
        }
    }

    private async Task SendViaResendAsync(string to, string subject, string htmlBody)
    {
        var message = new EmailMessage();
        message.From = $"{_settings.FromName} <{_settings.FromEmail}>";
        message.To.Add(to);
        message.Subject = subject;
        message.HtmlBody = htmlBody;

        await resend.EmailSendAsync(message);
    }

    private async Task SendViaMailpitAsync(string to, string subject, string htmlBody)
    {
        var connectionString = configuration.GetConnectionString("mailpit")!;

        // Aspire injects the connection string as "endpoint=smtp://host:port"
        const string endpointKey = "endpoint=";
        var startIndex = connectionString.IndexOf(endpointKey, StringComparison.OrdinalIgnoreCase);
        var uriString = connectionString[(startIndex + endpointKey.Length)..].TrimEnd(';');
        Uri.TryCreate(uriString, UriKind.Absolute, out var uri);

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(_settings.FromName, _settings.FromEmail));
        message.To.Add(MailboxAddress.Parse(to));
        message.Subject = subject;
        message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

        using var client = new SmtpClient();
        await client.ConnectAsync(uri!.Host, uri.Port, SecureSocketOptions.None);
        await client.SendAsync(message);
        await client.DisconnectAsync(quit: true);
    }
}
