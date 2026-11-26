/**
 * Public entry point for deep-merge-utils.
 *
 * Re-exporting from a single module keeps the import surface small and
 * stable: consumers only ever import from "deep-merge-utils", never from
 * internal paths, so core.js can be reorganised later without a breaking
 * change.
 */
export { deepMerge, mergeMany, defaultMergeOptions } from "./core.js";
