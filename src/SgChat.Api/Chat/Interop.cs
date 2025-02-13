namespace SgChat.Api.Chat;

// all these types are mirrored on js side.

public sealed record ChatHubUser(Guid Id, string Username);
public sealed record ChatHubMessage(Guid Id, Guid UserId, string Message);

public interface IChatHubClient
{
	Task SelfJoined(ChatHubUser[] connectedUsers, ChatHubUser[] allUsers, ChatHubMessage[] messages);
	Task MessageReceived(Guid id, Guid userId, string message);
	Task UserJoined(Guid id, string username);
	Task UserLeft(Guid id);
}
