using System.Net;
using System.Net.Http.Json;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Domain;
using Microsoft.AspNetCore.Mvc;
using Shouldly;

namespace HelpDesk.Tests.Integration;

[Collection(ApiCollection.Name)]
public class AuthTests(ApiFactory api)
{
    [Fact]
    public async Task Login_returns_a_token_and_the_users_role()
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(Users.Tech, "Demo123!"));

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var login = await response.ReadAsync<LoginResponse>();
        login.Token.ShouldNotBeNullOrWhiteSpace();
        login.User.Role.ShouldBe(UserRole.Technician);
    }

    [Fact]
    public async Task Wrong_password_gets_401_with_a_problem_response()
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(Users.Tech, "wrong-password"));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await response.ReadAsync<ProblemDetails>();
        problem.Detail.ShouldBe("Wrong email or password.");
    }

    [Fact]
    public async Task Protected_endpoints_need_a_token()
    {
        var response = await api.CreateClient().GetAsync("/api/tickets");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Me_returns_the_signed_in_user()
    {
        var client = await api.ClientForAsync(Users.Jelena);

        var me = await (await client.GetAsync("/api/auth/me")).ReadAsync<UserDto>();

        me.Email.ShouldBe(Users.Jelena);
        me.Role.ShouldBe(UserRole.Employee);
    }
}
