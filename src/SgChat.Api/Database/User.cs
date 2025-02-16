namespace SgChat.Api.Database;

public sealed class User
{
	public Guid Id { get; private set; }
	public string Username { get; set; } = null!;

	public ICollection<Message> Messages { get; private set; } = null!;

	private User() { }

	public static User Create(string username)
	{
		ArgumentNullException.ThrowIfNull(username);
		return new User
		{
			Id = Guid.Empty,
			Username = username,
		};
	}
}
