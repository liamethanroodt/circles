namespace circles.Server.Features.Auth.Services;

/// <summary>
/// Strongly-typed configuration for the SMTP server used to send transactional emails.
/// In development these values are overridden by the MailPit connection string injected
/// by .NET Aspire. In production, set them via environment variables or a secrets manager.
/// </summary>
public class SmtpSettings
{
    /// <summary>SMTP server hostname or IP address.</summary>
    public string Host { get; set; } = "localhost";

    /// <summary>SMTP server port. 1025 = MailPit dev default, 587 = production STARTTLS.</summary>
    public int Port { get; set; } = 1025;

    /// <summary>"From" address placed on every outgoing email.</summary>
    public string FromEmail { get; set; } = "noreply@circles.app";

    /// <summary>"From" display name placed on every outgoing email.</summary>
    public string FromName { get; set; } = "Circles";

    /// <summary>Optional SMTP username for authenticated servers.</summary>
    public string? Username { get; set; }

    /// <summary>Optional SMTP password for authenticated servers.</summary>
    public string? Password { get; set; }

    /// <summary>
    /// Set to true to require SSL/TLS on connect (production).
    /// Leave false for development servers like MailPit that accept plain connections.
    /// </summary>
    public bool UseSsl { get; set; } = false;
}
