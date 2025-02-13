using System.Diagnostics.CodeAnalysis;

namespace SgChat.Api.Infra;

[SuppressMessage("Design",
	"CA1032:Implement standard exception constructors",
	Justification = "I want standardized error messages")]
public sealed class ConfigurationException : Exception
{
	private ConfigurationException(string message) : base(message) { }

	// these internal Create methods and throw helpers can be made public if needed

	internal static ConfigurationException CreateMissingKey(string key) =>
		new($"Expected configuration value '{key}' was not present in the configuration");

	[DoesNotReturn]
	internal static void ThrowMissingKey(string key) =>
		throw CreateMissingKey(key);

	internal static ConfigurationException CreateUnparsable<T>(string key) where T : IParsable<T> =>
		new($"Unable to parse configuration value '{key}' into {typeof(T).FullName}");

	[DoesNotReturn]
	internal static void ThrowUnparsable<T>(string key) where T : IParsable<T> =>
		throw CreateUnparsable<T>(key);
}
