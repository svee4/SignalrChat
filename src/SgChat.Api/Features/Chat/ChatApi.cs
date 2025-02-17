using SgChat.Api.Infra;

namespace SgChat.Api.Features.Chat;

public sealed class ChatApi : IEndpointHandler
{
	public Task Register(IEndpointRouteBuilder builder)
	{
		return Task.CompletedTask;
	}


}
