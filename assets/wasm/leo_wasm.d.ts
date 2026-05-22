/* tslint:disable */
/* eslint-disable */

/**
 * Compiles Leo source code to Aleo bytecode.
 *
 * Returns JSON: `{ success, output, abi, diagnostics }`.
 */
export function compile(source: string, program_json: string): string;

/**
 * Formats Leo source code.
 */
export function format(source: string): string;

export function init(): void;

/**
 * Compiles and runs a Leo function with the provided inputs.
 *
 * - `inputs_json`: JSON array of strings, e.g. `["1u32", "2u32"]`.
 * - `program_json`: the program.json object as a JSON string.
 *
 * Returns JSON: `{ success, output, diagnostics }`.
 */
export function run(source: string, function_name: string, inputs_json: string, program_json: string): string;

/**
 * Compiles main + test source and runs all `@test` functions.
 *
 * Returns JSON: `{ success, results: [ { name, passed, error } ] }`.
 */
export function run_tests(main_source: string, test_source: string, program_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compile: (a: number, b: number, c: number, d: number) => [number, number];
    readonly format: (a: number, b: number) => [number, number];
    readonly run: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly run_tests: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly init: () => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
