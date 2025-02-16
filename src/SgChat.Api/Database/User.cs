using SgChat.Api.Infra.Models;

namespace SgChat.Api.Database;

public sealed class User
{
	public UserId Id { get; private set; }
	public string Username { get; set; } = null!;

	public ICollection<Room> Rooms { get; private set; } = null!;
	public ICollection<Message> Messages { get; private set; } = null!;

	private User() { }

	public static User Create(string username)
	{
		ArgumentNullException.ThrowIfNull(username);
		return new User
		{
			Username = username,
			Rooms = [],
			Messages = []
		};
	}
}
