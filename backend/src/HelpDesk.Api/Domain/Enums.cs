namespace HelpDesk.Api.Domain;

public enum UserRole
{
    Employee,
    Technician,
    Admin
}

public enum TicketStatus
{
    New,
    InProgress,
    WaitingOnUser,
    Resolved,
    Closed
}

public enum TicketPriority
{
    Low,
    Medium,
    High,
    Critical
}

public enum TicketCategory
{
    Hardware,
    Software,
    Network,
    Access,
    Other
}

public enum AssetType
{
    Laptop,
    Desktop,
    Monitor,
    Printer,
    Phone,
    NetworkDevice,
    Other
}

public enum AssetStatus
{
    InUse,
    InStock,
    InRepair,
    Retired
}

public enum TicketEventType
{
    Created,
    StatusChanged,
    Assigned,
    PriorityChanged,
    Commented
}
