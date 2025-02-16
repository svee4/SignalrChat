using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SgChat.Api.Database;
using System.Collections.Concurrent;
using System.Security.Claims;
using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using SgChat.Api.Infra.Models;
using SgChat.Api.Infra;

namespace SgChat.Api.Chat;

[Authorize]
public sealed class ChatHub(SgChatDbContext dbContext) : Hub<IChatHubClient>
{
	private static readonly ConcurrentDictionary<RoomId, ConcurrentHashSet<UserId>> ConnectedRoomUsers = [];

	[SuppressMessage("Usage", "CA2213:Disposable fields should be disposed", Justification = "DI handles")]
	private readonly SgChatDbContext _dbContext = dbContext;

	public override async Task OnConnectedAsync()
	{
		await base.OnConnectedAsync();

		var rooms = await _dbContext.Rooms.Select(room => new ChatHubRoom(room.Id, room.Name)).ToArrayAsync();
		await Clients.Caller.OnConnected(rooms);
	}

	public override async Task OnDisconnectedAsync(Exception? exception)
	{
		// OnDisconnectedAsync is NOT called always in debug
		// AAAAAAAAAAAAAAAAAAAAA

		await base.OnDisconnectedAsync(exception);

		var userId = GetCurrentUserId();
		var userRooms = ConnectedRoomUsers.Values.Where(users => users.Contains(userId));
		foreach (var set in userRooms)
		{
			_ = set.Remove(userId);
		}
	}

	public async Task JoinRoom(Guid roomId)
	{
		var userId = GetCurrentUserId();
		var user = await _dbContext.Users.Include(user => user.Rooms).SingleAsync(u => u.Id == userId);

		var room = await _dbContext.Rooms
			.Include(room => room.Messages)
			.ThenInclude(message => message.User.Id)
			.FirstOrDefaultAsync(r => r.Id == roomId);

		if (room is null)
		{
			throw new HubException(null, new InvalidOperationException("No such room"));
		}

		user.Rooms.Add(room);
		_ = await _dbContext.SaveChangesAsync();

		_ = ConnectedRoomUsers.AddOrUpdate(room.Id, _ => [userId], (_0, set) =>
		{
			_ = set.Add(userId);
			return set;
		});

		var allUsers = await _dbContext.Users
			.Where(u => u.Rooms.Contains(room))
			.Select(u => new ChatHubUser(u.Id, u.Username))
			.ToArrayAsync();

		ChatHubUser[] connectedUsers;
		if (ConnectedRoomUsers.TryGetValue(room.Id, out var users))
		{
			var set = users.Snapshot();
			connectedUsers = allUsers.IntersectBy(set, user => user.Id).ToArray();
		}
		else
		{
			connectedUsers = [];
		}

		var messages = room.Messages
			.Select(message => new ChatHubMessage(message.Id, room.Id, message.User.Id, message.Content))
			.ToArray();

		var roomGroupName = GetRoomGroupName(room.Id);

		await Groups.AddToGroupAsync(Context.ConnectionId, roomGroupName);
		await Clients.Caller.SelfJoinedRoom(connectedUsers, allUsers, messages);
		await Clients.Group(roomGroupName).UserJoinedRoom(user.Id, room.Id, user.Username);
	}

	public async Task LeaveRoom(Guid roomId)
	{
		var userId = GetCurrentUserId();
		var user = await _dbContext.Users.Include(user => user.Rooms).SingleAsync(u => u.Id == userId);
		var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == roomId);

		if (room is null)
		{
			throw new HubException(null, new InvalidOperationException("No such room"));
		}

		_ = user.Rooms.Remove(room);
		_ = await _dbContext.SaveChangesAsync();

		if (ConnectedRoomUsers.TryGetValue(room.Id, out var users))
		{
			_ = users.Remove(userId);

			if (users.Count == 0)
			{
				lock (users)
				{
					if (users.Count == 0)
					{
						_ = ConnectedRoomUsers.TryRemove(room.Id, out _);
					}
				}
			}
		}

		var roomGroupName = GetRoomGroupName(room.Id);

		await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomGroupName);
		await Clients.Group(roomGroupName).UserLeftRoom(user.Id, room.Id);
	}

	public async Task SendMessage(Guid roomId, string message)
	{
		if (message is null)
		{
			throw new HubException(null, new ArgumentNullException(nameof(message)));
		}

		var userId = GetCurrentUserId();
		var user = await _dbContext.Users.SingleAsync(u => u.Id == userId);
		var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == roomId);

		if (room is null)
		{
			throw new HubException(null, new InvalidOperationException("No such room"));
		}

		var dbMessage = Message.Create(message, user, room);
		_dbContext.Messages.Add(dbMessage);
		_ = await _dbContext.SaveChangesAsync();

		await Clients.Group(GetRoomGroupName(room.Id))
			.MessageReceived(new ChatHubMessage(dbMessage.Id, room.Id, user.Id, dbMessage.Content));
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

	private static string GetRoomGroupName(RoomId roomId) => $"Room-{roomId}";
}
