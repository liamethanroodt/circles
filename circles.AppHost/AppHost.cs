var builder = DistributedApplication.CreateBuilder(args);

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

var webfrontend = builder.AddViteApp("webfrontend", "../circles.Frontend")
    .WithReference(server)
    .WaitFor(server);

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
