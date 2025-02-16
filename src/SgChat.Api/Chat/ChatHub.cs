using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using SgChat.Api.Database;
using System.Collections.Concurrent;
using System.Security.Claims;
using System.Diagnostics.CodeAnalysis;

namespace SgChat.Api.Chat;

[Authorize]
public sealed class ChatHub(SgChatDbContext dbContext) : Hub<IChatHubClient>
{
	private static readonly ConcurrentDictionary<Guid, ChatHubUser> ConnectedUsers = [];

	[SuppressMessage("Usage", "CA2213:Disposable fields should be disposed", Justification = "DI handles")]
	private readonly SgChatDbContext _dbContext = dbContext;

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

	private Guid GetCurrentUserId()
	{
		if (Context.User is null)
		{
			throw new InvalidOperationException("Missing user");
		}

		var userId = Context.User.FindFirstValue(ClaimTypes.NameIdentifier)
			?? throw new InvalidOperationException("Missing NameIdentifier claim");

		return Guid.Parse(userId);
	}

	public override async Task OnConnectedAsync()
	{
		await base.OnConnectedAsync();

		var user = GetCurrentUser();
		_ = ConnectedUsers.TryAdd(user.Id, user);

		var allUsers = _dbContext.Users.Select(u => new ChatHubUser(u.Id, u.Username)).ToArray();
		var allMessages = _dbContext.Messages.Select(m => new ChatHubMessage(m.Id, m.User.Id, m.Content)).ToArray();

		await Clients.AllExcept(Context.ConnectionId).UserJoined(user.Id, user.Username);

		await Clients.Caller.SelfJoined(
			ConnectedUsers.Values.ToArray(),
			allUsers,
			allMessages);
	}

	public override async Task OnDisconnectedAsync(Exception? exception)
	{
		// OnDisconnectedAsync is NOT called always in debug
		// AAAAAAAAAAAAAAAAAAAAA

		await base.OnDisconnectedAsync(exception);
		_ = ConnectedUsers.Remove(GetCurrentUser().Id, out _);
	}

	public async Task SendMessage(string message)
	{
		var userId = GetCurrentUserId();

		var user = _dbContext.Users.Single(u => u.Id == userId);
		var dbMessage = Message.Create(message, user);

		_dbContext.Messages.Add(dbMessage);
		await _dbContext.SaveChangesAsync();

		await Clients.All.MessageReceived(new ChatHubMessage(dbMessage.Id, user.Id, dbMessage.Content));
	}
}
