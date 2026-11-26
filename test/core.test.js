import test from "node:test";
import assert from "node:assert/strict";

import {
  deepMerge,
  mergeMany,
  defaultMergeOptions,
} from "../src/index.js";

test("merges nested plain objects without mutating either input", () => {
  const target = { a: { b: 1, c: 2 }, keep: true };
  const source = { a: { c: 3, d: 4 } };
  const result = deepMerge(target, source);

  assert.deepEqual(result, { a: { b: 1, c: 3, d: 4 }, keep: true });
  assert.deepEqual(target, { a: { b: 1, c: 2 }, keep: true });
  assert.deepEqual(source, { a: { c: 3, d: 4 } });
  assert.notEqual(result.a, target.a);
});

test("reuses untouched subtrees by reference", () => {
  const shared = { deep: { value: 1 } };
  const target = { shared };
  const result = deepMerge(target, { other: 2 });

  assert.equal(result.shared, shared);
});

test("undefined in the source is skipped, null overwrites", () => {
  const target = { a: 1, b: 2 };
  const result = deepMerge(target, { a: undefined, b: null });

  assert.deepEqual(result, { a: 1, b: null });
});

test("null overwrites an object target value", () => {
  const target = { nested: { a: 1 } };
  const result = deepMerge(target, { nested: null });

  assert.deepEqual(result, { nested: null });
});

test("nullOverwrites: false turns null into a no-op", () => {
  const target = { a: 1, nested: { b: 2 } };
  const result = deepMerge(target, { a: null, nested: null }, { nullOverwrites: false });

  assert.deepEqual(result, { a: 1, nested: { b: 2 } });
});

test("arrays merge by index and append extra source elements", () => {
  const target = { list: [1, 2, 3] };
  const source = { list: [10, 20, 30, 40] };
  const result = deepMerge(target, source);

  assert.deepEqual(result, { list: [10, 20, 30, 40] });
});

test("arrays shorter than the target keep the trailing target elements", () => {
  const result = deepMerge({ list: [1, 2, 3] }, { list: [9] });

  assert.deepEqual(result, { list: [9, 2, 3] });
});

test("arraysByIndex: false replaces the array", () => {
  const target = { list: [1, 2, 3] };
  const sourceList = [9];
  const result = deepMerge(target, { list: sourceList }, { arraysByIndex: false });

  assert.deepEqual(result, { list: [9] });
  assert.notEqual(result.list, sourceList);
});

test("nested objects inside arrays merge recursively", () => {
  const target = { items: [{ a: 1, b: 2 }] };
  const source = { items: [{ b: 3 }] };
  const result = deepMerge(target, source);

  assert.deepEqual(result, { items: [{ a: 1, b: 3 }] });
});

test("a source array against a non-array target replaces it", () => {
  const result = deepMerge({ list: "not an array" }, { list: [1, 2] });

  assert.deepEqual(result, { list: [1, 2] });
});

test("a source object against a scalar target replaces the scalar", () => {
  const result = deepMerge({ value: 5 }, { value: { a: 1 } });

  assert.deepEqual(result, { value: { a: 1 } });
});

test("non-plain objects are replaced, not merged", () => {
  const date = new Date(0);
  const result = deepMerge({ when: null }, { when: date });

  assert.equal(result.when, date);
});

test("mergeMany applies sources left to right", () => {
  const result = mergeMany(
    { a: 1, b: 1, nested: { x: 1 } },
    [{ b: 2 }, { a: 3, nested: { y: 2 } }],
  );

  assert.deepEqual(result, { a: 3, b: 2, nested: { x: 1, y: 2 } });
});

test("mergeMany with no sources returns the target unchanged", () => {
  const target = { a: 1 };
  const result = mergeMany(target, []);

  assert.equal(result, target);
});

test("mergeMany rejects a non-array sources argument", () => {
  assert.throws(() => mergeMany({}, { a: 1 }), TypeError);
});

test("mergeMany accepts options and applies them to every source", () => {
  const result = mergeMany(
    { list: [1, 2] },
    [{ list: [9] }, { list: [8] }],
    { arraysByIndex: false },
  );

  assert.deepEqual(result, { list: [8] });
});

test("deepMerge works when the target is not an object", () => {
  assert.deepEqual(deepMerge(3, { a: 1 }), { a: 1 });
  assert.equal(deepMerge({ a: 1 }, 3), 3);
});

test("deepMerge returns the source when the source is a scalar", () => {
  assert.equal(deepMerge({ a: 1 }, "text"), "text");
  assert.equal(deepMerge({ a: 1 }, false), false);
});

test("defaultMergeOptions is frozen and reflects the documented defaults", () => {
  assert.equal(Object.isFrozen(defaultMergeOptions), true);
  assert.equal(defaultMergeOptions.arraysByIndex, true);
  assert.equal(defaultMergeOptions.nullOverwrites, true);
});

test("own keys only: inherited properties are not copied from the source", () => {
  const source = Object.create({ inherited: 1 });
  source.own = 2;
  const result = deepMerge({}, source);

  assert.deepEqual(result, { own: 2 });
});
