using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace SgChat.Api.Chat;

[Authorize]
public sealed class ChatHub : Hub<IChatHubClient>
{
	private static readonly ConcurrentDictionary<Guid, string> ConnectedUsers = [];
	private static readonly HashSet<ChatHubUser> AllUsers = [];
	private static readonly ConcurrentBag<ChatHubMessage> Messages = [];

	private ChatHubUser GetCurrentUser()
	{
		if (Context.User is null)
		{
			throw new InvalidOperationException("Missing user");
		}

		var userId = Context.User.FindFirstValue(ClaimTypes.NameIdentifier) 
			?? throw new InvalidOperationException("Missing NameIdentifier claim");

		var username = Context.User.FindFirstValue(ClaimTypes.Name)
			?? throw new InvalidOperationException("Missing Name claim");

		return new ChatHubUser(Guid.Parse(userId), username);
	}

	public override async Task OnConnectedAsync()
	{
		await base.OnConnectedAsync();

		var user = GetCurrentUser();
		_ = ConnectedUsers.TryAdd(user.Id, Context.ConnectionId);

		// 2025 and we still dont have ConcurrentHashSet
		ChatHubUser[] allUsers;
		lock (AllUsers)
		{
			_ = AllUsers.Add(user);
			allUsers = AllUsers.ToArray();
		}

		await Clients.AllExcept(Context.ConnectionId).UserJoined(user.Id, user.Username);
		await Clients.Caller.SelfJoined(
			AllUsers.IntersectBy(ConnectedUsers.Keys, user => user.Id).ToArray(),
			allUsers,
			Messages.ToArray());
	}

	public override async Task OnDisconnectedAsync(Exception? exception)
	{
		// OnDisconnectedAsync is NOT called always in debug
		// AAAAAAAAAAAAAAAAAAAAA

		await base.OnDisconnectedAsync(exception);
		ConnectedUsers.Remove(GetCurrentUser().Id, out _);
	}

	public async Task SendMessage(string message)
	{
		var user = GetCurrentUser();
		var msg = new ChatHubMessage(Guid.NewGuid(), user.Id, message);

		Messages.Add(msg);
		await Clients.All.MessageReceived(msg.Id, user.Id, message);
	}
}
