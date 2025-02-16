namespace SgChat.Api.Chat;

// all these types are mirrored on client side and must be kept in sync.

public sealed record ChatHubUser(Guid Id, string Username);
public sealed record ChatHubMessage(Guid Id, Guid UserId, string Content);

// this interface is implemented on the client side.
public interface IChatHubClient
{
	Task SelfJoined(ChatHubUser[] connectedUsers, ChatHubUser[] allUsers, ChatHubMessage[] messages);
	Task MessageReceived(ChatHubMessage message);
	Task UserJoined(Guid id, string username);
	Task UserLeft(Guid id);
}
