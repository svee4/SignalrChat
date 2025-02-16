using Microsoft.EntityFrameworkCore;

namespace SgChat.Api.Database;

public sealed class SgChatDbContext(DbContextOptions<SgChatDbContext> options) : DbContext(options)
{
	public DbSet<User> Users { get; private set; }
	public DbSet<Message> Messages { get; private set; }
}
