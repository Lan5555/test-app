import generate from "@babel/generator";
import * as ast from "@babel/types";
import {
  anyInstruction,
  type Binary,
  type Expr,
  type Instruction,
  type LanguageAdapter,
  type Unary,
} from "./ir";
import {
  javascriptIntegrations,
  javascriptServer,
} from "./javascript-integrations";
import type { Location, Value } from "./model";
import {
  emailPattern,
  emailReplacement,
  htmlEntities,
  securityHeaders,
  sha256Pattern,
} from "./security";

const binary: Record<
  Exclude<Binary, "and" | "or" | "minimum" | "maximum">,
  ast.BinaryExpression["operator"]
> = {
  add: "+",
  subtract: "-",
  multiply: "*",
  divide: "/",
  modulo: "%",
  power: "**",
  equal: "===",
  notEqual: "!==",
  greater: ">",
  less: "<",
  atLeast: ">=",
  atMost: "<=",
  xor: "!==",
  concat: "+",
};
const member = (object: ast.Expression, key: string) =>
  ast.memberExpression(object, ast.identifier(key));
const builtin = (object: string, key: string, args: ast.Expression[]) =>
  ast.callExpression(member(ast.identifier(object), key), args);
const call = (name: string, args: ast.Expression[]) =>
  ast.callExpression(ast.identifier(name), args);
function urlExpression(arg: ast.Expression, origin: boolean) {
  const url = ast.identifier("url");
  const input = ast.identifier("input");
  const protocol = (value: string) =>
    ast.binaryExpression(
      "===",
      member(url, "protocol"),
      ast.stringLiteral(value),
    );
  const result = origin
    ? ast.conditionalExpression(
        ast.logicalExpression("||", protocol("http:"), protocol("https:")),
        member(url, "origin"),
        ast.stringLiteral(""),
      )
    : ast.logicalExpression(
        "&&",
        protocol("https:"),
        ast.logicalExpression(
          "&&",
          ast.unaryExpression("!", member(url, "username")),
          ast.unaryExpression("!", member(url, "password")),
        ),
      );
  return ast.callExpression(
    ast.arrowFunctionExpression(
      [input],
      ast.blockStatement([
        ast.tryStatement(
          ast.blockStatement([
            ast.variableDeclaration("const", [
              ast.variableDeclarator(
                url,
                ast.newExpression(ast.identifier("URL"), [input]),
              ),
            ]),
            ast.returnStatement(result),
          ]),
          ast.catchClause(
            null,
            ast.blockStatement([
              ast.returnStatement(
                origin ? ast.stringLiteral("") : ast.booleanLiteral(false),
              ),
            ]),
          ),
        ),
      ]),
    ),
    [arg],
  );
}
function missingHeaders(arg: ast.Expression) {
  const entries = ast.identifier("entries");
  const header = ast.identifier("header");
  const name = ast.identifier("name");
  const value = ast.identifier("value");
  const matches = ast.arrowFunctionExpression(
    [ast.arrayPattern([name, value])],
    ast.logicalExpression(
      "&&",
      ast.binaryExpression(
        "===",
        ast.callExpression(member(name, "toLowerCase"), []),
        header,
      ),
      ast.logicalExpression(
        "&&",
        ast.binaryExpression(
          "===",
          ast.unaryExpression("typeof", value),
          ast.stringLiteral("string"),
        ),
        ast.binaryExpression(
          "!==",
          ast.callExpression(member(value, "trim"), []),
          ast.stringLiteral(""),
        ),
      ),
    ),
  );
  const missing = ast.arrowFunctionExpression(
    [header],
    ast.unaryExpression(
      "!",
      ast.callExpression(member(entries, "some"), [matches]),
    ),
  );
  const expected = ast.arrayExpression(
    securityHeaders.map((header) => ast.stringLiteral(header)),
  );
  return ast.callExpression(
    ast.arrowFunctionExpression(
      [entries],
      ast.callExpression(member(expected, "filter"), [missing]),
    ),
    [builtin("Object", "entries", [arg])],
  );
}
const regex = (pattern: RegExp) =>
  ast.regExpLiteral(pattern.source, pattern.flags);
