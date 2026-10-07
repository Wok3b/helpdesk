using HelpDesk.Api.Auth;
using HelpDesk.Api.Common;
using HelpDesk.Api.Contracts;
using HelpDesk.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HelpDesk.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/assets")]
public class AssetsController(IAssetService assets) : ControllerBase
{
    [HttpGet]
    public Task<PagedResult<AssetDto>> List([FromQuery] AssetQuery query, CancellationToken ct) => assets.ListAsync(query, ct);

    [HttpGet("{id:int}")]
    public Task<AssetDto> Get(int id, CancellationToken ct) => assets.GetAsync(id, ct);

    [Authorize(Policy = AuthConstants.StaffPolicy)]
    [HttpPost]
    public async Task<ActionResult<AssetDto>> Create(SaveAssetRequest request, CancellationToken ct)
    {
        var created = await assets.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [Authorize(Policy = AuthConstants.StaffPolicy)]
    [HttpPut("{id:int}")]
    public Task<AssetDto> Update(int id, SaveAssetRequest request, CancellationToken ct) => assets.UpdateAsync(id, request, ct);

    [Authorize(Policy = AuthConstants.AdminPolicy)]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await assets.DeleteAsync(id, ct);
        return NoContent();
    }
}
