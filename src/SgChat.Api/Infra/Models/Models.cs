using Vogen;

namespace SgChat.Api.Infra.Models;

[ValueObject<Guid>] public readonly partial record struct UserId;
[ValueObject<Guid>] public readonly partial record struct RoomId;
[ValueObject<Guid>] public readonly partial record struct MessageId;

[EfCoreConverter<UserId>]
[EfCoreConverter<RoomId>]
[EfCoreConverter<MessageId>]
public sealed partial class EfCoreConverters;
