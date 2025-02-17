using SgChat.Api.Infra.Models;

namespace SgChat.Api.Database;

public sealed class Room
{
	public RoomId Id { get; private set; }
	public string Name { get; private set; } = null!;

	public ICollection<User> Users { get; private set; } = null!;
	public ICollection<Message> Messages { get; private set; } = null!;

	private Room() { }

	public static Room Create(string name)
	{
		ArgumentNullException.ThrowIfNull(name);

		return new Room
		{
			Id = RoomId.From(Guid.CreateVersion7()),
			Name = name,
			Users = [],
			Messages = []
		};
	}
}
