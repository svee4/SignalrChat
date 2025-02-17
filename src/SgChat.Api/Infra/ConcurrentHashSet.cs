using System.Collections;
using System.Collections.Concurrent;
using System.Runtime.CompilerServices;

namespace SgChat.Api.Infra;

// 2025 and we still dont have concurrent hashset in bcl
// anyways, im paid to make it work, not make it pretty, so its just a wrapper over ConcurrentDictionary<T, byte>
[CollectionBuilder(typeof(ConcurrentHashSet), nameof(ConcurrentHashSet.Create))]
public sealed class ConcurrentHashSet<T> : IEnumerable<T>
{
	private readonly ConcurrentDictionary<T, byte> _dictionary = new();

	public ConcurrentHashSet() => _dictionary = new();

	public ConcurrentHashSet(ReadOnlySpan<T> values)
	{
		_dictionary = new();
		foreach (var value in values)
		{
			_dictionary.TryAdd(value, 0);
		}
	}

	public ConcurrentHashSet(IEnumerable<T> values)
	{
		_dictionary = new();
		foreach (var value in values)
		{
			_dictionary.TryAdd(value, 0);
		}
	}

	// thread safety: Keys is a thread safely implemented non-dynamic collection
	public HashSet<T> Snapshot() => [.. _dictionary.Keys];

	public int Count => _dictionary.Count;

	public bool Add(T item) => _dictionary.TryAdd(item, 0);
	public bool Remove(T item) => _dictionary.TryRemove(item, out _);
	public bool Contains(T item) => _dictionary.ContainsKey(item);
	public void Clear() => _dictionary.Clear();

	public IEnumerator<T> GetEnumerator() => (IEnumerator<T>)_dictionary.Keys.ToArray().GetEnumerator();
	IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
}

public static class ConcurrentHashSet
{
	public static ConcurrentHashSet<T> Create<T>(ReadOnlySpan<T> values) => new(values);
}
