using Microsoft.EntityFrameworkCore;
using SgChat.Api.Infra.Models;

namespace SgChat.Api.Database;

public sealed class SgChatDbContext(DbContextOptions<SgChatDbContext> options) : DbContext(options)
{
	public DbSet<User> Users { get; private set; }
	public DbSet<Room> Rooms { get; private set; }
	public DbSet<Message> Messages { get; private set; }

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		base.OnModelCreating(modelBuilder);

		//modelBuilder.Entity<User>().Property(m => m.Id)
		//	.HasConversion(id => id.Value, guid => UserId.From(guid));

		//modelBuilder.Entity<Message>().Property(m => m.Id)
		//	.HasConversion(id => id.Value, guid => MessageId.From(guid));

		//modelBuilder.Entity<Room>().Property(m => m.Id)
		//	.HasConversion(id => id.Value, guid => RoomId.From(guid));

	}

	protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
	{
		base.ConfigureConventions(configurationBuilder);
		configurationBuilder.RegisterAllInEfCoreConverters();
	}
}
