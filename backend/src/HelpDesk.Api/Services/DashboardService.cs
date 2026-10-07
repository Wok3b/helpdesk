using HelpDesk.Api.Contracts;
using HelpDesk.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace HelpDesk.Api.Services;

public interface IDashboardService
{
    Task<DashboardDto> GetAsync(CancellationToken ct);
}

// Reporting queries are written in plain SQL: aggregates, CASE, a recursive CTE and a LEFT JOIN.
// EF Core's SqlQuery turns the interpolated values into SQL parameters, so this is safe from injection.
public class DashboardService(AppDbContext db, TimeProvider clock) : IDashboardService
{
    public const int DailyWindowDays = 14;

    public async Task<DashboardDto> GetAsync(CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var weekAgo = now.AddDays(-7);
        var firstDay = DateOnly.FromDateTime(now.UtcDateTime).AddDays(-(DailyWindowDays - 1));
        var lastDay = DateOnly.FromDateTime(now.UtcDateTime);

        var totalsRows = await db.Database.SqlQuery<TotalsRow>($"""
            SELECT
                ISNULL(SUM(CASE WHEN Status NOT IN ('Resolved', 'Closed') THEN 1 ELSE 0 END), 0) AS OpenTickets,
                ISNULL(SUM(CASE WHEN Status NOT IN ('Resolved', 'Closed') AND DueAt < {now} THEN 1 ELSE 0 END), 0) AS OverdueTickets,
                ISNULL(SUM(CASE WHEN Status NOT IN ('Resolved', 'Closed') AND AssigneeId IS NULL THEN 1 ELSE 0 END), 0) AS UnassignedTickets,
                ISNULL(SUM(CASE WHEN ResolvedAt >= {weekAgo} THEN 1 ELSE 0 END), 0) AS ResolvedLast7Days,
                AVG(CASE WHEN ResolvedAt IS NOT NULL
                         THEN CAST(DATEDIFF(MINUTE, CreatedAt, ResolvedAt) AS float) / 60.0 END) AS AvgResolutionHours
            FROM Tickets
            """).ToListAsync(ct);
        var totals = totalsRows.Single();

        var byStatus = await CountByAsync("Status", ct);
        var byPriority = await CountByAsync("Priority", ct);
        var byCategory = await CountByAsync("Category", ct);

        var daily = await db.Database.SqlQuery<DailyRow>($"""
            WITH Days AS (
                SELECT CAST({firstDay} AS date) AS Day
                UNION ALL
                SELECT DATEADD(DAY, 1, Day) FROM Days WHERE Day < CAST({lastDay} AS date)
            )
            SELECT
                d.Day,
                (SELECT COUNT(*) FROM Tickets t WHERE CAST(t.CreatedAt AS date) = d.Day) AS Created,
                (SELECT COUNT(*) FROM Tickets t WHERE CAST(t.ResolvedAt AS date) = d.Day) AS Resolved
            FROM Days d
            ORDER BY d.Day
            """).ToListAsync(ct);

        var workload = await db.Database.SqlQuery<WorkloadRow>($"""
            SELECT
                u.Id AS UserId,
                u.FullName,
                COUNT(t.Id) AS OpenAssigned,
                ISNULL(SUM(CASE WHEN t.DueAt < {now} THEN 1 ELSE 0 END), 0) AS OverdueAssigned
            FROM Users u
            LEFT JOIN Tickets t
                ON t.AssigneeId = u.Id AND t.Status NOT IN ('Resolved', 'Closed')
            WHERE u.Role IN ('Technician', 'Admin') AND u.IsActive = 1
            GROUP BY u.Id, u.FullName
            ORDER BY OpenAssigned DESC, u.FullName
            """).ToListAsync(ct);

        return new DashboardDto(
            totals.OpenTickets,
            totals.OverdueTickets,
            totals.UnassignedTickets,
            totals.ResolvedLast7Days,
            totals.AvgResolutionHours is { } h ? Math.Round(h, 1) : null,
            byStatus,
            byPriority,
            byCategory,
            daily.Select(d => new DailyTicketStats(d.Day, d.Created, d.Resolved)).ToList(),
            workload.Select(w => new TechnicianWorkload(w.UserId, w.FullName, w.OpenAssigned, w.OverdueAssigned)).ToList());
    }

    // The column name comes from the fixed list above (never from user input), so it's safe to inline.
    private async Task<IReadOnlyList<CountBy>> CountByAsync(string column, CancellationToken ct)
    {
        if (column is not ("Status" or "Priority" or "Category"))
            throw new ArgumentOutOfRangeException(nameof(column));

#pragma warning disable EF1002
        var rows = await db.Database
            .SqlQueryRaw<CountRow>($"SELECT {column} AS [Key], COUNT(*) AS [Count] FROM Tickets GROUP BY {column}")
            .ToListAsync(ct);
#pragma warning restore EF1002

        return rows.OrderByDescending(r => r.Count).Select(r => new CountBy(r.Key, r.Count)).ToList();
    }

    private sealed class TotalsRow
    {
        public int OpenTickets { get; set; }
        public int OverdueTickets { get; set; }
        public int UnassignedTickets { get; set; }
        public int ResolvedLast7Days { get; set; }
        public double? AvgResolutionHours { get; set; }
    }

    private sealed class CountRow
    {
        public string Key { get; set; } = "";
        public int Count { get; set; }
    }

    private sealed class DailyRow
    {
        public DateOnly Day { get; set; }
        public int Created { get; set; }
        public int Resolved { get; set; }
    }

    private sealed class WorkloadRow
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public int OpenAssigned { get; set; }
        public int OverdueAssigned { get; set; }
    }
}
