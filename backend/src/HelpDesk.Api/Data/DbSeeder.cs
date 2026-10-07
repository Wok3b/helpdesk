using HelpDesk.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace HelpDesk.Api.Data;

// Fills an empty database with a believable small company, so the app is useful right after "docker compose up".
public static class DbSeeder
{
    public const string DemoPassword = "Demo123!";

    private record TicketTemplate(string Title, string Description, TicketCategory Category, TicketPriority Priority, AssetType? Asset = null);

    private static readonly TicketTemplate[] Templates =
    [
        new("Laptop won't turn on after Windows update", "Installed updates last night, this morning the laptop shows the logo and then a black screen.", TicketCategory.Hardware, TicketPriority.High, AssetType.Laptop),
        new("Can't connect to office Wi-Fi", "My laptop sees the network but says \"Can't connect to this network\". Phone works fine.", TicketCategory.Network, TicketPriority.Medium, AssetType.Laptop),
        new("Outlook keeps asking for my password", "Every few minutes Outlook pops up a login window. I type the password and it comes back.", TicketCategory.Software, TicketPriority.Medium),
        new("Need access to the Finance shared folder", "I moved to the Finance team and need read/write access to \\\\files\\finance.", TicketCategory.Access, TicketPriority.Low),
        new("Printer on 2nd floor jams on every page", "The HP printer near the kitchen jams after the first page, every time.", TicketCategory.Hardware, TicketPriority.Low, AssetType.Printer),
        new("VPN disconnects every few minutes", "Working from home, the VPN drops roughly every 5 minutes and I lose my session.", TicketCategory.Network, TicketPriority.High),
        new("Excel crashes when opening the monthly report", "The 40 MB report crashes Excel right after it loads. Smaller files are fine.", TicketCategory.Software, TicketPriority.Medium),
        new("Onboarding: laptop and accounts for new colleague", "New sales rep starts Monday. Needs a laptop, email, CRM and VPN access.", TicketCategory.Access, TicketPriority.Medium),
        new("Monitor flickering", "External monitor flickers every few seconds, especially on dark backgrounds.", TicketCategory.Hardware, TicketPriority.Low, AssetType.Monitor),
        new("Teams microphone not working", "Colleagues can't hear me in Teams calls. The mic works in the Windows sound test.", TicketCategory.Software, TicketPriority.Medium),
        new("Whole office has no internet", "Nobody on the 1st floor can reach any website since 9:10.", TicketCategory.Network, TicketPriority.Critical),
        new("Locked out after password change", "Changed my password this morning and now my account says it's locked.", TicketCategory.Access, TicketPriority.High),
        new("Please install Adobe Acrobat Pro", "I need to edit and sign PDF contracts. Manager approved the license.", TicketCategory.Software, TicketPriority.Low),
        new("Phone stopped syncing company email", "Mail on my work phone hasn't updated since yesterday.", TicketCategory.Software, TicketPriority.Low, AssetType.Phone),
        new("Suspicious email with an invoice attachment", "Got an \"overdue invoice\" from an unknown sender with a .zip file. Didn't open it.", TicketCategory.Other, TicketPriority.High),
        new("Docking station doesn't detect second screen", "Since the dock was moved, only one of my two monitors works.", TicketCategory.Hardware, TicketPriority.Medium),
        new("Network drive is very slow", "Opening files from the S: drive takes 30+ seconds since Monday.", TicketCategory.Network, TicketPriority.Medium),
        new("Reset my MFA device", "Got a new phone and can't approve sign-ins anymore.", TicketCategory.Access, TicketPriority.High),
        new("Laptop battery lasts about an hour", "Battery used to last a full day, now it's empty after an hour.", TicketCategory.Hardware, TicketPriority.Medium, AssetType.Laptop),
        new("CRM shows error 500 on the customer page", "Opening any customer record gives \"500 Internal Server Error\".", TicketCategory.Software, TicketPriority.High),
        new("Meeting room projector won't connect", "HDMI from my laptop shows \"No signal\" on the projector in room B.", TicketCategory.Hardware, TicketPriority.Low),
        new("Request: second monitor", "Working with spreadsheets all day, a second monitor would help a lot.", TicketCategory.Hardware, TicketPriority.Low),
        new("Share my calendar with the team", "I'd like the Sales team to see my calendar availability.", TicketCategory.Access, TicketPriority.Low),
        new("Wi-Fi in the warehouse is very weak", "Scanners lose connection in the back half of the warehouse.", TicketCategory.Network, TicketPriority.Medium),
        new("Several keyboard keys stuck", "E, R and T keys need to be pressed hard to register.", TicketCategory.Hardware, TicketPriority.Low, AssetType.Laptop)
    ];

    private static readonly string[] StaffReplies =
    [
        "Thanks for reporting. Could you restart the device and tell me if it still happens?",
        "I've reproduced the problem and I'm working on it.",
        "Can you send a screenshot of the error message?",
        "Fixed on our side, please check and confirm.",
        "I'll come by your desk after lunch to take a look."
    ];

