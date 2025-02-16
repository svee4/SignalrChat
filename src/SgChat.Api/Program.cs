using Microsoft.EntityFrameworkCore;
using SgChat.Api.Chat;
using SgChat.Api.Database;
using SgChat.Api.Infra;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<SgChatDbContext>(options => options
	.UseNpgsql(builder.Configuration.GetRequiredValue("SgChatConnectionString"))
	.EnableDetailedErrors(builder.Environment.IsDevelopment())
);

builder.Services.AddAuthentication(AuthenticationHelpers.AuthenticationScheme)
	.AddJwtBearer(AuthenticationHelpers.ConfigureJwtBearer(builder.Configuration));

builder.Services.AddSignalR(options => options.EnableDetailedErrors = builder.Environment.IsDevelopment());
builder.Services.AddCors();

var app = builder.Build();

// not using Program for the category name because it doesnt have a namespace
var startupLogger = app.Services.GetRequiredService<ILogger<Startup>>();

if (app.Environment.IsDevelopment())
{
	// not using https in development because its not automatic for svelte,
	// and CORS doesnt like mixing http with https
}
else
{
	app.UseHttpsRedirection();
}

// cant allow * in development because signalr doesnt like it
var corsAllowOrigins = builder.Configuration.GetRequiredValue("CorsAllowOrigins").Split(';');
startupLogger.LogInformation("Allowing CORS origins: {Origins}", corsAllowOrigins);
app.UseCors(options => options.WithOrigins(corsAllowOrigins).AllowAnyMethod().AllowAnyHeader());

app.UseAuthentication();
app.UseAuthorization();

Startup.RegisterEndpoints(app);

app.MapHub<ChatHub>("/hub/chat");

app.Run();
