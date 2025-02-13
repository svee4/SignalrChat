using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace SgChat.Api.Infra;

public static class AuthenticationHelpers
{
	public const string AuthenticationScheme = JwtBearerDefaults.AuthenticationScheme;

	public static ReadOnlySpan<byte> SigningKey => "123123123123123123123123123123122123123123123"u8;

	public static Action<JwtBearerOptions> ConfigureJwtBearer(IConfiguration configuration) =>
		options =>
		{
			//options.Audience = configuration.GetRequiredValue("JWT:Audience");
			//options.Authority = configuration.GetRequiredValue("JWT:Authority");

			options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
			{
				IssuerSigningKey = new SymmetricSecurityKey(SigningKey.ToArray()),
				ValidateActor = false,
				ValidateAudience = false,
				ValidateIssuer = false,
				ValidateIssuerSigningKey = false,
				ValidateLifetime = false,
			};

			options.Events = new JwtBearerEvents()
			{
				OnMessageReceived = context =>
				{
					// https://learn.microsoft.com/en-us/aspnet/core/signalr/authn-and-authz?view=aspnetcore-9.0#built-in-jwt-authentication
					var token = context.Request.Query["access_token"];

					if (context.Request.Path.StartsWithSegments("/hub", StringComparison.OrdinalIgnoreCase)
						&& !string.IsNullOrEmpty(token))
					{
						context.Token = token;
					}

					return Task.CompletedTask;
				}
			};
		};
}
