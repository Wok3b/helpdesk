using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace HelpDesk.Api.Common;

// Services throw these; ApiExceptionHandler turns them into RFC 9457 problem responses.
public abstract class AppException(string message, int statusCode, string title) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Title { get; } = title;
}

public class NotFoundException(string what, object id)
    : AppException($"{what} {id} was not found.", StatusCodes.Status404NotFound, "Not found");

public class ForbiddenException(string message)
    : AppException(message, StatusCodes.Status403Forbidden, "Forbidden");

public class BusinessRuleException(string message)
    : AppException(message, StatusCodes.Status400BadRequest, "Request not allowed");

public class ConflictException(string message)
    : AppException(message, StatusCodes.Status409Conflict, "Conflict");

public class ApiExceptionHandler(IProblemDetailsService problemDetails, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, title, detail) = exception switch
        {
            AppException app => (app.StatusCode, app.Title, app.Message),
            _ => (StatusCodes.Status500InternalServerError, "Server error", "Something went wrong on our side.")
        };

        if (status >= 500)
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);

        context.Response.StatusCode = status;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = new ProblemDetails { Status = status, Title = title, Detail = detail }
        });
    }
}
