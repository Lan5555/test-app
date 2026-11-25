import {
  type Binary,
  type Expr,
  type HostRequest,
  type HttpMethod,
  type Instruction,
  isEndpointPath,
  type Program,
  type Unary,
} from "./ir";
import { type DataType, type Location, typeOf, type Value } from "./model";
import {
  escapeHtml,
  isHttpsUrl,
  isSha256Digest,
  missingSecurityHeaders,
  redactEmails,
  urlOrigin,
} from "./security";

export type RuntimeValue = Value | undefined;
export type Control = "pause" | "resume" | "into" | "over" | "stop";
export type Status = "running" | "paused" | "complete" | "stopped" | "error";
export type Trace = {
  at: Location;
  step: number;
  depth: number;
  variables: Record<string, string>;
  inputs: string[];
  outputs: { at: Location; value: string }[];
};
export type RuntimeEvent =
  | {
      kind: "status";
      status: Status;
      at?: Location;
      message?: string;
      variables?: Trace["variables"];
    }
  | { kind: "trace"; trace: Trace }
  | { kind: "output"; value: string }
  | { kind: "response"; status: number; body: Value | null };

type Frame = Map<string, RuntimeValue>;
type Signal =
  | { kind: "break" | "continue" }
  | { kind: "return"; value: RuntimeValue };
const numeric = (value: RuntimeValue) => value as number;
const string = (value: RuntimeValue) => value as string;
const binary: Record<
  Binary,
  (left: RuntimeValue, right: RuntimeValue) => RuntimeValue
> = {
  add: (a, b) => numeric(a) + numeric(b),
  subtract: (a, b) => numeric(a) - numeric(b),
  multiply: (a, b) => numeric(a) * numeric(b),
  divide: (a, b) => numeric(a) / numeric(b),
  modulo: (a, b) => numeric(a) % numeric(b),
  power: (a, b) => numeric(a) ** numeric(b),
  minimum: (a, b) => Math.min(numeric(a), numeric(b)),
  maximum: (a, b) => Math.max(numeric(a), numeric(b)),
  equal: (a, b) => a === b,
  notEqual: (a, b) => a !== b,
  greater: (a, b) => numeric(a) > numeric(b),
  less: (a, b) => numeric(a) < numeric(b),
  atLeast: (a, b) => numeric(a) >= numeric(b),
  atMost: (a, b) => numeric(a) <= numeric(b),
  and: (a, b) => Boolean(a && b),
  or: (a, b) => Boolean(a || b),
  xor: (a, b) => a !== b,
  concat: (a, b) => {
    if (string(a).length + string(b).length > 32768)
      throw new Error("A string exceeds the execution size limit.");
    return string(a) + string(b);
  },
};
const unary: Record<Unary, (value: RuntimeValue) => RuntimeValue> = {
  not: (value) => !value,
  string: String,
  number: Number,
  boolean: Boolean,
  round: (value) => Math.round(numeric(value)),
  floor: (value) => Math.floor(numeric(value)),
  ceil: (value) => Math.ceil(numeric(value)),
  sqrt: (value) => Math.sqrt(numeric(value)),
  abs: (value) => Math.abs(numeric(value)),
  length: (value) => (value as string | Value[]).length,
  upper: (value) => string(value).toUpperCase(),
  lower: (value) => string(value).toLowerCase(),
  trim: (value) => string(value).trim(),
  isHttpsUrl: (value) => isHttpsUrl(string(value)),
  escapeHtml: (value) => escapeHtml(string(value)),
  urlOrigin: (value) => urlOrigin(string(value)),
  redactEmails: (value) => redactEmails(string(value)),
  isSha256Digest: (value) => isSha256Digest(string(value)),
  missingSecurityHeaders: (value) =>
    missingSecurityHeaders(value as Record<string, unknown>),
  json: (value) => String(JSON.stringify(value)),
};
export function display(value: RuntimeValue): string {
  return (
    value !== null && typeof value === "object"
      ? JSON.stringify(value)
      : String(value)
  ).slice(0, 2000);
}
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const label = (symbol: string) => symbol.slice(symbol.indexOf(":") + 1);
const visible = (symbols: string[], frame: Frame) =>
  Object.fromEntries(
    symbols.map((name) => [
      label(name),
      frame.has(name) ? display(frame.get(name)) : "undefined",
    ]),
  );
export const limits = {
  steps: 4000,
  iterations: 1000,
  recursion: 24,
  milliseconds: 10000,
  values: 50000,
};

