var builder = DistributedApplication.CreateBuilder(args);

var cache = builder.AddRedis("cache");

var sql = builder.AddSqlServer("sql")
    .AddDatabase("circlesdb");

var server = builder.AddProject<Projects.circles_Server>("server")
    .WithReference(cache)
    .WithReference(sql)
    .WaitFor(cache)
    .WaitFor(sql)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

var webfrontend = builder.AddViteApp("webfrontend", "../frontend")
    .WithReference(server)
    .WaitFor(server);

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