    private static readonly string[] UserReplies =
    [
        "Restarted, still the same.",
        "Screenshot attached in the email I sent you.",
        "Works now, thank you!",
        "I'm in the office until 16h if you want to come by."
    ];

    private static readonly string[] InternalNotes =
    [
        "Known issue with the latest driver, rolling back fixes it.",
        "Checked the logs, the account was locked by the old password on the phone.",
        "Ordered a replacement part, ETA 2 days.",
        "Escalated to the network vendor, ticket #4471."
    ];

    public static async Task SeedAsync(AppDbContext db, IPasswordHasher<User> hasher, TimeProvider clock, CancellationToken ct = default)
    {
        if (await db.Users.AnyAsync(ct))
            return;

        var now = clock.GetUtcNow();
        var rng = new Random(2026);

        // ---- People ----
        User Person(string name, string email, UserRole role, string dept) =>
            new() { FullName = name, Email = email, Role = role, Department = dept, CreatedAt = now.AddDays(-90) };

        var admin = Person("Milica Jovanović", "admin@helpdesk.local", UserRole.Admin, "IT");
        var technicians = new[]
        {
            Person("Nikola Petrović", "tech@helpdesk.local", UserRole.Technician, "IT"),
            Person("Ana Kovačević", "ana.kovacevic@helpdesk.local", UserRole.Technician, "IT"),
            Person("Stefan Ilić", "stefan.ilic@helpdesk.local", UserRole.Technician, "IT")
        };
        var employees = new[]
        {
            Person("Jelena Marković", "employee@helpdesk.local", UserRole.Employee, "Finance"),
            Person("Marko Nikolić", "marko.nikolic@helpdesk.local", UserRole.Employee, "Sales"),
            Person("Ivana Stojanović", "ivana.stojanovic@helpdesk.local", UserRole.Employee, "HR"),
            Person("Luka Đorđević", "luka.djordjevic@helpdesk.local", UserRole.Employee, "Sales"),
            Person("Teodora Pavlović", "teodora.pavlovic@helpdesk.local", UserRole.Employee, "Marketing"),
            Person("Filip Lazić", "filip.lazic@helpdesk.local", UserRole.Employee, "Finance"),
            Person("Sara Todorović", "sara.todorovic@helpdesk.local", UserRole.Employee, "Operations"),
            Person("Dušan Popović", "dusan.popovic@helpdesk.local", UserRole.Employee, "Operations"),
            Person("Katarina Simić", "katarina.simic@helpdesk.local", UserRole.Employee, "HR"),
            Person("Vuk Radovanović", "vuk.radovanovic@helpdesk.local", UserRole.Employee, "Marketing")
        };

        var everyone = new[] { admin }.Concat(technicians).Concat(employees).ToList();
        var hash = hasher.HashPassword(admin, DemoPassword);
        foreach (var u in everyone) u.PasswordHash = hash;
        db.Users.AddRange(everyone);

        // ---- Equipment ----
        var assets = new List<Asset>();
        var laptopModels = new[] { "Dell Latitude 5440", "Lenovo ThinkPad T14", "HP EliteBook 840" };
        for (var i = 0; i < employees.Length; i++)
        {
            assets.Add(new Asset
            {
                Tag = $"LT-{i + 1:0000}", Name = laptopModels[i % laptopModels.Length], Type = AssetType.Laptop, Status = AssetStatus.InUse,
                SerialNumber = $"SN{rng.Next(100000, 999999)}", AssignedTo = employees[i],
                PurchaseDate = DateOnly.FromDateTime(now.UtcDateTime).AddMonths(-rng.Next(6, 40)),
                WarrantyUntil = DateOnly.FromDateTime(now.UtcDateTime).AddMonths(rng.Next(-6, 24))
            });
        }
        for (var i = 0; i < 6; i++)
        {
            assets.Add(new Asset
            {
                Tag = $"MN-{i + 1:0000}", Name = i % 2 == 0 ? "Dell P2422H 24\"" : "LG 27UL500 27\"", Type = AssetType.Monitor,
                Status = AssetStatus.InUse, AssignedTo = employees[i], SerialNumber = $"MN{rng.Next(10000, 99999)}"
            });
        }
        for (var i = 0; i < 3; i++)
            assets.Add(new Asset { Tag = $"PH-{i + 1:0000}", Name = "Samsung Galaxy A55", Type = AssetType.Phone, Status = AssetStatus.InUse, AssignedTo = employees[i + 1] });
        assets.Add(new Asset { Tag = "PR-0001", Name = "HP LaserJet Pro M404 (2nd floor)", Type = AssetType.Printer, Status = AssetStatus.InUse });
        assets.Add(new Asset { Tag = "PR-0002", Name = "Canon i-SENSYS MF445 (reception)", Type = AssetType.Printer, Status = AssetStatus.InRepair, Notes = "Fuser replacement ordered." });
        assets.Add(new Asset { Tag = "NW-0001", Name = "Ubiquiti U6 Pro access point (warehouse)", Type = AssetType.NetworkDevice, Status = AssetStatus.InUse });
        assets.Add(new Asset { Tag = "NW-0002", Name = "MikroTik CRS326 core switch", Type = AssetType.NetworkDevice, Status = AssetStatus.InUse });
        assets.Add(new Asset { Tag = "LT-0099", Name = "Lenovo ThinkPad T14 (spare)", Type = AssetType.Laptop, Status = AssetStatus.InStock });
        db.Assets.AddRange(assets);
        await db.SaveChangesAsync(ct);

        // ---- Tickets, oldest first so the HD numbers follow the calendar ----
        // About 40% of tickets come from the last few days, so there's an active queue to work on.
        var plans = Enumerable.Range(0, 55)
            .Select(_ => (Template: Templates[rng.Next(Templates.Length)], Reporter: employees[rng.Next(employees.Length)],
                          CreatedAt: BusinessHour(now.AddDays(-(rng.NextDouble() < 0.4 ? rng.Next(0, 4) : rng.Next(4, 21))), rng)))
            .Where(p => p.CreatedAt < now)
            .OrderBy(p => p.CreatedAt)
            .ToList();

        var tickets = new List<Ticket>();
        foreach (var (template, reporter, createdAt) in plans)
        {
            var ageHours = (now - createdAt).TotalHours;
            var tech = technicians[rng.Next(technicians.Length)];
            var asset = template.Asset is { } type ? assets.FirstOrDefault(a => a.Type == type && a.AssignedTo == reporter) : null;

            var ticket = new Ticket
            {
                Title = template.Title, Description = template.Description, Category = template.Category, Priority = template.Priority,
                CreatedBy = reporter, Asset = asset, CreatedAt = createdAt, UpdatedAt = createdAt,
                DueAt = SlaPolicy.DueAt(createdAt, template.Priority)
            };
            void Event(TicketEventType type, User actor, DateTimeOffset at, string? from = null, string? to = null) =>
                ticket.Events.Add(new TicketEvent { Type = type, Actor = actor, CreatedAt = at, FromValue = from, ToValue = to });
            void Say(User author, DateTimeOffset at, string body, bool isInternal = false)
            {
                ticket.Comments.Add(new Comment { Author = author, Body = body, IsInternal = isInternal, CreatedAt = at });
                Event(TicketEventType.Commented, author, at);
            }
            void Move(TicketStatus to, User actor, DateTimeOffset at)
            {
                Event(TicketEventType.StatusChanged, actor, at, ticket.Status.ToString(), to.ToString());
                ticket.Status = to;
                ticket.UpdatedAt = at;
            }

            Event(TicketEventType.Created, reporter, createdAt, to: template.Priority.ToString());

            // Brand new tickets stay unassigned; older ones have been worked on.
            if (ageHours < 2 || rng.NextDouble() < 0.12)
            {
                tickets.Add(ticket);
                continue;
            }

            var t = createdAt.AddMinutes(rng.Next(10, 90));
            ticket.Assignee = tech;
            Event(TicketEventType.Assigned, tech, t, null, tech.FullName);
            Move(TicketStatus.InProgress, tech, t);
            Say(tech, t.AddMinutes(5), StaffReplies[rng.Next(StaffReplies.Length)]);

            var roll = rng.NextDouble();
            if (roll < 0.25 && ageHours < 96)
            {
                Move(TicketStatus.WaitingOnUser, tech, t.AddMinutes(20));
                tickets.Add(ticket);
                continue;
            }

            if (rng.NextDouble() < 0.35)
                Say(tech, t.AddMinutes(40), InternalNotes[rng.Next(InternalNotes.Length)], isInternal: true);

            // Mostly within SLA, sometimes late, so the dashboard has something to show.
            var sla = SlaPolicy.ResolutionTime(template.Priority).TotalHours;
            var resolvedAt = createdAt.AddHours(sla * (rng.NextDouble() < 0.8 ? rng.NextDouble() * 0.9 + 0.05 : 1.2 + rng.NextDouble()));
            // Recent tickets are usually still being worked on; a few old ones are stuck (and overdue).
            if (resolvedAt >= now || roll < 0.65 && ageHours < 96 || roll > 0.94)
            {
                ticket.UpdatedAt = t.AddMinutes(5);
                tickets.Add(ticket);
                continue;
            }

            Say(reporter, resolvedAt.AddMinutes(-30), UserReplies[rng.Next(UserReplies.Length)]);
            Move(TicketStatus.Resolved, tech, resolvedAt);
            ticket.ResolvedAt = resolvedAt;

            var closeAt = resolvedAt.AddHours(rng.Next(2, 30));
            if (closeAt < now && rng.NextDouble() < 0.7)
                Move(TicketStatus.Closed, reporter, closeAt);

            tickets.Add(ticket);
        }

        // One insert at a time keeps the sequence-generated HD numbers in calendar order.
        foreach (var ticket in tickets)
        {
            db.Tickets.Add(ticket);
            await db.SaveChangesAsync(ct);
        }
    }

    private static DateTimeOffset BusinessHour(DateTimeOffset day, Random rng)
    {
        var d = day.UtcDateTime.Date;
        while (d.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) d = d.AddDays(-1);
        return new DateTimeOffset(d.AddHours(rng.Next(6, 15)).AddMinutes(rng.Next(0, 60)), TimeSpan.Zero);
    }
}
