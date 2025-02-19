using SgChat.Api.Infra.Models;
using System.Text.Json;

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

public abstract record HubError(string Code, string? ErrorMessage)
{
	// there is no way to pass structured data in the error
	// thus we have to do this bastardized way to ease parsing on client side
	public virtual string Serialize() =>
		$"STARTHUBERROR:{JsonSerializer.Serialize(this, options: JsonSerializerOptions.Web)}:ENDHUBERROR";
}

public sealed record InvalidArgumentError(string Parameter)
	: HubError(nameof(InvalidArgumentError), $"Parameter {Parameter} was invalid");

public sealed record RoomAlreadyExistsError(string RoomName)
	: HubError(nameof(RoomAlreadyExistsError), $"Room {RoomName} already exists");

public sealed record RoomNotFoundError(RoomId RoomId)
	: HubError(nameof(RoomNotFoundError), $"Room {RoomId} not found");

public sealed record UserHasNotJoinedRoomError(RoomId RoomId)
	: HubError(nameof(UserHasNotJoinedRoomError), $"User has not joined room {RoomId}");
