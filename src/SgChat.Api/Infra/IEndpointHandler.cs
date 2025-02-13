namespace SgChat.Api.Infra;

public interface IEndpointHandler
{
	Task Register(IEndpointRouteBuilder builder);
}
