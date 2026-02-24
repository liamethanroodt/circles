using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace circles.Server.Data;

public class CirclesDbContextFactory : IDesignTimeDbContextFactory<CirclesDbContext>
{
    public CirclesDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<CirclesDbContext>();
        
        // Use a default connection string for design-time operations (migrations)
        // You can customize this connection string as needed
        var connectionString = "Server=(localdb)\\mssqllocaldb;Database=circlesdb;Trusted_Connection=True;MultipleActiveResultSets=true";
        
        optionsBuilder.UseSqlServer(connectionString);
        
        return new CirclesDbContext(optionsBuilder.Options);
    }
}
