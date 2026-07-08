var builder = DistributedApplication.CreateBuilder(args);

builder.AddAzureContainerAppEnvironment("env");

var cache = builder.AddRedis("cache");

var sql = builder.AddSqlServer("sql")
    .AddDatabase("circlesdb");

var storage = builder.AddAzureStorage("storage")
    .RunAsEmulator();

var blobs = storage.AddBlobs("blobs");

var server = builder.AddProject<Projects.circles_Server>("server")
    .WithReference(cache)
    .WithReference(sql)
    .WithReference(blobs)
    .WaitFor(cache)
    .WaitFor(sql)
    .WaitFor(blobs)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

if (!builder.ExecutionContext.IsPublishMode)
{
    var mailpit = builder.AddMailPit("mailpit");
    server.WithReference(mailpit).WaitFor(mailpit);
}

var webfrontend = builder.AddViteApp("webfrontend", "../circles.Frontend")
    .WithReference(server)
    .WaitFor(server);

// In publish mode the frontend is bundled into the server container (wwwroot), so the
// frontend URL is the server's own external endpoint. In development it's the Vite dev server.
if (builder.ExecutionContext.IsPublishMode)
{
    server.WithEnvironment("AppSettings__FrontendUrl", server.GetEndpoint("http"));
}
else
{
    server.WithEnvironment("AppSettings__FrontendUrl", webfrontend.GetEndpoint("http"));
}

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
