namespace SgChat.Api.Database;

public sealed class Message
{
	public Guid Id { get; private set; }
	public string Content { get; private set; } = null!;

	public User User { get; private set; } = null!;

	private Message() { }

	public static Message Create(string content, User? user)
	{
		ArgumentNullException.ThrowIfNull(content);

		return new Message
		{
			Id = Guid.Empty,
			Content = content,
			User = user!
		};
	}
}
