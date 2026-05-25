/* tslint:disable */
/* eslint-disable */

/**
 * Compiles Leo source to Aleo bytecode.
 *
 * Returns JSON: `{ success, output, abi, diagnostics }`.
 */
export function compile(source: string, program_json: string): string;

/**
 * Compile a multi-file project laid out as a virtual filesystem.
 *
 * - `files_json`: a JSON map `{ "<path>": "<contents>" }`. Paths are stored
 *   verbatim; they must be self-consistent (manifest dep paths point at other
 *   keys in this map).
 * - `root`: the path of the project root (the directory containing
 *   `program.json` for the main package).
 *
 * Returns JSON: `{ success, output, abi, imports: [{name, bytecode, abi}],
 * diagnostics }`. `imports` carries the bytecode for every transitively-used
 * source dependency that was emitted by codegen — `.aleo` deps don't appear
 * because they came in pre-compiled.
 */
export function compile_project(files_json: string, root: string): string;

/**
 * Formats Leo source code.
 */
export function format(source: string): string;

export function init(): void;

/**
 * Compiles and runs a Leo function with the provided inputs.
 *
 * Returns JSON: `{ success, output, finalize, diagnostics }`.
 */
export function run(source: string, function_name: string, inputs_json: string, program_json: string): string;

/**
 * Compile a project and run one function.
 *
 * `inputs_json` is the same shape used by [`run`].
 */
export function run_project(files_json: string, root: string, function_name: string, inputs_json: string): string;

/**
 * Compiles main + test source together and runs all `@test` functions.
 *
 * Returns JSON: `{ success, results: [ { name, passed, error } ], diagnostics }`.
 */
export function run_tests(main_source: string, test_source: string, program_json: string): string;

/**
 * Compile a project together with a test package and run every `@test` fn.
 *
 * `test_root` points at the test package's root (its own `program.json`).
 * The test package's manifest must list the main project as a dependency, the
 * same way `leo test` does it.
 */
export function test_project(files_json: string, root: string, test_root: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly compile: (a: number, b: number, c: number, d: number) => [number, number];
    readonly compile_project: (a: number, b: number, c: number, d: number) => [number, number];
    readonly format: (a: number, b: number) => [number, number];
    readonly run: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly run_project: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number];
    readonly run_tests: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly test_project: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
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
