using SgChat.Api.Infra.Models;

namespace SgChat.Api.Database;

public sealed class Message
{
	public MessageId Id { get; private set; }
	public string Content { get; private set; } = null!;

	public User User { get; private set; } = null!;
	public Room Room { get; private set; } = null!;

	private Message() { }

	public static Message Create(string content, User? user, Room? room)
	{
		ArgumentNullException.ThrowIfNull(content);

		return new Message
		{
			Id = MessageId.From(Guid.CreateVersion7()),
			Content = content,
			User = user!,
			Room = room!
		};
	}
}
