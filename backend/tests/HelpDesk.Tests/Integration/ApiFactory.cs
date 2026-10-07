using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;

namespace HelpDesk.Tests.Integration;

// Runs the real API in memory against a real, throwaway SQL Server database.
// Locally that's LocalDB; in CI the HELPDESK_TEST_SQL variable points at a SQL Server service container.
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private readonly string _connectionString;

    public ApiFactory()
    {
        var baseConnection = Environment.GetEnvironmentVariable("HELPDESK_TEST_SQL")
                             ?? @"Server=(localdb)\MSSQLLocalDB;Trusted_Connection=True;TrustServerCertificate=True";

        _connectionString = new SqlConnectionStringBuilder(baseConnection)
        {
            InitialCatalog = $"HelpDesk_Tests_{Guid.NewGuid():N}"
        }.ConnectionString;

        // Environment variables are read by WebApplication.CreateBuilder before anything else runs.
        Environment.SetEnvironmentVariable("ConnectionStrings__HelpDesk", _connectionString);
        Environment.SetEnvironmentVariable("Jwt__SigningKey", "integration-tests-signing-key-0123456789abcdef");
        Environment.SetEnvironmentVariable("Database__MigrateOnStartup", "true");
        Environment.SetEnvironmentVariable("Database__SeedDemoData", "true");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Testing");

    public async Task<HttpClient> ClientForAsync(string email)
    {
        var client = CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, DbSeeder.DemoPassword));
        response.EnsureSuccessStatusCode();
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>(Json);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login!.Token);
        return client;
    }

    public Task InitializeAsync()
    {
        _ = Server; // starts the app: migrations and demo data run here
        return Task.CompletedTask;
    }

    public new async Task DisposeAsync()
    {
        await using (var scope = Services.CreateAsyncScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureDeletedAsync();
        await base.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public class ApiCollection : ICollectionFixture<ApiFactory>
{
    public const string Name = "api";
}

public static class Users
{
    public const string Admin = "admin@helpdesk.local";
    public const string Tech = "tech@helpdesk.local";
    public const string Jelena = "employee@helpdesk.local";
    public const string Marko = "marko.nikolic@helpdesk.local";
}

public static class HttpExtensions
{
    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(ApiFactory.Json))!;

    public static Task<HttpResponseMessage> PatchJsonAsync<T>(this HttpClient client, string url, T body) =>
        client.PatchAsync(url, JsonContent.Create(body, options: ApiFactory.Json));

    public static Task<HttpResponseMessage> PostJsonAsync<T>(this HttpClient client, string url, T body) =>
        client.PostAsJsonAsync(url, body, ApiFactory.Json);
}
