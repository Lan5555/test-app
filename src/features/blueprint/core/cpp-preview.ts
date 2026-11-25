import {
  anyInstruction,
  type Expr,
  type Instruction,
  isSecurityUnary,
  type Program,
  type SourceRange,
} from "./ir";
import type { Location } from "./model";

type Scalar = "number" | "string" | "boolean";
type Inferred = Scalar | "mixed" | undefined;
const cppType = { number: "double", string: "std::string", boolean: "bool" };
const keywords = new Set(
  "alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long main mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast std struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq".split(
    " ",
  ),
);

export function cppNames() {
  const used = new Set(keywords);
  const names = new Map<string, string>();
  return (symbol: string) => {
    const existing = names.get(symbol);
    if (existing) return existing;
    const base =
      symbol
        .slice(symbol.indexOf(":") + 1)
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "value";
    const stem = /^\d/.test(base) ? `value_${base}` : base;
    let name = stem;
    for (let index = 2; used.has(name); index++) name = `${stem}_${index}`;
    used.add(name);
    names.set(symbol, name);
    return name;
  };
}

const comparisons = new Set([
  "equal",
  "notEqual",
  "greater",
  "less",
  "atLeast",
  "atMost",
  "and",
  "or",
  "xor",
]);
function inferTypes(program: Program) {
  const symbols = new Map<string, Inferred>();
  const functions = new Map(program.functions.map((fn) => [fn.name, fn]));
  const typeOf = (item: Expr): Inferred => {
    switch (item.kind) {
      case "literal": {
        const type = typeof item.value;
        return type === "number" || type === "string" || type === "boolean"
          ? type
          : "mixed";
      }
      case "read":
        return symbols.get(item.name);
      case "array":
      case "property":
      case "classValue":
      case "instantiate":
      case "address":
      case "readAddress":
      case "isNullAddress":
        return "mixed";
      case "binary":
        return item.op === "concat"
          ? "string"
          : comparisons.has(item.op)
            ? "boolean"
            : "number";
      case "unary":
        if (isSecurityUnary(item.op)) return "mixed";
        if (["string", "upper", "lower", "trim", "json"].includes(item.op))
          return "string";
        return ["not", "boolean"].includes(item.op) ? "boolean" : "number";
    }
  };
  for (let pass = 0; pass < 32; pass++) {
    let changed = false;
    function bind(name: string, type: Inferred) {
      const previous = symbols.get(name);
      if (!type || previous === type || previous === "mixed") return;
      symbols.set(name, previous ? "mixed" : type);
      changed = true;
    }
    const scan = (item: Instruction, fn?: string) => {
      if (item.kind === "declare" || item.kind === "assign")
        bind(item.name, typeOf(item.value));
      if (item.kind === "for") bind(item.name, "number");
      if (item.kind === "return" && fn) bind(fn, typeOf(item.value));
      if (item.kind === "call") {
        functions.get(item.name)?.parameters.forEach((parameter, index) => {
          const argument = item.args[index];
          bind(parameter, argument ? typeOf(argument) : "mixed");
        });
        bind(item.result, symbols.get(item.name));
      }
      return false;
    };
    anyInstruction({ main: program.main, functions: [] }, scan);
    for (const fn of program.functions)
      anyInstruction({ main: fn.body, functions: [] }, (item) =>
        scan(item, fn.name),
      );
    if (!changed) break;
  }
  return { typeOf, symbols };
}

const operators = {
  add: ["+", 10],
  subtract: ["-", 10],
  multiply: ["*", 11],
  divide: ["/", 11],
  equal: ["==", 7],
  notEqual: ["!=", 7],
  greater: [">", 8],
  less: ["<", 8],
  atLeast: [">=", 8],
  atMost: ["<=", 8],
  and: ["&&", 3],
  or: ["||", 2],
  xor: ["!=", 7],
  concat: ["+", 10],
} as const;
const binaryFunction = {
  power: "std::pow",
  modulo: "std::fmod",
  minimum: "std::min",
  maximum: "std::max",
} as const;
const unaryFunction = {
  abs: "std::fabs",
  sqrt: "std::sqrt",
  floor: "std::floor",
  ceil: "std::ceil",
} as const;
const dynamic = Symbol("preview requires Blueprint values");

