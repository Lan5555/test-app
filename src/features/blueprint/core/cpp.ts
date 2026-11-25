import { cppNames, nativeCppPreview } from "./cpp-preview";
import { cppBinary, cppSupport, cppUnary } from "./cpp-support";
import {
  anyInstruction,
  type Expr,
  type Instruction,
  isSecurityUnary,
  type LanguageAdapter,
  type Program,
  type SourceRange,
} from "./ir";
import type { Location, Value } from "./model";

function literalString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const escaped = Array.from(bytes, (byte) => {
    if (byte >= 32 && byte <= 126 && byte !== 34 && byte !== 92 && byte !== 63)
      return String.fromCharCode(byte);
    return `\\${byte.toString(8).padStart(3, "0")}`;
  }).join("");
  return `std::string("${escaped}", ${bytes.length})`;
}

function literal(value: Value | undefined): string {
  if (value === undefined) return "bp::Value{}";
  if (value === null) return "bp::Value{nullptr}";
  if (typeof value === "boolean") return `bp::Value{${value}}`;
  if (typeof value === "number") {
    const decimal = Object.is(value, -0) ? "-0.0" : String(value);
    return `bp::Value{${/^-?\d+$/.test(decimal) ? `${decimal}.0` : decimal}}`;
  }
  if (typeof value === "string") return `bp::Value{${literalString(value)}}`;
  if (Array.isArray(value))
    return `bp::array({${value.map(literal).join(", ")}})`;
  const fields = Object.entries(value).map(
    ([key, item]) => `{${literalString(key)}, ${literal(item)}}`,
  );
  return `bp::object({${fields.join(", ")}})`;
}

function exportName(symbol: string) {
  const colon = symbol.indexOf(":");
  const id = symbol.slice(0, colon).replace(/[^a-zA-Z0-9_]/g, "_");
  const label = symbol.slice(colon + 1).replace(/[^a-zA-Z0-9_]/g, "_");
  return `bpv${id}_${label}`;
}

function formatExpression(
  item: Expr,
  map: (at: Location) => void,
  name: (symbol: string) => string,
): string {
  if (item.at) map(item.at);
  const expression = (child: Expr) => formatExpression(child, map, name);
  switch (item.kind) {
    case "literal":
      return literal(item.value);
    case "read":
      return name(item.name);
    case "classValue":
      return `bp::Class{${literalString(item.name)}, ${literal(item.fields)}}`;
    case "instantiate":
      return `${expression(item.definition)}.instantiate()`;
    case "address":
      return item.name
        ? `bp::${item.reference ? "reference" : "pointer"}(${item.reference ? "" : "&"}${name(item.name)}, ${literalString(item.valueType ?? "any")})`
        : "bp::pointer(nullptr)";
    case "readAddress":
      return `bp::read_address(${expression(item.target)}, ${literalString(item.valueType ?? "any")})`;
    case "isNullAddress":
      return `bp::Value{bp::is_null_address(${expression(item.target)})}`;
    case "binary": {
      const left = expression(item.left);
      const right = expression(item.right);
      if (item.op === "and" || item.op === "or") {
        const operator = item.op === "and" ? "&&" : "||";
        return (
          "bp::Value{bp::truth(" +
          left +
          ") " +
          operator +
          " bp::truth(" +
          right +
          ")}"
        );
      }
      return `bp::${cppBinary[item.op]}(${left}, ${right})`;
    }
    case "unary":
      if (isSecurityUnary(item.op))
        throw new Error(
          "Defensive Security nodes export to JavaScript. Choose Cybersecurity or JavaScript.",
        );
      return `bp::${cppUnary[item.op]}(${expression(item.value)})`;
    case "array":
      return `bp::array({${item.items.map(expression).join(", ")}})`;
    case "property":
      return (
        "bp::property(" +
        expression(item.object) +
        ", " +
        expression(item.key) +
        ")"
      );
  }
}

export const cpp: LanguageAdapter = {
  id: "cpp",
  label: "C++",
  unsupportedFeatures: ["http", "automation", "document", "security"],
  nodePresentation: {
    print: {
      label: "std::cout · Print",
      category: "C++ Console",
      description: "Print a value to standard output.",
    },
    minimum: {
      label: "std::min · Minimum",
      category: "C++ Math",
      description: "Return the smaller of two numbers.",
    },
    maximum: {
      label: "std::max · Maximum",
      category: "C++ Math",
      description: "Return the larger of two numbers.",
    },
    sqrt: {
      label: "std::sqrt · Square Root",
      category: "C++ Math",
      description: "Calculate the square root of a number.",
    },
    power: {
      label: "std::pow · Power",
      category: "C++ Math",
      description: "Raise A to the power of B.",
    },
    abs: {
      label: "std::fabs · Absolute Value",
      category: "C++ Math",
      description: "Return the magnitude of a number.",
    },
    floor: {
      label: "std::floor · Round Down",
      category: "C++ Math",
      description: "Round a number down to an integer.",
    },
    ceil: {
      label: "std::ceil · Round Up",
      category: "C++ Math",
      description: "Round a number up to an integer.",
    },
  },
  generate: generateCpp,
  generatePreview(program, options) {
    return nativeCppPreview(program) ?? generateCpp(program, options, true);
  },
};

