import type { DataType, Location, Value } from "./model";

export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type HttpMethod = (typeof httpMethods)[number];
export type AutomationTask = "summarize" | "actions" | "explain";
export type HostRequest =
  | { kind: "http"; method: HttpMethod; path: string; body: Value | null }
  | { kind: "ai"; task: AutomationTask; input: string };
export interface Endpoint {
  graphId: string;
  method: HttpMethod;
  path: string;
  handler: string;
}
export const isEndpointPath = (path: string) =>
  path.length <= 160 &&
  /^\/(?:[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)?$/.test(path);

export type Binary =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "modulo"
  | "power"
  | "minimum"
  | "maximum"
  | "equal"
  | "notEqual"
  | "greater"
  | "less"
  | "atLeast"
  | "atMost"
  | "and"
  | "or"
  | "xor"
  | "concat";
export const securityOperations = [
  "isHttpsUrl",
  "escapeHtml",
  "urlOrigin",
  "redactEmails",
  "isSha256Digest",
  "missingSecurityHeaders",
] as const;
export type SecurityUnary = (typeof securityOperations)[number];
export const isSecurityUnary = (op: Unary): op is SecurityUnary =>
  securityOperations.some((operation) => operation === op);

export type Unary =
  | "not"
  | "string"
  | "number"
  | "boolean"
  | "round"
  | "floor"
  | "ceil"
  | "sqrt"
  | "abs"
  | "length"
  | "upper"
  | "lower"
  | "trim"
  | SecurityUnary
  | "json";
export type CssStyle =
  | {
      kind: "typography";
      color: string;
      fontSize: number;
      fontWeight: string;
      fontFamily: string;
      align: string;
      lineHeight: number;
    }
  | {
      kind: "surface";
      background: string;
      borderColor: string;
      borderWidth: number;
      radius: number;
      shadow: string;
    }
  | { kind: "spacing"; margin: number; padding: number; gap: number }
  | { kind: "size"; width: number; maxWidth: number; center: boolean };
export type CssRule = { selector: string; state: string; style: CssStyle };
export type PageAction = { target: string } & (
  | { kind: "setText"; text: string }
  | { kind: "copyInput"; source: string }
  | { kind: "toggleHidden" }
  | { kind: "toggleClass"; token: string }
  | { kind: "increment"; step: number }
);
export type DocumentPart = (
  | {
      kind:
        | "title"
        | "heading"
        | "subheading"
        | "paragraph"
        | "quote"
        | "listItem"
        | "button";
      text: string;
    }
  | { kind: "divider" }
  | { kind: "link"; text: string; href: string }
  | { kind: "image"; src: string; alt: string; width: number }
  | { kind: "input"; label: string; placeholder: string; initial: string }
  | {
      kind: "pageEvent";
      event: "click" | "input";
      source: string;
      body: Instruction[];
    }
  | { kind: "pageAction"; action: PageAction }
  | { kind: "details"; summary: string; body: Instruction[] }
  | {
      kind: "container";
      tag: "div" | "section" | "header" | "main" | "nav" | "article" | "footer";
      layout: "stack" | "row" | "grid";
      gap: number;
      padding: number;
      columns?: number;
      anchor: string;
      background: string;
      radius: number;
      body: Instruction[];
    }
  | { kind: "list"; ordered: boolean; body: Instruction[] }
  | {
      kind: "style";
      background: string;
      foreground: string;
      fontSize: number;
      padding: number;
    }
  | ({ kind: "cssRule" } & CssRule)
) & { className?: string; elementId?: string };
export type Expr = (
  | { kind: "literal"; value: Value | undefined }
  | { kind: "read"; name: string }
  | { kind: "binary"; op: Binary; left: Expr; right: Expr }
  | { kind: "unary"; op: Unary; value: Expr }
  | { kind: "array"; items: Expr[] }
  | { kind: "property"; object: Expr; key: Expr }
  | { kind: "classValue"; name: string; fields: Value }
  | { kind: "instantiate"; definition: Expr }
  | {
      kind: "address";
      name?: string;
      reference?: boolean;
      valueType?: DataType;
    }
  | { kind: "readAddress"; target: Expr; valueType?: DataType }
  | { kind: "isNullAddress"; target: Expr }
) & { at?: Location };

export type Instruction = (
  | { kind: "print"; value: Expr }
  | { kind: "document"; part: DocumentPart }
  | { kind: "declare" | "assign"; name: string; value: Expr }
  | { kind: "setField"; object: Expr; key: Expr; value: Expr }
  | { kind: "writeAddress"; target: Expr; value: Expr }
  | { kind: "branch"; test: Expr; yes: Instruction[]; no: Instruction[] }
  | { kind: "for"; name: string; start: Expr; end: Expr; body: Instruction[] }
  | { kind: "while"; test: Expr; body: Instruction[] }
  | {
      kind: "foreach";
      item: string;
      index: string;
      collection: Expr;
      body: Instruction[];
    }
  | { kind: "sequence"; blocks: Instruction[][] }
  | { kind: "call"; name: string; args: Expr[]; result: string }
  | {
      kind: "request";
      method: HttpMethod;
      target: "project" | "connected";
      path: Expr;
      body: Expr;
      result: string;
    }
  | { kind: "automation"; task: AutomationTask; input: Expr; result: string }
  | { kind: "respond"; status: Expr; body: Expr }
  | { kind: "return" | "delay" | "assert"; value: Expr }
  | { kind: "break" | "continue" | "breakpoint" }
) & { at: Location; breakpoint?: boolean };

export interface Program {
  main: Instruction[];
  functions: { name: string; parameters: string[]; body: Instruction[] }[];
  endpoints?: Endpoint[];
}
export function anyInstruction(
  program: Program,
  match: (instruction: Instruction) => boolean,
) {
  function scan(body: Instruction[]): boolean {
    return body.some(
      (item) =>
        match(item) ||
        (item.kind === "branch" && (scan(item.yes) || scan(item.no))) ||
        (item.kind === "sequence" && item.blocks.some(scan)) ||
        (item.kind === "document" &&
          "body" in item.part &&
          scan(item.part.body)) ||
        ((item.kind === "for" ||
          item.kind === "while" ||
          item.kind === "foreach") &&
          scan(item.body)),
    );
  }
  return scan(program.main) || program.functions.some(({ body }) => scan(body));
}
export interface SourceRange {
  at: Location;
  start: number;
  end: number;
}
export interface GeneratedSource {
  code: string;
  ranges: SourceRange[];
  extension: string;
  entryLine?: number;
  note?: string;
  interactive?: boolean;
}
export type NodeFeature =
  | "http"
  | "automation"
  | "document"
  | "security"
  | "memory"
  | "design";
export interface LanguageAdapter {
  id: string;
  label: string;
  sourceLanguage?: string;
  preview?: "document";
  onlyFeatures?: readonly NodeFeature[];
  unsupportedFeatures?: readonly NodeFeature[];
  nodePresentation?: Readonly<
    Record<
      string,
      {
        label: string;
        category: string;
        description: string;
      }
    >
  >;
  generate(program: Program, options: { comments: boolean }): GeneratedSource;
  generatePreview?(
    program: Program,
    options: { comments: boolean },
  ): GeneratedSource;
}
export class LanguageRegistry {
  private adapters = new Map<string, LanguageAdapter>();

  register(adapter: LanguageAdapter) {
    if (this.adapters.has(adapter.id))
      throw new Error(`Language already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, adapter);
    return this;
  }

  get(id: string) {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`Unsupported language: ${id}`);
    return adapter;
  }

  list() {
    return [...this.adapters.values()];
  }
}
