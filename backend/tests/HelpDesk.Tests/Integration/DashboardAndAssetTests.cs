using System.Net;
using HelpDesk.Api.Common;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Domain;
using HelpDesk.Api.Services;
using Shouldly;

namespace HelpDesk.Tests.Integration;

[Collection(ApiCollection.Name)]
public class DashboardAndAssetTests(ApiFactory api)
{
    [Fact]
    public async Task Dashboard_sums_up_the_ticket_table()
    {
        var tech = await api.ClientForAsync(Users.Tech);

        var dashboard = await (await tech.GetAsync("/api/dashboard")).ReadAsync<DashboardDto>();
        var all = await (await tech.GetAsync("/api/tickets?pageSize=1")).ReadAsync<PagedResult<TicketListItem>>();

        dashboard.ByStatus.Sum(s => s.Count).ShouldBe(all.TotalCount);
        dashboard.Daily.Count.ShouldBe(DashboardService.DailyWindowDays);
        dashboard.Workload.ShouldNotBeEmpty();
        dashboard.OverdueTickets.ShouldBeLessThanOrEqualTo(dashboard.OpenTickets);
    }

    [Fact]
    public async Task Employees_cannot_open_the_dashboard()
    {
        var jelena = await api.ClientForAsync(Users.Jelena);

        (await jelena.GetAsync("/api/dashboard")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Employees_only_see_their_own_equipment()
    {
        var jelena = await api.ClientForAsync(Users.Jelena);

        var assets = await (await jelena.GetAsync("/api/assets?pageSize=100")).ReadAsync<PagedResult<AssetDto>>();

        assets.Items.ShouldNotBeEmpty();
        assets.Items.ShouldAllBe(a => a.AssignedTo!.FullName == "Jelena Marković");
    }

    [Fact]
    public async Task Asset_tags_must_be_unique()
    {
        var tech = await api.ClientForAsync(Users.Tech);
        var request = new SaveAssetRequest("LT-0001", "Duplicate laptop", AssetType.Laptop, AssetStatus.InStock, null, null, null, null, null);

        var response = await tech.PostJsonAsync("/api/assets", request);

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Only_admins_can_delete_equipment()
    {
        var tech = await api.ClientForAsync(Users.Tech);
        var admin = await api.ClientForAsync(Users.Admin);
        var created = await (await tech.PostJsonAsync("/api/assets",
            new SaveAssetRequest($"TS-{Random.Shared.Next(1000, 9999)}", "Test scanner", AssetType.Other, AssetStatus.InStock, null, null, null, null, null)))
            .ReadAsync<AssetDto>();

        (await tech.DeleteAsync($"/api/assets/{created.Id}")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await admin.DeleteAsync($"/api/assets/{created.Id}")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }
}
