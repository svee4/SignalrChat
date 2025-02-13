using System.Diagnostics;

namespace SgChat.Api.Infra;

public abstract class Startup
{
	public static void RegisterEndpoints(WebApplication app)
	{
		var endpoints = typeof(Startup).Assembly.GetTypes()
			.Where(type => type.GetInterface(nameof(IEndpointHandler)) is not null)
			.ToList();

		foreach (var endpoint in endpoints)
		{
			var instance = (IEndpointHandler)(Activator.CreateInstance(endpoint)
				?? throw new UnreachableException($"Could not create instance of endpoint {endpoint.FullName}"));

			_ = instance.Register(app);
		}

		app.Services.GetRequiredService<ILogger<Startup>>()
			.LogInformation("Mapped {Count} endpoint handlers", endpoints.Count);
	}
}
