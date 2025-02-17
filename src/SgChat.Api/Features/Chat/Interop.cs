using SgChat.Api.Infra.Models;

namespace SgChat.Api.Features.Chat;

// all these types are mirrored on client side and must be kept in sync.

public sealed record ChatHubRoom(RoomId Id, string Name);
public sealed record ChatHubUser(UserId Id, string Username);
public sealed record ChatHubMessage(MessageId Id, RoomId RoomId, UserId UserId, string Content);

// this interface is implemented on client side and called from server.
public interface IChatHubClient
{
	Task OnConnected(ChatHubRoom[] joinedRooms, ChatHubRoom[] availableRooms);
	Task MessageReceived(ChatHubMessage message);

	Task RoomCreated(ChatHubRoom room);

	Task UserJoinedRoom(UserId userId, RoomId roomId, string username);
	Task UserLeftRoom(UserId userId, RoomId roomId);

	Task UserOpenedRoom(UserId userId, RoomId roomId);
	Task UserClosedRoom(UserId userId, RoomId roomId);
}

// this interface is implemented on server side and called from client.
public interface IChatHubServer
{
	Task SendMessage(RoomId roomId, string content);

	Task CreateRoom(string name);

	Task JoinRoom(RoomId roomId);
	Task LeaveRoom(RoomId roomId);

	Task<OpenRoomResponse> OpenRoom(RoomId roomId);
	Task CloseRoom(RoomId roomId);
}

public sealed record CreateRoomResponse(RoomId RoomId);
public sealed record OpenRoomResponse(ChatHubUser[] AllUsers, ChatHubUser[] ConnectedUsers, ChatHubMessage[] Messages);
