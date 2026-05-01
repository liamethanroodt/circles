var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");

var sql = builder.AddSqlServer("sql")
    .AddDatabase("circlesdb");

var storage = builder.AddAzureStorage("storage")
    .RunAsEmulator();

var blobs = storage.AddBlobs("blobs");

// Add a MailPit container for local email development.
// MailPit is a lightweight fake SMTP server with a web UI at http://localhost:<ui-port>.
// All emails sent by the server land here — no real emails are ever delivered in development.
var mailpit = builder.AddMailPit("mailpit");

var server = builder.AddProject<Projects.circles_Server>("server")
    .WithReference(cache)
    .WithReference(sql)
    .WithReference(blobs)
    .WithReference(mailpit)
    .WaitFor(cache)
    .WaitFor(sql)
    .WaitFor(blobs)
    .WaitFor(mailpit)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

var webfrontend = builder.AddViteApp("webfrontend", "../circles.Frontend")
    .WithReference(server)
    .WaitFor(server);

// Tell the server the public URL of the frontend so it can build correct confirmation links
// in emails. Aspire evaluates this lazily at startup after port assignment, so the URL
// always matches the actual Vite dev-server address (e.g. http://localhost:5173).
server.WithEnvironment("AppSettings__FrontendUrl", webfrontend.GetEndpoint("http"));

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
