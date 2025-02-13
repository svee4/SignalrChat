using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using SgChat.Api.Infra;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace SgChat.Api.Features.Auth;

//[ApiController]
//[Route("auth")]
public sealed class AuthController : /*ControllerBase,*/ IEndpointHandler
{
	public Task Register(IEndpointRouteBuilder builder)
	{
		builder.MapPost("/auth/login", Login).AllowAnonymous();
		builder.MapGet("/auth/logout", Logout).RequireAuthorization();

		return Task.CompletedTask;
	}

	private static readonly ConcurrentDictionary<string, Guid> KnownUsers = [];

	public sealed class LoginModel
	{
		public required string Username { get; set; }
	}

	public sealed class LoginResponse
	{
		public required string Token { get; set; }
		public required Guid UserId { get; set; }
		public required string Username { get; set; }
	}

	//[HttpPost("login")]
	public LoginResponse Login(LoginModel model)
	{
		var username = model.Username;
		if (!KnownUsers.TryGetValue(username, out var userId))
		{
			userId = Guid.NewGuid();
		}

		_ = KnownUsers.TryAdd(username, userId);

		var claims = (IEnumerable<Claim>)[
			new Claim(ClaimTypes.Name, username),
			new Claim(ClaimTypes.Email, $"{username}@example.com"),
			new Claim(ClaimTypes.NameIdentifier, userId.ToString())
		];

		var identity = new ClaimsIdentity(claims, AuthenticationHelpers.AuthenticationScheme);
		var principal = new ClaimsPrincipal(identity);

		var token = new JwtSecurityToken(
			claims: claims,
			expires: DateTime.UtcNow.AddHours(4),
			signingCredentials: new SigningCredentials(
				new SymmetricSecurityKey(AuthenticationHelpers.SigningKey.ToArray()),
				SecurityAlgorithms.HmacSha256));

		var result = new JwtSecurityTokenHandler().WriteToken(token);
		return new LoginResponse
		{
			Token = result,
			UserId = userId,
			Username = username
		};
	}

	[HttpGet("logout")]
	public async Task Logout(HttpContext context)
	{
		await context.SignOutAsync();
	}
}
