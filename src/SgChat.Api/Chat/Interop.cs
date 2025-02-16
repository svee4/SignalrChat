using SgChat.Api.Infra.Models;

namespace SgChat.Api.Chat;

// all these types are mirrored on client side and must be kept in sync.

public sealed record ChatHubRoom(RoomId Id, string Name);
public sealed record ChatHubUser(UserId Id, string Username);
public sealed record ChatHubMessage(MessageId Id, RoomId RoomId, UserId UserId, string Content);

// this interface is implemented on the client side.
public interface IChatHubClient
{
	Task OnConnected(ChatHubRoom[] rooms);
	Task SelfJoinedRoom(ChatHubUser[] connectedUsers, ChatHubUser[] allUsers, ChatHubMessage[] messages);
	Task MessageReceived(ChatHubMessage message);
	Task UserJoinedRoom(UserId userId, RoomId roomId, string username);
	Task UserLeftRoom(UserId userId, RoomId roomId);
}
