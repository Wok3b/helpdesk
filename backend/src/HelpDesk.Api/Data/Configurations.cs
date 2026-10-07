using HelpDesk.Api.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HelpDesk.Api.Data;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> b)
    {
        b.Property(u => u.FullName).HasMaxLength(120);
        b.Property(u => u.Email).HasMaxLength(200);
        b.HasIndex(u => u.Email).IsUnique();
        b.Property(u => u.Department).HasMaxLength(80);
    }
}

public class TicketConfiguration : IEntityTypeConfiguration<Ticket>
{
    public const string NumberSequence = "TicketNumbers";

    public void Configure(EntityTypeBuilder<Ticket> b)
    {
        b.Property(t => t.Number).HasDefaultValueSql($"NEXT VALUE FOR {NumberSequence}");
        b.HasIndex(t => t.Number).IsUnique();

        b.Property(t => t.Title).HasMaxLength(150);
        b.Property(t => t.Description).HasMaxLength(4000);

        // The ticket list is almost always filtered by status and sorted by date.
        b.HasIndex(t => new { t.Status, t.CreatedAt });
        b.HasIndex(t => t.AssigneeId);

        b.HasOne(t => t.CreatedBy).WithMany().HasForeignKey(t => t.CreatedById).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(t => t.Assignee).WithMany().HasForeignKey(t => t.AssigneeId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(t => t.Asset).WithMany(a => a.Tickets).HasForeignKey(t => t.AssetId).OnDelete(DeleteBehavior.SetNull);

        b.Ignore(t => t.IsOpen);
    }
}

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> b)
    {
        b.Property(c => c.Body).HasMaxLength(4000);
        b.HasOne(c => c.Ticket).WithMany(t => t.Comments).HasForeignKey(c => c.TicketId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(c => c.Author).WithMany().HasForeignKey(c => c.AuthorId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class TicketEventConfiguration : IEntityTypeConfiguration<TicketEvent>
{
    public void Configure(EntityTypeBuilder<TicketEvent> b)
    {
        b.Property(e => e.FromValue).HasMaxLength(120);
        b.Property(e => e.ToValue).HasMaxLength(120);
        b.HasOne(e => e.Ticket).WithMany(t => t.Events).HasForeignKey(e => e.TicketId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(e => e.Actor).WithMany().HasForeignKey(e => e.ActorId).OnDelete(DeleteBehavior.Restrict);
    }
}

public class AssetConfiguration : IEntityTypeConfiguration<Asset>
{
    public void Configure(EntityTypeBuilder<Asset> b)
    {
        b.Property(a => a.Tag).HasMaxLength(20);
        b.HasIndex(a => a.Tag).IsUnique();
        b.Property(a => a.Name).HasMaxLength(120);
        b.Property(a => a.SerialNumber).HasMaxLength(60);
        b.Property(a => a.Notes).HasMaxLength(1000);
        b.HasOne(a => a.AssignedTo).WithMany().HasForeignKey(a => a.AssignedToId).OnDelete(DeleteBehavior.SetNull);
    }
}
