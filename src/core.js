/**
 * Core deep-merge implementation.
 *
 * Merge policy (stated once, tested once):
 *   - Plain objects are merged recursively, key by key.
 *   - Arrays are merged by index: element i of the source overwrites element i
 *     of the target, and any extra source elements are appended.
 *   - `null` in the source always overwrites the target value, including when
 *     the target value is an object or array. This is the rule that makes
 *     "clear this field" expressible without deleting the key.
 *   - `undefined` in the source is treated as "no value supplied" and is
 *     skipped, so spreading optional fields over a default does not erase the
 *     default.
 *   - Scalars (string, number, boolean, bigint, symbol, function) overwrite.
 *
 * The trade-off: arrays merge by index rather than being replaced wholesale.
 * Replacement is the more common default in the ecosystem, but it silently
 * discards data when two configurations both describe a list. Index merging
 * keeps both sides, at the cost that removing an element from a list is not
 * possible through merging alone.
 */

/**
 * Options accepted by deepMerge/mergeMany.
 *
 * @typedef {Object} MergeOptions
 * @property {boolean} [arraysByIndex] When false, a source array replaces the
 *   target array instead of merging element by element. Defaults to true.
 * @property {boolean} [nullOverwrites] When false, a source `null` is skipped
 *   like `undefined`. Defaults to true.
 */

/**
 * The default options, frozen so a caller cannot mutate the shared object and
 * silently change behaviour for every other caller in the process.
 *
 * @type {Readonly<MergeOptions>}
 */
export const defaultMergeOptions = Object.freeze({
  arraysByIndex: true,
  nullOverwrites: true,
});

/**
 * True for values that should be merged key-by-key rather than overwritten.
 *
 * Arrays, nulls, Dates, Maps, class instances and functions are all excluded:
 * a Date has no enumerable own keys worth merging, and a class instance's
 * prototype is lost the moment we copy keys onto a fresh object, so treating
 * it as a plain object would be a quiet data-loss bug.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Normalise caller options without mutating the frozen defaults.
 *
 * @param {MergeOptions | undefined} options
 * @returns {{arraysByIndex: boolean, nullOverwrites: boolean}}
 */
function resolveOptions(options) {
  const merged = Object.assign({}, defaultMergeOptions, options);
  return {
    arraysByIndex: merged.arraysByIndex !== false,
    nullOverwrites: merged.nullOverwrites !== false,
  };
}

/**
 * Merge `source` into `target`, returning a new value. Neither argument is
 * mutated; every container that changes is copied, and unchanged subtrees are
 * reused by reference. Reusing untouched subtrees keeps merging large config
 * trees cheap, and is safe because the result is never mutated in place.
 *
 * @param {unknown} target
 * @param {unknown} source
 * @param {MergeOptions} [options]
 * @returns {unknown}
 */
export function deepMerge(target, source, options) {
  const opts = resolveOptions(options);
  return mergeValue(target, source, opts);
}

/**
 * Merge a list of sources left-to-right into `target`.
 *
 * Later sources win, which matches `Object.assign` and `Array.prototype.reduce`
 * intuition and makes precedence read in the same direction as the arguments.
 *
 * @param {unknown} target
 * @param {ReadonlyArray<unknown>} sources
 * @param {MergeOptions} [options]
 * @returns {unknown}
 */
export function mergeMany(target, sources, options) {
  if (!Array.isArray(sources)) {
    throw new TypeError("mergeMany: sources must be an array");
  }
  const opts = resolveOptions(options);
  let result = target;
  for (const source of sources) {
    result = mergeValue(result, source, opts);
  }
  return result;
}

/**
 * The recursive worker. Split out from deepMerge so mergeMany can reuse it
 * without re-resolving options on every step.
 *
 * @param {unknown} target
 * @param {unknown} source
 * @param {{arraysByIndex: boolean, nullOverwrites: boolean}} opts
 * @returns {unknown}
 */
function mergeValue(target, source, opts) {
  if (source === undefined) {
    return target;
  }
  if (source === null) {
    return opts.nullOverwrites ? null : target;
  }
  if (Array.isArray(source)) {
    return mergeArrays(target, source, opts);
  }
  if (isPlainObject(source)) {
    return mergeObjects(target, source, opts);
  }
  return source;
}

/**
 * Merge two arrays. When `arraysByIndex` is off, the source replaces the
 * target outright (a copy, so the caller's array is never aliased).
 *
 * @param {unknown} target
 * @param {unknown[]} source
 * @param {{arraysByIndex: boolean, nullOverwrites: boolean}} opts
 * @returns {unknown[]}
 */
function mergeArrays(target, source, opts) {
  if (!opts.arraysByIndex || !Array.isArray(target)) {
    return source.slice();
  }
  const out = target.slice();
  for (let i = 0; i < source.length; i += 1) {
    if (i < out.length) {
      out[i] = mergeValue(out[i], source[i], opts);
    } else {
      out.push(mergeValue(undefined, source[i], opts));
    }
  }
  return out;
}

/**
 * Merge two plain objects. Keys present only in the target survive; keys in the
 * source are merged recursively so nested defaults are not clobbered by a
 * partial override.
 *
 * The result is always a fresh object with the default prototype, even when
 * `target` had a null prototype. That is deliberate: a null-prototype object is
 * almost always an accident of construction, and callers expect `result.hasOwnProperty`
 * to work.
 *
 * @param {unknown} target
 * @param {Record<string, unknown>} source
 * @param {{arraysByIndex: boolean, nullOverwrites: boolean}} opts
 * @returns {Record<string, unknown>}
 */
function mergeObjects(target, source, opts) {
  const out = {};
  if (isPlainObject(target)) {
    for (const key of Object.keys(target)) {
      out[key] = target[key];
    }
  }
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    if (sourceValue === undefined) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = mergeValue(out[key], sourceValue, opts);
    } else {
      out[key] = mergeValue(undefined, sourceValue, opts);
    }
  }
  return out;
}