function generateCpp(
  program: Program,
  options: { comments: boolean },
  compact = false,
) {
  if (
    program.endpoints?.length ||
    anyInstruction(
      program,
      (item) =>
        item.kind === "request" ||
        item.kind === "respond" ||
        item.kind === "automation",
    )
  )
    throw new Error(
      "HTTP and AI nodes currently export to JavaScript. Choose JavaScript for this project.",
    );
  const lines = compact ? [] : cppSupport.trimEnd().split("\n");
  const name = compact ? cppNames() : exportName;
  const ranges: SourceRange[] = [];
  const expressions: SourceRange[] = [];
  function expression(item: Expr) {
    const line = lines.length + 1;
    return formatExpression(
      item,
      (at) => expressions.push({ at, start: line, end: line }),
      name,
    );
  }
  let temporary = 0;
  function emit(depth: number, line: string) {
    lines.push("    ".repeat(depth) + line);
  }
  function block(body: Instruction[], depth: number) {
    for (const item of body) {
      const start = lines.length + 1;
      switch (item.kind) {
        case "document":
          throw new Error("Choose HTML / CSS to export this page.");
        case "print":
          emit(depth, `bp::print(${expression(item.value)});`);
          break;
        case "declare":
          emit(
            depth,
            "bp::Value " +
              name(item.name) +
              " = " +
              expression(item.value) +
              ";",
          );
          break;
        case "assign":
          emit(depth, `${name(item.name)} = ${expression(item.value)};`);
          break;
        case "setField":
          emit(
            depth,
            `bp::set_field(${expression(item.object)}, ${expression(item.key)}, ${expression(item.value)});`,
          );
          break;
        case "writeAddress":
          emit(
            depth,
            `bp::write_address(${expression(item.target)}, ${expression(item.value)});`,
          );
          break;
        case "branch":
          emit(depth, `if (bp::truth(${expression(item.test)})) {`);
          block(item.yes, depth + 1);
          if (item.no.length) {
            emit(depth, "} else {");
            block(item.no, depth + 1);
          }
          emit(depth, "}");
          break;
        case "for": {
          const id = ++temporary;
          const counter = compact ? name(`-${id}:counter`) : `counter_${id}`;
          const end = compact ? name(`-${id}:limit`) : `limit_${id}`;
          emit(
            depth,
            "for (double " +
              counter +
              " = bp::number(" +
              expression(item.start) +
              "), " +
              end +
              " = bp::number(" +
              expression(item.end) +
              "); " +
              counter +
              " < " +
              end +
              "; ++" +
              counter +
              ") {",
          );
          emit(depth + 1, `const bp::Value ${name(item.name)}{${counter}};`);
          block(item.body, depth + 1);
          emit(depth, "}");
          break;
        }
        case "while":
          emit(depth, `while (bp::truth(${expression(item.test)})) {`);
          block(item.body, depth + 1);
          emit(depth, "}");
          break;
        case "foreach": {
          const id = ++temporary;
          const collection = compact
            ? name(`-${id}:collection`)
            : `collection_${id}`;
          const counter = compact ? name(`-${id}:index`) : `index_${id}`;
          emit(depth, "{");
          emit(
            depth + 1,
            "const auto " +
              collection +
              " = bp::list(" +
              expression(item.collection) +
              ");",
          );
          emit(
            depth + 1,
            "for (std::size_t " +
              counter +
              " = 0; " +
              counter +
              " < " +
              collection +
              ".size(); ++" +
              counter +
              ") {",
          );
          emit(
            depth + 2,
            "const bp::Value " +
              name(item.index) +
              "{static_cast<double>(" +
              counter +
              ")};",
          );
          emit(
            depth + 2,
            "const auto& " +
              name(item.item) +
              " = " +
              collection +
              "[" +
              counter +
              "];",
          );
          block(item.body, depth + 2);
          emit(depth + 1, "}");
          emit(depth, "}");
          break;
        }
        case "sequence":
          for (const body of item.blocks) {
            emit(depth, "{");
            block(body, depth + 1);
            emit(depth, "}");
          }
          break;
        case "call":
          emit(
            depth,
            "const auto " +
              name(item.result) +
              " = " +
              name(item.name) +
              "(" +
              item.args.map(expression).join(", ") +
              ");",
          );
          break;
        case "return":
          emit(depth, `return ${expression(item.value)};`);
          break;
        case "delay":
          emit(depth, `bp::delay(${expression(item.value)});`);
          break;
        case "assert":
          emit(
            depth,
            "if (!bp::truth(" +
              expression(item.value) +
              ')) throw std::runtime_error("Assertion failed.");',
          );
          break;
        case "break":
        case "continue":
          emit(depth, `${item.kind};`);
          break;
        case "breakpoint":
          emit(depth, "// Blueprint breakpoint");
          break;
        case "request":
        case "respond":
        case "automation":
          throw new Error("HTTP and AI nodes currently export to JavaScript.");
      }
      ranges.push({ at: item.at, start, end: lines.length });
    }
  }
  function section(...text: string[]) {
    if (lines.length) lines.push("");
    lines.push(...text);
  }
  const headers = program.functions.map(
    (fn) =>
      "bp::Value " +
      name(fn.name) +
      "(" +
      fn.parameters.map((symbol) => `bp::Value ${name(symbol)}`).join(", ") +
      ")",
  );
  if (options.comments) section("// Blueprint function graphs and main entry.");
  const entryLine = lines.length + (lines.length ? 2 : 1);
  if (headers.length) section(...headers.map((header) => `${header};`));
  program.functions.forEach((fn, index) => {
    section(`${headers[index]} {`);
    block(fn.body, 1);
    if (!compact || fn.body.at(-1)?.kind !== "return") emit(1, "return {};");
    lines.push("}");
  });
  section("int main() {");
  block(program.main, 1);
  emit(1, "return 0;");
  lines.push("}", "");
  return {
    code: lines.join("\n"),
    ranges: [...ranges, ...expressions],
    extension: ".cpp",
    entryLine,
    note: compact
      ? "Blueprint value helpers are included in the C++ export."
      : undefined,
  };
}
