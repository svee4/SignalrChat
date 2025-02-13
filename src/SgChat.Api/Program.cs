using SgChat.Api.Chat;
using SgChat.Api.Infra;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAuthentication(AuthenticationHelpers.AuthenticationScheme)
	.AddJwtBearer(AuthenticationHelpers.ConfigureJwtBearer(builder.Configuration));

builder.Services.AddControllers();

builder.Services.AddSignalR(options => options.EnableDetailedErrors = builder.Environment.IsDevelopment());
builder.Services.AddCors();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
}

app.UseCors(options => options.WithOrigins("http://localhost:5173").AllowAnyMethod().AllowAnyHeader());

//app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

//app.MapControllers();
Startup.RegisterEndpoints(app);

app.MapHub<ChatHub>("/hub/chat");

app.Run();