const unary: Record<Unary, (arg: ast.Expression) => ast.Expression> = {
  not: (arg) => ast.unaryExpression("!", arg),
  number: (arg) => call("Number", [arg]),
  string: (arg) => call("String", [arg]),
  boolean: (arg) => call("Boolean", [arg]),
  round: (arg) => builtin("Math", "round", [arg]),
  floor: (arg) => builtin("Math", "floor", [arg]),
  ceil: (arg) => builtin("Math", "ceil", [arg]),
  sqrt: (arg) => builtin("Math", "sqrt", [arg]),
  abs: (arg) => builtin("Math", "abs", [arg]),
  json: (arg) => call("String", [builtin("JSON", "stringify", [arg])]),
  length: (arg) => member(arg, "length"),
  upper: (arg) => ast.callExpression(member(arg, "toUpperCase"), []),
  lower: (arg) => ast.callExpression(member(arg, "toLowerCase"), []),
  trim: (arg) => ast.callExpression(member(arg, "trim"), []),
  isHttpsUrl: (arg) => urlExpression(arg, false),
  urlOrigin: (arg) => urlExpression(arg, true),
  redactEmails: (arg) =>
    ast.callExpression(member(arg, "replace"), [
      regex(emailPattern),
      ast.stringLiteral(emailReplacement),
    ]),
  isSha256Digest: (arg) =>
    ast.callExpression(member(regex(sha256Pattern), "test"), [arg]),
  missingSecurityHeaders: missingHeaders,
  escapeHtml: (arg) =>
    htmlEntities.reduce<ast.Expression>(
      (escaped, [character, entity]) =>
        ast.callExpression(member(escaped, "replaceAll"), [
          ast.stringLiteral(character),
          ast.stringLiteral(entity),
        ]),
      arg,
    ),
};
function literal(value: Value | undefined): ast.Expression {
  if (value === undefined) return ast.identifier("undefined");
  if (value === null) return ast.nullLiteral();
  if (typeof value === "number")
    return Object.is(value, -0)
      ? ast.unaryExpression("-", ast.numericLiteral(0))
      : ast.numericLiteral(value);
  if (typeof value === "string") return ast.stringLiteral(value);
  if (typeof value === "boolean") return ast.booleanLiteral(value);
  if (Array.isArray(value)) return ast.arrayExpression(value.map(literal));
  return ast.objectExpression(
    Object.entries(value).map(([key, item]) =>
      ast.objectProperty(
        ast.stringLiteral(key),
        literal(item),
        key === "__proto__",
      ),
    ),
  );
}
const explanations: Partial<Record<Instruction["kind"], string>> = {
  declare: "Declare a variable in this block.",
  branch: "Choose a path based on the condition.",
  for: "Repeat with each index up to the exclusive end.",
  while: "Repeat while the condition is true.",
  foreach: "Visit each item and its index.",
  call: "Call the function and keep its result.",
  return: "Send this value back to the caller.",
};
function hasDelay(instructions: Instruction[]): boolean {
  return instructions.some((statement) => {
    switch (statement.kind) {
      case "delay":
        return true;
      case "branch":
        return hasDelay(statement.yes) || hasDelay(statement.no);
      case "for":
      case "while":
      case "foreach":
        return hasDelay(statement.body);
      case "sequence":
        return statement.blocks.some(hasDelay);
      default:
        return false;
    }
  });
}
export const javascript: LanguageAdapter = {
  id: "javascript",
  label: "JavaScript",
  unsupportedFeatures: ["document", "memory"],
  generate(program, options) {
    const locations: Location[] = [];
    const names = new Map<string, string>();
    const reserved = new Set([
      "console",
      "Math",
      "String",
      "Number",
      "Boolean",
      "JSON",
      "URL",
      "Object",
      "structuredClone",
      "Promise",
      "Error",
      "setTimeout",
      "arguments",
      "eval",
      "undefined",
      "NaN",
      "Infinity",
      "await",
      "yield",
      "lookupValue",
      "blueprintResponse",
      "blueprintRequest",
      "blueprintExternal",
      "blueprintEndpoints",
      "blueprintServe",
      "process",
    ]);
    const endpoints = program.endpoints ?? [];
    const integrations =
      !!endpoints.length ||
      anyInstruction(
        program,
        (item) =>
          item.kind === "request" ||
          item.kind === "automation" ||
          item.kind === "respond",
      );
    const async =
      integrations ||
      hasDelay(program.main) ||
      program.functions.some(({ body }) => hasDelay(body));
    const sourceName = "blueprint";
    const nameFor = (symbol: string) => {
      const existing = names.get(symbol);
      if (existing) return ast.identifier(existing);
      const base = symbol
        .slice(symbol.indexOf(":") + 1)
        .replace(/[^\p{L}\p{N}_]/gu, "_");
      let name =
        ast.isValidIdentifier(base) && !reserved.has(base) ? base : `_${base}`;
      let suffix = 2;
      while (reserved.has(name)) name = `${base}_${suffix++}`;
      reserved.add(name);
      names.set(symbol, name);
      return ast.identifier(name);
    };
    const located = <T extends ast.Node>(node: T, at?: Location): T => {
      if (at) {
        const line = locations.push(at);
        node.loc = {
          filename: sourceName,
          identifierName: undefined,
          start: { line, column: 0, index: line * 2 },
          end: { line, column: 1, index: line * 2 + 1 },
        };
      }
      return node;
    };
    let usesLookup = false;
    function expression(value: Expr): ast.Expression {
      let node: ast.Expression;
      switch (value.kind) {
        case "literal":
          node = literal(value.value);
          break;
        case "read":
          node = nameFor(value.name);
          break;
        case "address":
        case "readAddress":
        case "isNullAddress":
          throw new Error("Select C++ to export pointers and references.");
        case "classValue": {
          const name =
            ast.isValidIdentifier(value.name) && value.name !== "Object"
              ? value.name
              : "BlueprintClass";
          node = ast.classExpression(
            ast.identifier(name),
            null,
            ast.classBody([
              ast.classMethod(
                "constructor",
                ast.identifier("constructor"),
                [],
                ast.blockStatement([
                  ast.expressionStatement(
                    builtin("Object", "defineProperties", [
                      ast.thisExpression(),
                      builtin("Object", "getOwnPropertyDescriptors", [
                        literal(value.fields),
                      ]),
                    ]),
                  ),
                ]),
              ),
            ]),
          );
          break;
        }
        case "instantiate":
          node = ast.newExpression(expression(value.definition), []);
          break;
        case "binary": {
          const left = expression(value.left);
          const right = expression(value.right);
          if (value.op === "minimum" || value.op === "maximum")
            node = builtin("Math", value.op === "minimum" ? "min" : "max", [
              left,
              right,
            ]);
          else if (value.op === "and" || value.op === "or")
            node = ast.logicalExpression(
              value.op === "and" ? "&&" : "||",
              left,
              right,
            );
          else node = ast.binaryExpression(binary[value.op], left, right);
          break;
        }
        case "unary":
          node = unary[value.op](expression(value.value));
          break;
        case "array":
          node = ast.arrayExpression(value.items.map(expression));
          break;
        case "property":
          usesLookup = true;
          node = call("lookupValue", [
            expression(value.object),
            expression(value.key),
          ]);
          break;
      }
      return located(node, value.at);
    }
    const block = (body: Instruction[]) =>
      ast.blockStatement(body.flatMap(statement));
    let temporary = 0;
    function statement(item: Instruction): ast.Statement[] {
      let statements: ast.Statement[];
      switch (item.kind) {
        case "document":
          throw new Error("Choose HTML / CSS to export this page.");
        case "writeAddress":
          throw new Error("Select C++ to export pointers and references.");
        case "setField":
          statements = [
            ast.expressionStatement(
              builtin("Object", "defineProperty", [
                expression(item.object),
                expression(item.key),
                ast.objectExpression([
                  ast.objectProperty(
                    ast.identifier("value"),
                    call("structuredClone", [expression(item.value)]),
                  ),
                  ...["enumerable", "configurable", "writable"].map((key) =>
                    ast.objectProperty(
                      ast.identifier(key),
                      ast.booleanLiteral(true),
                    ),
                  ),
                ]),
              ]),
            ),
          ];
          break;
        case "print":
          statements = [
            ast.expressionStatement(
              builtin("console", "log", [expression(item.value)]),
            ),
          ];
          break;
        case "declare":
          statements = [
            ast.variableDeclaration("let", [
              ast.variableDeclarator(
                nameFor(item.name),
                expression(item.value),
              ),
            ]),
          ];
          break;
        case "assign":
          statements = [
            ast.expressionStatement(
              ast.assignmentExpression(
                "=",
                nameFor(item.name),
                expression(item.value),
              ),
            ),
          ];
          break;
        case "branch":
          statements = [
            ast.ifStatement(
              expression(item.test),
              block(item.yes),
              item.no.length ? block(item.no) : null,
            ),
          ];
          break;
        case "for": {
          const index = nameFor(item.name);
          const end = nameFor(`temp${++temporary}:end`);
          const initializer = ast.variableDeclaration("let", [
            ast.variableDeclarator(index, expression(item.start)),
            ast.variableDeclarator(end, expression(item.end)),
          ]);
          statements = [
            ast.forStatement(
              initializer,
              ast.binaryExpression("<", index, end),
              ast.updateExpression("++", index),
              block(item.body),
            ),
          ];
          break;
        }
        case "while":
          statements = [
            ast.whileStatement(expression(item.test), block(item.body)),
          ];
          break;
        case "foreach": {
          const pattern = ast.arrayPattern([
            nameFor(item.index),
            nameFor(item.item),
          ]);
          statements = [
            ast.forOfStatement(
              ast.variableDeclaration("const", [
                ast.variableDeclarator(pattern),
              ]),
              ast.callExpression(
                member(expression(item.collection), "entries"),
                [],
              ),
              block(item.body),
            ),
          ];
          break;
        }
        case "sequence":
          statements = item.blocks.map(block);
          break;
        case "call": {
          const invoke = ast.callExpression(
            nameFor(item.name),
            item.args.map(expression),
          );
          statements = [
            ast.variableDeclaration("const", [
              ast.variableDeclarator(
                nameFor(item.result),
                async ? ast.awaitExpression(invoke) : invoke,
              ),
            ]),
          ];
          break;
        }
        case "return":
          statements = [ast.returnStatement(expression(item.value))];
          break;
        case "request": {
          const path = expression(item.path);
          const body = expression(item.body);
          const method = ast.stringLiteral(item.method);
          const request =
            item.target === "project"
              ? call("blueprintRequest", [method, path, body])
              : call("blueprintExternal", [
                  ast.objectExpression([
                    ast.objectProperty(
                      ast.identifier("kind"),
                      ast.stringLiteral("http"),
                    ),
                    ast.objectProperty(ast.identifier("method"), method),
                    ast.objectProperty(ast.identifier("path"), path),
                    ast.objectProperty(ast.identifier("body"), body),
                  ]),
                ]);
          statements = [
            ast.variableDeclaration("const", [
              ast.variableDeclarator(
                nameFor(item.result),
                ast.awaitExpression(request),
              ),
            ]),
          ];
          break;
        }
        case "automation":
          statements = [
            ast.variableDeclaration("const", [
              ast.variableDeclarator(
                nameFor(item.result),
                ast.awaitExpression(
                  call("blueprintExternal", [
                    ast.objectExpression([
                      ast.objectProperty(
                        ast.identifier("kind"),
                        ast.stringLiteral("ai"),
                      ),
                      ast.objectProperty(
                        ast.identifier("task"),
                        ast.stringLiteral(item.task),
                      ),
                      ast.objectProperty(
                        ast.identifier("input"),
                        expression(item.input),
                      ),
                    ]),
                  ]),
                ),
              ),
            ]),
          ];
          break;
        case "respond":
          statements = [
            ast.returnStatement(
              call("blueprintResponse", [
                expression(item.status),
                expression(item.body),
              ]),
            ),
          ];
          break;
        case "break":
          statements = [ast.breakStatement()];
          break;
        case "continue":
          statements = [ast.continueStatement()];
          break;
        case "breakpoint":
          statements = [ast.debuggerStatement()];
          break;
        case "assert":
          statements = [
            ast.ifStatement(
              ast.unaryExpression("!", expression(item.value)),
              ast.blockStatement([
                ast.throwStatement(
                  ast.newExpression(ast.identifier("Error"), [
                    ast.stringLiteral("Assertion failed."),
                  ]),
                ),
              ]),
            ),
          ];
          break;
        case "delay": {
          const resolve = ast.identifier("resolve");
          const duration = builtin("Math", "min", [
            ast.numericLiteral(1000),
            builtin("Math", "max", [
              ast.numericLiteral(0),
              expression(item.value),
            ]),
          ]);
          const executor = ast.arrowFunctionExpression(
            [resolve],
            call("setTimeout", [resolve, duration]),
          );
          statements = [
            ast.expressionStatement(
              ast.awaitExpression(
                ast.newExpression(ast.identifier("Promise"), [executor]),
              ),
            ),
          ];
          break;
        }
      }
      const comment = options.comments && explanations[item.kind];
      if (comment && statements[0])
        ast.addComment(statements[0], "leading", ` ${comment}`, true);
      return statements.map((node) => located(node, item.at));
    }
    const functions = program.functions.map((fn) =>
      ast.functionDeclaration(
        nameFor(fn.name),
        fn.parameters.map(nameFor),
        block(fn.body),
        false,
        async,
      ),
    );
    const main = program.main.flatMap(statement);
    const helper = ast.functionDeclaration(
      ast.identifier("lookupValue"),
      [ast.identifier("collection"), ast.identifier("key")],
      ast.blockStatement([
        ast.returnStatement(
          ast.conditionalExpression(
            builtin("Object", "hasOwn", [
              ast.identifier("collection"),
              ast.identifier("key"),
            ]),
            ast.memberExpression(
              ast.identifier("collection"),
              ast.identifier("key"),
              true,
            ),
            ast.identifier("undefined"),
          ),
        ),
      ]),
    );
    const dispatchTable = ast.variableDeclaration("const", [
      ast.variableDeclarator(
        ast.identifier("blueprintEndpoints"),
        ast.arrayExpression(
          endpoints.map((endpoint) =>
            ast.objectExpression([
              ast.objectProperty(
                ast.identifier("method"),
                ast.stringLiteral(endpoint.method),
              ),
              ast.objectProperty(
                ast.identifier("path"),
                ast.stringLiteral(endpoint.path),
              ),
              ast.objectProperty(
                ast.identifier("handle"),
                nameFor(endpoint.handler),
              ),
            ]),
          ),
        ),
      ),
    ]);
    const entry = ast.expressionStatement(
      ast.callExpression(
        ast.arrowFunctionExpression([], ast.blockStatement(main), true),
        [],
      ),
    );
    const serve = ast.ifStatement(
      ast.logicalExpression(
        "&&",
        ast.binaryExpression(
          "!==",
          ast.unaryExpression("typeof", ast.identifier("process")),
          ast.stringLiteral("undefined"),
        ),
        ast.callExpression(
          member(member(ast.identifier("process"), "argv"), "includes"),
          [ast.stringLiteral("--serve")],
        ),
      ),
      ast.blockStatement([ast.expressionStatement(call("blueprintServe", []))]),
      ast.blockStatement([entry]),
    );
    const root = ast.program([
      ...(usesLookup ? [helper] : []),
      ...functions,
      ...(integrations ? [dispatchTable] : []),
      ...(async ? [endpoints.length ? serve : entry] : main),
    ]);
    const result = generate(root, {
      sourceMaps: true,
      sourceFileName: sourceName,
      jsescOption: { minimal: false },
    });
    const ranges = new Map<
      number,
      { at: Location; start: number; end: number }
    >();
    const { rawMappings } = result as typeof result & {
      rawMappings?: {
        generated: { line: number };
        original?: { line: number };
      }[];
    };
    for (const mapping of rawMappings ?? []) {
      const key = mapping.original?.line;
      if (!key || !locations[key - 1]) continue;
      const line = mapping.generated.line;
      const range = ranges.get(key);
      if (range) range.end = Math.max(range.end, line);
      else ranges.set(key, { at: locations[key - 1], start: line, end: line });
    }
    return {
      code:
        result.code +
        (integrations ? "\n" + javascriptIntegrations : "") +
        (endpoints.length ? "\n" + javascriptServer : ""),
      ranges: [...ranges.values()],
      extension: ".js",
    };
  },
};