export function startRuntime(
  program: Program,
  emit: (event: RuntimeEvent) => void,
  options: {
    debug?: boolean;
    speed?: number;
    trace?: boolean;
    host?: (request: HostRequest) => Promise<Value>;
    preview?: { graphId: string; body: Value | null };
  } = {},
) {
  let state: Status = "running";
  let current: Location | undefined;
  let depth = 0;
  let calls = 0;
  let overDepth: number | undefined;
  let paused = !!options.debug;
  let stepMode = false;
  let steps = 0;
  let evaluations = 0;
  let pausedAt = 0;
  let timeout = performance.now() + limits.milliseconds;
  let wake: (() => void) | undefined;
  let outputs = 0;
  let requests = 0;
  let cancelHost: (() => void) | undefined;
  let sizes = new WeakMap<object, number>();
  const aliases = new WeakMap<
    object,
    { frame: Frame; name: string; valueType?: DataType }
  >();
  function target(value: RuntimeValue) {
    const binding =
      value && typeof value === "object" ? aliases.get(value) : undefined;
    if (!binding)
      throw new Error("This pointer or reference has no variable target.");
    return binding;
  }
  function size(value: RuntimeValue): number {
    if (typeof value === "string") return value.length + 2;
    if (!value || typeof value !== "object") return 6;
    const known = sizes.get(value);
    if (known !== undefined) return known;
    let total = 2;
    for (const [key, item] of Object.entries(value)) {
      total += key.length + size(item) + 4;
      if (total > 32768)
        throw new Error("A collection exceeds the execution size limit.");
    }
    sizes.set(value, total);
    return total;
  }
  const functions = new Map(
    program.functions.map((definition) => [definition.name, definition]),
  );
  function setStatus(
    status: Status,
    message?: string,
    variables?: Trace["variables"],
  ) {
    state = status;
    emit({ kind: "status", status, at: current, message, variables });
  }
  function control(command: Control) {
    if (["complete", "stopped", "error"].includes(state)) return;
    if (command === "stop") {
      setStatus("stopped");
      cancelHost?.();
      wake?.();
      return;
    }
    if (command === "pause") {
      paused = true;
      return;
    }
    paused = false;
    stepMode = command === "into";
    overDepth = command === "over" ? depth : undefined;
    if (state === "paused") {
      timeout += performance.now() - pausedAt;
      setStatus("running");
      wake?.();
    }
  }
  function check() {
    if (state === "stopped") throw new Error("Execution stopped.");
    if (performance.now() > timeout)
      throw new Error("Execution ran out of time.");
  }
  async function host(request: HostRequest): Promise<Value> {
    if (++requests > 4)
      throw new Error(
        "This run reached its limit of four connected API or AI requests.",
      );
    if (!options.host)
      throw new Error("Connect the required service in Blueprint Studio.");
    const before = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        options.host(request),
        new Promise<never>((_, reject) => {
          cancelHost = () => reject(new Error("Execution stopped."));
          timer = setTimeout(
            () =>
              reject(new Error("The connected service did not reply in time.")),
            35_000,
          );
        }),
      ]);
      if (size(result) > 32768)
        throw new Error("This response exceeds the execution size limit.");
      return result;
    } finally {
      timeout += performance.now() - before;
      clearTimeout(timer);
      cancelHost = undefined;
    }
  }
  async function projectRequest(
    method: HttpMethod,
    path: string,
    body: Value | null,
  ) {
    if (!isEndpointPath(path))
      throw new Error("Use a project endpoint path like /example.");
    const routes = (program.endpoints ?? []).filter(
      (route) => route.path === path,
    );
    const route = routes.find((route) => route.method === method);
    if (!route) return { status: routes.length ? 405 : 404, body: null };
    const result = await invoke(route.handler, [method, path, body]);
    return result?.kind === "return"
      ? (result.value as { status: number; body: Value | null })
      : { status: 204, body: null };
  }
  async function invoke(name: string, values: RuntimeValue[]) {
    const definition = functions.get(name);
    if (!definition || calls >= limits.recursion)
      throw new Error("The call reached its recursion limit.");
    const frame = new Map(
      definition.parameters.map((parameter, index) => [
        parameter,
        values[index],
      ]),
    );
    depth++;
    calls++;
    try {
      return await block(definition.body, frame, definition.parameters);
    } finally {
      depth--;
      calls--;
    }
  }
  async function checkpoint(
    instruction: Instruction,
    frame: Frame,
    symbols: string[],
  ) {
    current = instruction.at;
    if (++steps > limits.steps)
      throw new Error("Execution reached the maximum number of steps.");
    if (options.speed) {
      const before = performance.now();
      await wait(Math.min(250, Math.max(0, options.speed)));
      timeout += performance.now() - before;
    } else if (steps % 16 === 0) await wait(0);
    check();
    if (
      paused ||
      (overDepth !== undefined && depth <= overDepth) ||
      (options.debug &&
        (instruction.breakpoint || instruction.kind === "breakpoint"))
    ) {
      overDepth = undefined;
      paused = true;
      pausedAt = performance.now();
      await new Promise<void>((resolve) => {
        wake = resolve;
        setStatus("paused", undefined, visible(symbols, frame));
      });
      wake = undefined;
      check();
    }
    if (stepMode) {
      paused = true;
      stepMode = false;
    }
  }
  function evaluate(
    expr: Expr,
    frame: Frame,
    observed: Trace["outputs"],
  ): RuntimeValue {
    if (++evaluations > limits.values)
      throw new Error("Execution reached the data evaluation limit.");
    const read = (value: Expr) => evaluate(value, frame, observed);
    let result: RuntimeValue;
    switch (expr.kind) {
      case "literal":
        result =
          expr.value && typeof expr.value === "object"
            ? structuredClone(expr.value)
            : expr.value;
        break;
      case "read":
        result = frame.get(expr.name);
        break;
      case "classValue":
        result = { name: expr.name, fields: expr.fields };
        break;
      case "instantiate": {
        const definition = read(expr.definition) as
          | { fields?: Value }
          | undefined;
        if (!definition?.fields || typeOf(definition.fields) !== "object")
          throw new Error("Connect Define Class to New Instance.");
        result = structuredClone(definition.fields);
        break;
      }
      case "address": {
        result = null;
        if (expr.name) {
          result = {};
          aliases.set(result, {
            frame,
            name: expr.name,
            valueType: expr.valueType,
          });
        }
        break;
      }
      case "readAddress": {
        const binding = target(read(expr.target));
        result = binding.frame.get(binding.name);
        if (
          expr.valueType &&
          expr.valueType !== "any" &&
          typeOf(result) !== expr.valueType
        )
          throw new Error(
            `This alias does not contain a ${expr.valueType} value.`,
          );
        break;
      }
      case "isNullAddress":
        result = read(expr.target) == null;
        break;
      case "binary": {
        const left = read(expr.left);
        if (expr.op === "and" && !left) result = false;
        else if (expr.op === "or" && left) result = true;
        else result = binary[expr.op](left, read(expr.right));
        break;
      }
      case "unary":
        result = unary[expr.op](read(expr.value));
        break;
      case "array": {
        result = expr.items.map(read) as Value[];
        break;
      }
      case "property": {
        const object = read(expr.object) as Record<string, Value>;
        const key = String(read(expr.key));
        result = Object.hasOwn(object, key) ? object[key] : undefined;
        break;
      }
    }
    if (typeof result === "string" && result.length > 32768)
      throw new Error("A string exceeds the execution size limit.");
    if (result && typeof result === "object") size(result);
    if (expr.at && options.trace !== false && observed.length < 32)
      observed.push({ at: expr.at, value: display(result) });
    return result;
  }
  async function block(
    instructions: Instruction[],
    frame: Frame,
    enclosing: string[] = [],
  ): Promise<Signal | undefined> {
    const symbols = [...enclosing];
    for (const instruction of instructions) {
      await checkpoint(instruction, frame, symbols);
      const observed: Trace["outputs"] = [];
      const inputs: string[] = [];
      const read = (expr: Expr) => {
        const value = evaluate(expr, frame, observed);
        if (options.trace !== false && inputs.length < 24)
          inputs.push(display(value));
        return value;
      };
      const trace = () => {
        if (options.trace !== false)
          emit({
            kind: "trace",
            trace: {
              at: instruction.at,
              depth,
              step: steps,
              inputs: [...inputs],
              outputs: [...observed],
              variables: visible(symbols, frame),
            },
          });
      };
      const traceBeforeChild = () => {
        trace();
        current = instruction.at;
      };
      const body = async (children: Instruction[], extra: string[] = []) => {
        depth++;
        try {
          return await block(children, frame, [...symbols, ...extra]);
        } finally {
          depth--;
        }
      };
      const limit = async (index: number) => {
        current = instruction.at;
        if (index >= limits.iterations)
          throw new Error("A loop reached its iteration limit.");
        if (index % 16 === 0) await wait(0);
        check();
      };
      let signal: Signal | undefined;
      switch (instruction.kind) {
        case "document":
          throw new Error("Select HTML / CSS to preview this page.");
        case "print": {
          const value = display(read(instruction.value));
          if (++outputs <= 1000) emit({ kind: "output", value });
          else throw new Error("Execution reached the console output limit.");
          break;
        }
        case "declare":
          symbols.push(instruction.name);
          frame.set(instruction.name, read(instruction.value));
          break;
        case "assign":
          frame.set(instruction.name, read(instruction.value));
          break;
        case "writeAddress": {
          const binding = target(read(instruction.target));
          const value = read(instruction.value);
          if (
            binding.valueType &&
            binding.valueType !== "any" &&
            typeOf(value) !== binding.valueType
          )
            throw new Error(`This alias expects a ${binding.valueType} value.`);
          binding.frame.set(binding.name, value);
          break;
        }
        case "setField": {
          const object = read(instruction.object);
          if (!object || typeof object !== "object" || Array.isArray(object))
            throw new Error("Set Field expects an object or instance.");
          const key = String(read(instruction.key));
          const value = structuredClone(read(instruction.value));
          Object.defineProperty(object, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
          sizes = new WeakMap();
          size(object);
          break;
        }
        case "branch": {
          const selected = read(instruction.test)
            ? instruction.yes
            : instruction.no;
          traceBeforeChild();
          signal = await body(selected);
          if (signal) return signal;
          continue;
        }
        case "sequence":
          traceBeforeChild();
          for (const children of instruction.blocks) {
            signal = await body(children);
            if (signal) return signal;
          }
          continue;
        case "for":
        case "while":
        case "foreach": {
          const start =
            instruction.kind === "for" ? numeric(read(instruction.start)) : 0;
          const collection =
            instruction.kind === "foreach"
              ? (read(instruction.collection) as Value[])
              : [];
          const end =
            instruction.kind === "for"
              ? numeric(read(instruction.end))
              : collection.length;
          traceBeforeChild();
          for (
            let index = start, count = 0;
            instruction.kind === "while"
              ? evaluate(instruction.test, frame, [])
              : index < end;
            index++, count++
          ) {
            await limit(count);
            const local = [];
            if (instruction.kind === "for") {
              frame.set(instruction.name, index);
              local.push(instruction.name);
            }
            if (instruction.kind === "foreach") {
              frame.set(instruction.index, index);
              frame.set(instruction.item, collection[index]);
              local.push(instruction.index, instruction.item);
            }
            signal = await body(instruction.body, local);
            if (signal?.kind === "return") return signal;
            if (signal?.kind === "break") break;
          }
          continue;
        }
        case "call": {
          const values = instruction.args.map(read);
          traceBeforeChild();
          signal = await invoke(instruction.name, values);
          current = instruction.at;
          inputs.length = 0;
          symbols.push(instruction.result);
          frame.set(
            instruction.result,
            signal?.kind === "return" ? signal.value : undefined,
          );
          break;
        }
        case "request": {
          const path = string(read(instruction.path));
          const body = read(instruction.body) ?? null;
          traceBeforeChild();
          const result =
            instruction.target === "project"
              ? await projectRequest(instruction.method, path, body)
              : await host({
                  kind: "http",
                  method: instruction.method,
                  path,
                  body,
                });
          current = instruction.at;
          check();
          symbols.push(instruction.result);
          frame.set(instruction.result, result);
          break;
        }
        case "automation": {
          const input = string(read(instruction.input));
          traceBeforeChild();
          const output = await host({
            kind: "ai",
            task: instruction.task,
            input,
          });
          check();
          if (typeof output !== "string")
            throw new Error("The AI operation did not return text.");
          symbols.push(instruction.result);
          frame.set(instruction.result, output);
          break;
        }
        case "respond": {
          const status = numeric(read(instruction.status));
          if (!Number.isInteger(status) || status < 200 || status > 599)
            throw new Error(
              "HTTP Response needs an integer status from 200 to 599.",
            );
          const body = read(instruction.body) ?? null;
          signal = {
            kind: "return",
            value: {
              status,
              body: [204, 205, 304].includes(status) ? null : body,
            },
          };
          break;
        }
        case "return":
          signal = { kind: "return", value: read(instruction.value) };
          break;
        case "break":
        case "continue":
          signal = { kind: instruction.kind };
          break;
        case "delay":
          await wait(
            Math.min(1000, Math.max(0, numeric(read(instruction.value)))),
          );
          check();
          break;
        case "assert":
          if (!read(instruction.value)) throw new Error("Assertion failed.");
          break;
        case "breakpoint":
          break;
      }
      trace();
      if (signal && instruction.kind !== "call") return signal;
    }
  }

  const stopped = () => state === "stopped";
  const done = Promise.resolve().then(async () => {
    if (stopped()) return;
    try {
      setStatus("running");
      if (options.preview) {
        const endpoint = program.endpoints?.find(
          ({ graphId }) => graphId === options.preview?.graphId,
        );
        if (!endpoint)
          throw new Error("Select a valid endpoint graph to test.");
        const response = await projectRequest(
          endpoint.method,
          endpoint.path,
          options.preview.body,
        );
        emit({ kind: "response", ...response });
      } else await block(program.main, new Map());
      if (state !== "stopped") setStatus("complete");
    } catch (error) {
      if (state !== "stopped") setStatus("error", (error as Error).message);
    }
  });
  return { control, done };
}