export function nativeCppPreview(program: Program) {
  try {
    return render(program);
  } catch (error) {
    if (error !== dynamic) throw error;
    return undefined;
  }
}

function render(program: Program) {
  if (program.endpoints?.length) throw dynamic;
  const { symbols, typeOf } = inferTypes(program);
  const name = cppNames();
  const includes = new Set<string>();
  const ranges: SourceRange[] = [];
  const expressions: SourceRange[] = [];
  const lines: string[] = [];
  const emit = (depth: number, line: string) =>
    lines.push(`${"    ".repeat(depth)}${line}`);
  function mark(at: Location, start: number) {
    ranges.push({ at, start, end: lines.length });
  }
  function markExpression(item: Expr) {
    if (item.at)
      expressions.push({
        at: item.at,
        start: lines.length + 1,
        end: lines.length + 1,
      });
  }
  function required(type: Inferred, expected?: Scalar): Scalar {
    if (!type || type === "mixed" || (expected && type !== expected))
      throw dynamic;
    return type;
  }
  function declarationType(symbol: string) {
    const type = required(symbols.get(symbol));
    if (type === "string") includes.add("string");
    return cppType[type];
  }
  function textLiteral(value: string) {
    if (/[^\x20-\x7e\n\r\t]/.test(value)) throw dynamic;
    const text = JSON.stringify(value);
    return text.includes("??") ? text.replaceAll("?", "\\?") : text;
  }
  function initializer(item: Expr) {
    if (item.kind === "literal" && typeof item.value === "string") {
      markExpression(item);
      return textLiteral(item.value);
    }
    return expression(item);
  }
  function expression(item: Expr, precedence = 0): string {
    markExpression(item);
    const type = required(typeOf(item));
    switch (item.kind) {
      case "read":
        return name(item.name);
      case "literal": {
        const { value } = item;
        if (typeof value === "string") {
          includes.add("string");
          return `std::string{${textLiteral(value)}}`;
        }
        if (typeof value === "number") {
          if (!Number.isFinite(value)) throw dynamic;
          const decimal = Object.is(value, -0) ? "-0" : String(value);
          return /^-?\d+$/.test(decimal) ? `${decimal}.0` : decimal;
        }
        return String(value);
      }
      case "binary": {
        const { op, left, right } = item;
        const leftType = required(typeOf(left));
        const rightType = required(typeOf(right));
        if (
          leftType !== rightType ||
          (op === "concat" && leftType !== "string") ||
          (["and", "or", "xor"].includes(op) && leftType !== "boolean") ||
          (!["equal", "notEqual", "and", "or", "xor", "concat"].includes(op) &&
            leftType !== "number")
        )
          throw dynamic;
        if (op in binaryFunction) {
          includes.add(
            op === "minimum" || op === "maximum" ? "algorithm" : "cmath",
          );
          return `${binaryFunction[op as keyof typeof binaryFunction]}(${expression(left)}, ${expression(right)})`;
        }
        const [operator, rank] = operators[op as keyof typeof operators];
        const text = `${expression(left, rank)} ${operator} ${expression(right, rank + 1)}`;
        return rank < precedence ? `(${text})` : text;
      }
      case "unary": {
        const original = required(typeOf(item.value));
        if (item.op === type && original === type)
          return expression(item.value, precedence);
        if (item.op === "not" && original === "boolean")
          return `!${expression(item.value, 12)}`;
        if (original === "number" && item.op in unaryFunction) {
          includes.add("cmath");
          return `${unaryFunction[item.op as keyof typeof unaryFunction]}(${expression(item.value)})`;
        }
        if (item.op === "length" && original === "string")
          return `static_cast<double>(${expression(item.value, 13)}.size())`;
        throw dynamic;
      }
      default:
        throw dynamic;
    }
  }
  function printParts(value: Expr): string[] {
    if (value.kind === "binary" && value.op === "concat") {
      markExpression(value);
      return [...printParts(value.left), ...printParts(value.right)];
    }
    if (value.kind === "unary" && value.op === "string") {
      markExpression(value);
      return printParts(value.value);
    }
    if (value.kind === "literal" && typeof value.value === "string") {
      markExpression(value);
      return [textLiteral(value.value)];
    }
    const text = expression(value, 10);
    return typeOf(value) === "boolean" ? ["std::boolalpha", text] : [text];
  }
  function branch(
    item: Extract<Instruction, { kind: "branch" }>,
    depth: number,
    prefix = "",
  ) {
    const start = lines.length + 1;
    required(typeOf(item.test), "boolean");
    emit(depth, `${prefix}if (${expression(item.test)}) {`);
    block(item.yes, depth + 1);
    const [alternative] = item.no;
    if (item.no.length === 1 && alternative.kind === "branch")
      branch(alternative, depth, "} else ");
    else {
      if (item.no.length) {
        emit(depth, "} else {");
        block(item.no, depth + 1);
      }
      emit(depth, "}");
    }
    mark(item.at, start);
  }
  function block(body: Instruction[], depth: number) {
    for (const item of body) {
      const start = lines.length + 1;
      switch (item.kind) {
        case "print":
          includes.add("iostream");
          emit(
            depth,
            `std::cout << ${printParts(item.value).join(" << ")} << '\\n';`,
          );
          break;
        case "declare":
        case "assign": {
          required(typeOf(item.value), required(symbols.get(item.name)));
          const prefix =
            item.kind === "declare" ? `${declarationType(item.name)} ` : "";
          emit(
            depth,
            `${prefix}${name(item.name)} = ${initializer(item.value)};`,
          );
          break;
        }
        case "branch":
          branch(item, depth);
          continue;
        case "while":
          required(typeOf(item.test), "boolean");
          emit(depth, `while (${expression(item.test)}) {`);
          block(item.body, depth + 1);
          emit(depth, "}");
          break;
        case "for": {
          required(typeOf(item.start), "number");
          required(typeOf(item.end), "number");
          const index = name(item.name);
          const end = name(`${item.name}:end`);
          emit(
            depth,
            `for (double ${index} = ${expression(item.start)}, ${end} = ${expression(item.end)}; ${index} < ${end}; ++${index}) {`,
          );
          block(item.body, depth + 1);
          emit(depth, "}");
          break;
        }
        case "sequence":
          for (const child of item.blocks) {
            emit(depth, "{");
            block(child, depth + 1);
            emit(depth, "}");
          }
          break;
        case "call":
          emit(
            depth,
            `const auto ${name(item.result)} = ${name(item.name)}(${item.args.map((arg) => expression(arg)).join(", ")});`,
          );
          break;
        case "return":
          emit(depth, `return ${expression(item.value)};`);
          break;
        case "break":
        case "continue":
          emit(depth, `${item.kind};`);
          break;
        case "breakpoint":
          emit(depth, "// Blueprint breakpoint");
          break;
        default:
          throw dynamic;
      }
      mark(item.at, start);
    }
  }

  const headers = program.functions.map((fn) => {
    if (fn.body.at(-1)?.kind !== "return") throw dynamic;
    return `${declarationType(fn.name)} ${name(fn.name)}(${fn.parameters.map((parameter) => `${declarationType(parameter)} ${name(parameter)}`).join(", ")})`;
  });
  // Forward declarations are only needed for function graphs that call other functions.
  if (
    program.functions.some((fn) =>
      anyInstruction(
        { main: fn.body, functions: [] },
        ({ kind }) => kind === "call",
      ),
    )
  )
    lines.push(...headers.map((header) => `${header};`), "");
  program.functions.forEach((fn, index) => {
    lines.push(`${headers[index]} {`);
    block(fn.body, 1);
    lines.push("}", "");
  });
  lines.push("int main() {");
  block(program.main, 1);
  lines.push("    return 0;", "}", "");
  const prelude = [...includes].sort().map((header) => `#include <${header}>`);
  if (prelude.length) prelude.push("");
  return {
    code: [...prelude, ...lines].join("\n"),
    ranges: [...ranges, ...expressions].map((range) => ({
      ...range,
      start: range.start + prelude.length,
      end: range.end + prelude.length,
    })),
    extension: ".cpp",
  };
}
