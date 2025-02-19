using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SgChat.Api.Database;
using SgChat.Api.Infra;
using SgChat.Api.Infra.Models;
using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace SgChat.Api.Features.Auth;

public sealed class LoginEndpoint : IEndpointHandler
{
	public Task Register(IEndpointRouteBuilder builder)
	{
		builder.MapPost("/auth/login", Handler).AllowAnonymous();
		return Task.CompletedTask;
	}

	public sealed record Request(string Username);
	public sealed record Response(string Token, UserId UserId, string Username);

	public async Task<Results<Ok<Response>, BadRequest>> Handler(Request model, SgChatDbContext dbContext)
	{
		var username = model.Username;
		var user = await dbContext.Users.SingleOrDefaultAsync(x => x.Username == username);

		if (user is null)
		{
			user = User.Create(username);
			_ = dbContext.Users.Add(user);
			await dbContext.SaveChangesAsync();
		}

		var claims = (IEnumerable<Claim>)[
			new Claim(ClaimTypes.Name, user.Username),
			new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
		];

		var identity = new ClaimsIdentity(claims, AuthenticationHelpers.AuthenticationScheme);
		var principal = new ClaimsPrincipal(identity);

		var key = new SymmetricSecurityKey(AuthenticationHelpers.SigningKey.ToArray());

		var token = new JwtSecurityToken(
			claims: claims,
			expires: DateTime.UtcNow.AddMinutes(30),
			signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

		var result = new JwtSecurityTokenHandler().WriteToken(token);
		return TypedResults.Ok(new Response(result, user.Id, username));
	}
}
