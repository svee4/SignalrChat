using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SgChat.Api.Database;
using System.Collections.Concurrent;
using System.Security.Claims;
using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using SgChat.Api.Infra.Models;
using SgChat.Api.Infra;

namespace SgChat.Api.Features.Chat;

[Authorize]
public sealed class ChatHub(SgChatDbContext dbContext) : Hub<IChatHubClient>, IChatHubServer
{
	private static readonly ConcurrentDictionary<RoomId, ConcurrentHashSet<UserId>> ConnectedRoomUsers = [];

	[SuppressMessage("Usage", "CA2213:Disposable fields should be disposed", Justification = "DI handles")]
	private readonly SgChatDbContext _dbContext = dbContext;

	public override async Task OnConnectedAsync()
	{
		await base.OnConnectedAsync();

		var userId = GetCurrentUserId();

		// im sure theres some fancy way of doing this in one query
		var joinedRooms = await _dbContext.Rooms
			.Where(room => room.Users.Any(user => user.Id == userId))
			.Select(room => new ChatHubRoom(room.Id, room.Name))
			.ToArrayAsync();

		var availableRooms = await _dbContext.Rooms
			.Where(room => !room.Users.Any(user => user.Id == userId))
			.Select(room => new ChatHubRoom(room.Id, room.Name))
			.ToArrayAsync();

		await Clients.Caller.OnConnected(joinedRooms, availableRooms);
	}

	public override async Task OnDisconnectedAsync(Exception? exception)
	{
		// OnDisconnectedAsync is NOT called always in debug
		// AAAAAAAAAAAAAAAAAAAAA

		await base.OnDisconnectedAsync(exception);

		var userId = GetCurrentUserId();
		var userRooms = ConnectedRoomUsers.Where(kvp => kvp.Value.Contains(userId));

		foreach (var (key, set) in userRooms)
		{
			_ = set.Remove(userId);
			await Clients.Group(GetRoomGroupName(key)).UserClosedRoom(userId, key);
		}
	}

	public async Task CreateRoom(string name)
	{
		if (string.IsNullOrEmpty(name))
		{
			throw HubError(new InvalidArgumentError(nameof(name)));
		}

		if (await _dbContext.Rooms.AnyAsync(room => room.Name == name))
		{
			throw HubError(new RoomAlreadyExistsError(name));
		}

		var room = Room.Create(name);
		_ = _dbContext.Rooms.Add(room);
		_ = await _dbContext.SaveChangesAsync();

		await Clients.All.RoomCreated(new ChatHubRoom(room.Id, room.Name));
	}

	public async Task JoinRoom(RoomId roomId)
	{
		var room = await _dbContext.Rooms.FirstOrDefaultAsync(room => room.Id == roomId);

		if (room is null)
		{
			throw HubError(new RoomNotFoundError(roomId));
		}

		var userId = GetCurrentUserId();
		var user = await _dbContext.Users.Include(user => user.Rooms).SingleAsync(u => u.Id == userId);

		user.Rooms.Add(room);
		_ = await _dbContext.SaveChangesAsync();
	}

	public async Task LeaveRoom(RoomId roomId)
	{
		var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == roomId);

		if (room is null)
		{
			throw HubError(new RoomNotFoundError(roomId));
		}

		var userId = GetCurrentUserId();
		var user = await _dbContext.Users.Include(user => user.Rooms).SingleAsync(u => u.Id == userId);

		_ = user.Rooms.Remove(room);
		_ = await _dbContext.SaveChangesAsync();
	}

	public async Task<OpenRoomResponse> OpenRoom(RoomId roomId)
	{
		var userId = GetCurrentUserId();
		var user = await _dbContext.Users
			.Where(user => user.Id == userId)
			.Select(user => new
			{
				Rooms = user.Rooms.Select(room => room.Id).ToArray()
			})
			.SingleAsync();

		var room = await _dbContext.Rooms
			.Where(room => room.Id == roomId)
			.Select(room => new
			{
				room.Id,
				Room = room,
				Users = room.Users
					.Select(u => new ChatHubUser(u.Id, u.Username))
					.ToArray(),
				Messages = room.Messages
					.Select(message => new ChatHubMessage(message.Id, room.Id, message.User.Id, message.Content))
					.ToArray()
			})
			.FirstOrDefaultAsync();

		if (room is null)
		{
			throw HubError(new RoomNotFoundError(roomId));
		}

		if (!user.Rooms.Contains(room.Id))
		{
			throw HubError(new UserHasNotJoinedRoomError(roomId));
		}

		ChatHubUser[] connectedUsers;
		if (ConnectedRoomUsers.TryGetValue(room.Id, out var users))
		{
			connectedUsers = users.Snapshot()
				.Select(userId => room.Users.First(user => user.Id == userId))
				.ToArray();
		}
		else
		{
			connectedUsers = [];
		}

		_ = ConnectedRoomUsers.AddOrUpdate(room.Id, _ => [userId], (_0, set) =>
		{
			_ = set.Add(userId);
			return set;
		});

		var group = GetRoomGroupName(room.Id);

		await Groups.AddToGroupAsync(Context.ConnectionId, group);
		await Clients.Group(group).UserOpenedRoom(userId, room.Id);

		return new OpenRoomResponse(room.Users, connectedUsers, room.Messages);
	}

	public async Task CloseRoom(RoomId roomId)
	{
		var userId = GetCurrentUserId();

		if (ConnectedRoomUsers.TryGetValue(roomId, out var users))
		{
			// TODO: should empty rooms be removed?
			_ = users.Remove(userId);
		}

		var group = GetRoomGroupName(roomId);

		await Clients.Group(group).UserClosedRoom(userId, roomId);
		await Groups.RemoveFromGroupAsync(Context.ConnectionId, group);
	}

	public async Task SendMessage(RoomId roomId, string content)
	{
		if (string.IsNullOrEmpty(content))
		{
			throw HubError(new InvalidArgumentError(nameof(content)));
		}

		var userId = GetCurrentUserId();
		var user = await _dbContext.Users.SingleAsync(u => u.Id == userId);
		var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == roomId);

		if (room is null)
		{
			throw HubError(new RoomNotFoundError(roomId));
		}

		var dbMessage = Message.Create(content, user, room);
		_ = _dbContext.Messages.Add(dbMessage);

		var dbTask = _dbContext.SaveChangesAsync();

		var sgTask = Clients
			.Group(GetRoomGroupName(room.Id))
			.MessageReceived(new ChatHubMessage(dbMessage.Id, room.Id, user.Id, dbMessage.Content));

		await Task.WhenAll(dbTask, sgTask);
	}

	private UserId GetCurrentUserId()
	{
		if (Context.User is null)
		{
			throw new InvalidOperationException("Missing user");
		}

		var userId = Context.User.FindFirstValue(ClaimTypes.NameIdentifier)
			?? throw new InvalidOperationException("Missing NameIdentifier claim");

		return UserId.From(Guid.Parse(userId));
	}

	private static HubException HubError(HubError error, Exception? exception = null) =>
		new HubException(error.Serialize(), exception);

	private static string GetRoomGroupName(RoomId roomId) => $"Room-{roomId}";
}
