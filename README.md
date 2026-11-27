# deep-merge-utils

Deep-merges plain objects, merging arrays by index and letting `null` overwrite.

```js
import { deepMerge, mergeMany } from "deep-merge-utils";

const defaults = { retries: 3, tags: ["a", "b"], log: { level: "info" } };
const overrides = { tags: ["c"], log: { level: "debug" } };

const config = deepMerge(defaults, overrides);
// { retries: 3, tags: ["c", "b"], log: { level: "debug" } }

const layered = mergeMany(
  { retries: 3, tags: ["a", "b"] },
  [{ tags: ["c"] }, { retries: 5 }],
);
// { retries: 5, tags: ["c", "b"] }
```

The named exports are `deepMerge(target, source, options?)`,
`mergeMany(target, sources, options?)` and the frozen `defaultMergeOptions`.

## Why this exists

Most deep-merge helpers either replace arrays wholesale or concatenate them.
Both lose information in a layered configuration: replacement drops the base
list, concatenation produces duplicates you then have to deduplicate by hand.
This library merges arrays positionally instead — element `i` of the override
replaces element `i` of the base, and any extra override elements are appended.
The trade-off is that you cannot shorten a list through merging; a shorter
override leaves the base's trailing elements in place. If you need to remove
elements, pass a replacement array and set `arraysByIndex: false` for that
call, or clear the field with `null`.

`null` is the explicit "clear this" signal: it always overwrites, including
when the base value is an object or an array. `undefined` is the opposite — it
means "no value supplied" and is skipped, so spreading an object with optional
fields over a default does not erase the default.

## Options

Both functions take a third `options` argument:

- `arraysByIndex` (default `true`) — when `false`, a source array replaces the
target array instead of merging into it.
- `nullOverwrites` (default `true`) — when `false`, a source `null` is skipped
like `undefined`.

Options are resolved against the frozen `defaultMergeOptions`, so passing a
partial object is safe and the defaults cannot be mutated by a caller.

## The edge you will hit

Only plain objects are merged. A `Date`, `Map`, class instance or function in
the source replaces the target value outright, because copying enumerable keys
off such a value would silently drop its prototype and internal state. If you
need two `Date`s combined, do it before calling `deepMerge`.

Neither input is mutated. Changed containers are copied, and untouched
subtrees are reused by reference, so `result.someUntouchedBranch` may be the
same object as `target.someUntouchedBranch`. Treat the result as read-only if
you plan to share it.
