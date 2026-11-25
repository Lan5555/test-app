import {
  type AutomationTask,
  type Binary,
  type CssStyle,
  type DocumentPart,
  type Expr,
  httpMethods,
  type Instruction,
  type NodeFeature,
  type PageAction,
  type Unary,
} from "./ir";
import type { DataType, Graph, Node, Pin, Value } from "./model";

type Action = Instruction extends infer I
  ? I extends Instruction
    ? Omit<I, "at" | "breakpoint">
    : never
  : never;
export interface SymbolBinding {
  symbol: string;
  type: DataType;
}
export interface FunctionSignature {
  symbol: string;
  parameters: string[];
}
export interface LoweringContext {
  input(id: string): Expr;
  block(
    id: string,
    options?: { loop?: boolean; bindings?: Record<string, SymbolBinding> },
  ): Instruction[];
  bind(
    key: string,
    name: string,
    type: DataType,
    alias?: string,
  ): SymbolBinding;
  resolve(key: string, type?: DataType): SymbolBinding;
  function(name: string, requiresReceiver?: boolean): FunctionSignature;
  requireLoop(): void;
  requireFunction(): void;
  requireEndpoint(): void;
}
interface Property extends Pin {
  choices?: string[];
}
export interface NodeDefinition {
  id: string;
  label: string;
  category: string;
  description: string;
  feature?: NodeFeature;
  properties?: Property[];
  inputs?: Pin[] | ((node: Node, graphs: Graph[]) => Pin[]);
  outputs?: Pin[] | ((node: Node) => Pin[]);
  expression?: (node: Node, context: LoweringContext, output: string) => Expr;
  action?: (node: Node, context: LoweringContext) => Action;
  role?: "start" | "function" | "endpoint" | "comment";
  terminal?: boolean;
}

const definitions = new Map<string, NodeDefinition>();
export function registerNode(definition: NodeDefinition) {
  if (definitions.has(definition.id))
    throw new Error(`Node already registered: ${definition.id}`);
  definitions.set(definition.id, definition);
}
export const getNode = (id: string) => definitions.get(id);
export const allNodes = () => [...definitions.values()];
const exec = (id: string): Pin => ({ id, type: "exec" });
const pin = (id: string, type: DataType, fallback?: Value): Pin => ({
  id,
  type,
  fallback,
});
const output = (type: DataType) => [pin("value", type)];
const named = (id: string, fallback: string) => pin(id, "string", fallback);
const variableTypes = [
  "number",
  "string",
  "boolean",
  "array",
  "object",
  "any",
] as const;
const typeProperty: Property = {
  ...pin("type", "string", "number"),
  choices: [...variableTypes],
};
const variableName = named("name", "value");
const property = (node: Node, item: Pin) =>
  Object.hasOwn(node.values, item.id) ? node.values[item.id] : item.fallback;
export const propertyValue = property;
const nameOf = (node: Node, item: Pin) => String(property(node, item)).trim();
export const variableNameOf = (node: Node) => nameOf(node, variableName);
export const typeOfVariable = (node: Node): DataType => {
  const value = node.values.type;
  return variableTypes.find((type) => type === value) ?? "number";
};
export const variableReferenceId = (node: Node) =>
  ["get", "set", "addressOf", "referenceTo"].includes(node.kind) &&
  typeof node.values.declarationId === "string"
    ? node.values.declarationId
    : undefined;
const variableAlias = (id: string) => `@variable:${id}`;
const variableKey = (node: Node) => {
  const declaration = variableReferenceId(node);
  return declaration ? variableAlias(declaration) : variableNameOf(node);
};
const defaultFor: Record<(typeof variableTypes)[number], Value> = {
  number: 0,
  string: "",
  boolean: false,
  array: [],
  object: {},
  any: null,
};
const valueInput = (node: Node) => {
  const type = typeOfVariable(node) as keyof typeof defaultFor;
  return [pin("value", type, defaultFor[type])];
};
export const parametersOf = (node: Node) =>
  nameOf(node, named("parameters", ""))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
export const endpointInputs = [
  pin("method", "string"),
  pin("path", "string"),
  pin("body", "any"),
];
export const endpointMethod: Property = {
  ...named("method", "GET"),
  choices: [...httpMethods],
};
export const endpointPath = named("path", "/example");
export const pinsFor = (node: Node, graphs: Graph[]) => {
  const definition = getNode(node.kind);
  if (!definition) return { inputs: [], outputs: [] };
  const inputs =
    typeof definition.inputs === "function"
      ? definition.inputs(node, graphs)
      : (definition.inputs ?? []);
  const outputs =
    typeof definition.outputs === "function"
      ? definition.outputs(node)
      : (definition.outputs ?? []);
  return {
    inputs: definition.action ? [exec("in"), ...inputs] : inputs,
    outputs:
      definition.action && !definition.terminal
        ? [...outputs, exec("next")]
        : outputs,
  };
};
const literal = (value: Value | undefined): Expr => ({
  kind: "literal",
  value,
});
const read = (binding: SymbolBinding): Expr => ({
  kind: "read",
  name: binding.symbol,
});
const resultType = { ...typeProperty, fallback: "any" };
const resultTypeOf = (node: Node): DataType =>
  node.values.type === undefined ? "any" : typeOfVariable(node);

for (const [id, label, target, readId, writeId] of [
  ["addressOf", "Address Of", "pointer", "dereference", "writePointer"],
  [
    "referenceTo",
    "Reference To",
    "reference",
    "readReference",
    "writeReference",
  ],
] as const) {
  registerNode({
    id,
    label,
    feature: "memory",
    category: "Pointers & References",
    description: "Alias a declared variable in the current scope.",
    properties: [variableName, typeProperty],
    outputs: output(target),
    expression: (node, context) => ({
      kind: "address",
      name: context.resolve(variableKey(node), typeOfVariable(node)).symbol,
      reference: target === "reference",
      valueType: typeOfVariable(node),
    }),
  });
  registerNode({
    id: readId,
    label: target === "pointer" ? "Dereference Pointer" : "Read Reference",
    feature: "memory",
    category: "Pointers & References",
    description: "Read the current value of the aliased variable.",
    properties: [resultType],
    inputs: [pin("target", target)],
    outputs: (node) => output(resultTypeOf(node)),
    expression: (node, context) => ({
      kind: "readAddress",
      target: context.input("target"),
      valueType: resultTypeOf(node),
    }),
  });
  registerNode({
    id: writeId,
    label:
      target === "pointer"
        ? "Write Through Pointer"
        : "Write Through Reference",
    feature: "memory",
    category: "Pointers & References",
    description: "Update the original variable through its alias.",
    inputs: [pin("target", target), pin("value", "any", 0)],
    action: (_, context) => ({
      kind: "writeAddress",
      target: context.input("target"),
      value: context.input("value"),
    }),
  });
}
registerNode({
  id: "nullPointer",
  label: "Null Pointer",
  category: "Pointers & References",
  feature: "memory",
  description: "Create a pointer with no variable target.",
  outputs: output("pointer"),
  expression: () => ({ kind: "address" }),
});
registerNode({
  id: "isNullPointer",
  label: "Is Null Pointer",
  category: "Pointers & References",
  feature: "memory",
  description: "Check whether a pointer has a variable target.",
  inputs: [pin("target", "pointer")],
  outputs: output("boolean"),
  expression: (_, context) => ({
    kind: "isNullAddress",
    target: context.input("target"),
  }),
});

const className = named("className", "Student");
const classFields = pin("fields", "object", { name: "Ada" });
registerNode({
  id: "defineClass",
  label: "Define Class",
  category: "Objects & Classes",
  description:
    "Name a class and set the default fields copied into each new instance.",
  properties: [className, classFields],
  outputs: output("class"),
  expression: (node) => ({
    kind: "classValue",
    name: nameOf(node, className),
    fields: property(node, classFields) ?? {},
  }),
});
registerNode({
  id: "newInstance",
  label: "New Instance",
  category: "Objects & Classes",
  description:
    "Create an independent instance of a class and keep it on this execution path.",
  inputs: [pin("definition", "class")],
  outputs: output("object"),
  action: (node, context) => ({
    kind: "declare",
    name: context.bind(`@${node.id}:result`, "instance", "object").symbol,
    value: { kind: "instantiate", definition: context.input("definition") },
  }),
  expression: (node, context) => read(context.resolve(`@${node.id}:result`)),
});
const fieldInputs = [pin("object", "any"), pin("field", "string", "name")];
registerNode({
  id: "getField",
  label: "Get Field",
  category: "Objects & Classes",
  description: "Read a named field from an object or instance.",
  inputs: fieldInputs,
  outputs: output("any"),
  expression: (_, context) => ({
    kind: "property",
    object: context.input("object"),
    key: context.input("field"),
  }),
});
registerNode({
  id: "setField",
  label: "Set Field",
  category: "Objects & Classes",
  description: "Set a named field on an object or instance.",
  inputs: [...fieldInputs, pin("value", "any", null)],
  action: (_, context) => ({
    kind: "setField",
    object: context.input("object"),
    key: context.input("field"),
    value: context.input("value"),
  }),
});
registerNode({
  id: "start",
  label: "On Start",
  category: "Events",
  description: "Runs when the program starts.",
  role: "start",
  outputs: [exec("next")],
});
registerNode({
  id: "function",
  label: "Function Entry",
  category: "Functions",
  description:
    "Set comma-separated parameter names. Use Parameter nodes to read them.",
  role: "function",
  outputs: [exec("next")],
  properties: [named("parameters", "")],
});
registerNode({
  id: "comment",
  label: "Comment",
  category: "Workspace",
  description: "Annotate the graph.",
  role: "comment",
  properties: [named("text", "Add a note")],
});
registerNode({
  id: "aiBuildBlueprint",
  label: "AI Build Blueprint",
  category: "AI Automation",
  feature: "design",
  description:
    "Describe a small program or page, then generate and insert its connected nodes from Properties.",
});

const cssClass = { ...named("className", ""), label: "CSS Class" };
const elementId = { ...named("anchor", ""), label: "Element ID" };
for (const [id, label, kind, fallback] of [
  ["pageTitle", "Page Title", "title", "My Blueprint Page"],
  ["pageHeading", "Heading", "heading", "Hello World"],
  ["pageSubheading", "Subheading", "subheading", "About this page"],
  ["pageParagraph", "Paragraph", "paragraph", "Write your text here."],
  ["pageQuote", "Quote", "quote", "Add a quotation."],
  ["pageListItem", "List Item", "listItem", "New item"],
  ["pageButton", "Button", "button", "Continue"],
] as const) {
  const text = named("text", fallback);
  registerNode({
    id,
    label,
    feature: "document",
    category: "HTML",
    description:
      kind === "title"
        ? "Set the browser tab title."
        : kind === "listItem"
          ? "Add an item to a List’s Body path."
          : kind === "button"
            ? "Add a button. Give it an Element ID and use On Click to add behavior."
            : `Add a ${kind} to the page.`,
    properties: kind === "title" ? [text] : [text, cssClass, elementId],
    action: (node) => ({
      kind: "document",
      part: {
        kind,
        text: String(property(node, text)),
        className: nameOf(node, cssClass),
        elementId: nameOf(node, elementId),
      },
    }),
  });
}
registerNode({
  id: "pageDivider",
  label: "Horizontal Rule",
  feature: "document",
  category: "HTML",
  description: "Add a horizontal divider to the page.",
  properties: [cssClass],
  action: (node) => ({
    kind: "document",
    part: { kind: "divider", className: nameOf(node, cssClass) },
  }),
});
const containerGap = pin("gap", "number", 12);
const containerPadding = pin("padding", "number", 16);
const gridColumns = pin("columns", "number", 2);
const containerAnchor = { ...elementId, label: "Anchor / Element ID" };
const containerBackground = named("background", "");
const containerRadius = pin("radius", "number", 0);
const containerProperties = [
  containerGap,
  containerPadding,
  containerAnchor,
  containerBackground,
  containerRadius,
  cssClass,
];
for (const [id, label, tag, layout] of [
  ["pageContainer", "Container", "div", "stack"],
  ["pageSection", "Section", "section", "stack"],
  ["pageRow", "Row", "div", "row"],
  ["pageGrid", "Grid", "div", "grid"],
  ["pageHeader", "Header", "header", "stack"],
  ["pageNav", "Navigation", "nav", "row"],
  ["pageMain", "Main Content", "main", "stack"],
  ["pageArticle", "Article", "article", "stack"],
  ["pageFooter", "Footer", "footer", "stack"],
] as const) {
  registerNode({
    id,
    label,
    feature: "document",
    category: "HTML Layout",
    description: `Connect the elements inside this ${label.toLowerCase()} to Body. Connect the elements after it to Next.`,
    outputs: [exec("body")],
    properties:
      layout === "grid"
        ? [...containerProperties, gridColumns]
        : containerProperties,
    action: (node, context) => ({
      kind: "document",
      part: {
        kind: "container",
        tag,
        className: nameOf(node, cssClass),
        layout,
        gap: Number(property(node, containerGap)),
        padding: Number(property(node, containerPadding)),
        anchor: nameOf(node, containerAnchor),
        background: nameOf(node, containerBackground),
        radius: Number(property(node, containerRadius)),
        columns:
          layout === "grid" ? Number(property(node, gridColumns)) : undefined,
        body: context.block("body"),
      },
    }),
  });
}
const orderedList = pin("ordered", "boolean", false);
registerNode({
  id: "pageList",
  label: "List",
  feature: "document",
  category: "HTML Layout",
  description:
    "Connect List Item nodes to Body. Turn on Ordered for a numbered list.",
  properties: [orderedList, cssClass, elementId],
  outputs: [exec("body")],
  action: (node, context) => ({
    kind: "document",
    part: {
      kind: "list",
      elementId: nameOf(node, elementId),
      ordered: property(node, orderedList) === true,
      className: nameOf(node, cssClass),
      body: context.block("body"),
    },
  }),
});
const linkText = named("text", "Read more");
const linkTarget = named("href", "#about");
registerNode({
  id: "pageLink",
  label: "Link",
  category: "HTML",
  feature: "document",
  description: "Link to a page anchor such as #about or to an HTTPS address.",
  properties: [linkText, linkTarget, cssClass, elementId],
  action: (node) => ({
    kind: "document",
    part: {
      kind: "link",
      elementId: nameOf(node, elementId),
      text: String(property(node, linkText)),
      className: nameOf(node, cssClass),
      href: nameOf(node, linkTarget),
    },
  }),
});
const imageSource = named("src", "");
const imageAlt = named("alt", "");
const imageWidth = pin("width", "number", 640);
registerNode({
  id: "pageImage",
  label: "Image",
  category: "HTML",
  feature: "document",
  description:
    "Display an image from an HTTPS URL. Add alternative text and set its maximum width in pixels.",
  properties: [imageSource, imageAlt, imageWidth, cssClass, elementId],
  action: (node) => ({
    kind: "document",
    part: {
      kind: "image",
      elementId: nameOf(node, elementId),
      src: nameOf(node, imageSource),
      className: nameOf(node, cssClass),
      alt: String(property(node, imageAlt)),
      width: Number(property(node, imageWidth)),
    },
  }),
});
const detailsSummary = named("summary", "More information");
registerNode({
  id: "pageDetails",
  label: "Disclosure",
  category: "HTML Layout",
  feature: "document",
  description: "Create an expandable section. Put the hidden content on Body.",
  properties: [detailsSummary, cssClass, elementId],
  outputs: [exec("body")],
  action: (node, context) => ({
    kind: "document",
    part: {
      kind: "details",
      elementId: nameOf(node, elementId),
      summary: String(property(node, detailsSummary)),
      className: nameOf(node, cssClass),
      body: context.block("body"),
    },
  }),
});

const inputElementId = { ...elementId, fallback: "message" };
const inputLabel = named("label", "Message");
const inputPlaceholder = named("placeholder", "Type here");
const inputInitial = named("initial", "");
registerNode({
  id: "pageTextInput",
  label: "Text Input",
  category: "HTML",
  feature: "document",
  description:
    "Add a labeled input. Use its Element ID in On Input or Copy Input Text.",
  properties: [
    inputElementId,
    inputLabel,
    inputPlaceholder,
    inputInitial,
    cssClass,
  ],
  action: (node) => ({
    kind: "document",
    part: {
      kind: "input",
      elementId: nameOf(node, inputElementId),
      className: nameOf(node, cssClass),
      label: String(property(node, inputLabel)),
      placeholder: String(property(node, inputPlaceholder)),
      initial: String(property(node, inputInitial)),
    },
  }),
});
for (const [id, label, event, fallback] of [
  ["pageOnClick", "On Click", "click", "button"],
  ["pageOnInput", "On Input", "input", "message"],
] as const) {
  const source = { ...named("source", fallback), label: "Source Element ID" };
  registerNode({
    id,
    label,
    category: "JavaScript Events",
    feature: "document",
    description:
      "Put this node on the main Next path. Connect the actions you want to run to Body.",
    properties: [source],
    outputs: [exec("body")],
    action: (node, context) => ({
      kind: "document",
      part: {
        kind: "pageEvent",
        event,
        source: nameOf(node, source),
        body: context.block("body"),
      },
    }),
  });
}
const actionTarget = {
  ...named("target", "output"),
  label: "Target Element ID",
};
const actionText = named("text", "Updated!");
const actionInput = {
  ...named("source", "message"),
  label: "Input Element ID",
};
const actionClass = { ...named("token", "active"), label: "CSS Class" };
const actionStep = pin("step", "number", 1);
const pageActions: [
  string,
  string,
  string,
  Property[],
  (node: Node, target: string) => PageAction,
][] = [
  [
    "pageSetText",
    "Set Text",
    "Replace the text of a heading, paragraph, or other text element.",
    [actionText],
    (node, target) => ({
      kind: "setText",
      target,
      text: String(property(node, actionText)),
    }),
  ],
  [
    "pageCopyInput",
    "Copy Input Text",
    "Show the current text from a Text Input in another element.",
    [actionInput],
    (node, target) => ({
      kind: "copyInput",
      target,
      source: nameOf(node, actionInput),
    }),
  ],
  [
    "pageToggleHidden",
    "Toggle Visibility",
    "Show or hide an element each time the event runs.",
    [],
    (_, target) => ({ kind: "toggleHidden", target }),
  ],
  [
    "pageToggleClass",
    "Toggle CSS Class",
    "Add or remove a CSS class on an element.",
    [actionClass],
    (node, target) => ({
      kind: "toggleClass",
      target,
      token: nameOf(node, actionClass),
    }),
  ],
  [
    "pageIncrement",
    "Increment Counter",
    "Add a number to a text element. Start the text at 0 to make a click counter.",
    [actionStep],
    (node, target) => ({
      kind: "increment",
      target,
      step: Number(property(node, actionStep)),
    }),
  ],
];
for (const [id, label, description, properties, action] of pageActions) {
  registerNode({
    id,
    label,
    description,
    category: "JavaScript Actions",
    feature: "document",
    properties: [actionTarget, ...properties],
    action: (node) => ({
      kind: "document",
      part: {
        kind: "pageAction",
        action: action(node, nameOf(node, actionTarget)),
      },
    }),
  });
}
const pageStyleFields = [
  named("background", "#ffffff"),
  named("foreground", "#172033"),
  pin("fontSize", "number", 16),
  pin("padding", "number", 24),
] as const;
registerNode({
  id: "pageStyle",
  label: "Page Style",
  feature: "document",
  category: "CSS",
  description:
    "Set background and text colors using hex codes, plus font size and padding in pixels.",
  properties: [...pageStyleFields],
  action: (node) => {
    const [background, foreground, fontSize, padding] = pageStyleFields.map(
      (field) => property(node, field),
    );
    const part: DocumentPart = {
      kind: "style",
      background: String(background),
      foreground: String(foreground),
      fontSize: Number(fontSize),
      padding: Number(padding),
    };
    return { kind: "document", part };
  },
});

const cssSelector = named("selector", ".card");
const selectStyle = (
  id: string,
  fallback: string,
  choices: string[],
): Property => ({ ...named(id, fallback), choices });
const cssState = selectStyle("state", "normal", [
  "normal",
  "hover",
  "focus-visible",
]);
const ruleFields: Record<CssStyle["kind"], Property[]> = {
  typography: [
    named("color", "#172033"),
    pin("fontSize", "number", 18),
    selectStyle("fontWeight", "500", ["400", "500", "600", "700", "800"]),
    selectStyle("fontFamily", "system", ["system", "serif", "monospace"]),
    selectStyle("align", "left", ["left", "center", "right"]),
    pin("lineHeight", "number", 1.5),
  ],
  surface: [
    named("background", "#ffffff"),
    named("borderColor", "#d8ddea"),
    pin("borderWidth", "number", 1),
    pin("radius", "number", 12),
    selectStyle("shadow", "soft", ["none", "soft", "raised"]),
  ],
  spacing: [
    pin("margin", "number", 0),
    pin("padding", "number", 16),
    pin("gap", "number", 12),
  ],
  size: [
    pin("width", "number", 100),
    pin("maxWidth", "number", 960),
    pin("center", "boolean", true),
  ],
};
for (const [id, kind, label, fields] of [
  [
    "cssTypography",
    "typography",
    "CSS Typography",
    "text color, font, size, weight, alignment, and line height",
  ],
  [
    "cssSurface",
    "surface",
    "CSS Surface",
    "background, border, rounded corners, and shadow",
  ],
  [
    "cssSpacing",
    "spacing",
    "CSS Spacing",
    "margin, padding, and gap in pixels",
  ],
  [
    "cssSize",
    "size",
    "CSS Size",
    "percent width, maximum width in pixels, and centering",
  ],
] as const) {
  const properties = ruleFields[kind];
  registerNode({
    id,
    label,
    category: "CSS",
    feature: "document",
    description: `Set ${fields}. Use a selector like .card, #about, or h1. Connect this rule on the main page path.`,
    properties: [cssSelector, cssState, ...properties],
    action: (node) => ({
      kind: "document",
      part: {
        kind: "cssRule",
        selector: nameOf(node, cssSelector),
        state: nameOf(node, cssState),
        style: {
          kind,
          ...Object.fromEntries(
            properties.map((pin) => [pin.id, property(node, pin)]),
          ),
        } as CssStyle,
      },
    }),
  });
}

for (const [id, label, description, type, inputType, fallback] of [
  [
    "isHttpsUrl",
    "Check HTTPS URL",
    "Check locally for an absolute HTTPS URL with empty credentials.",
    "boolean",
    "string",
    "",
  ],
  [
    "escapeHtml",
    "Escape HTML Text",
    "Encode markup characters so the value can be displayed as HTML text.",
    "string",
    "string",
    "",
  ],
  [
    "urlOrigin",
    "Get URL Origin",
    "Extract the scheme, host, and port from an HTTP or HTTPS address. Invalid addresses return an empty string.",
    "string",
    "string",
    "",
  ],
  [
    "redactEmails",
    "Redact Email Addresses",
    "Replace common email addresses in text with [redacted].",
    "string",
    "string",
    "",
  ],
  [
    "isSha256Digest",
    "Check SHA-256 Format",
    "Check whether a value contains exactly 64 hexadecimal characters.",
    "boolean",
    "string",
    "",
  ],
  [
    "missingSecurityHeaders",
    "Find Missing Security Headers",
    "Enter response headers as a JSON object to list missing headers or headers with empty values.",
    "array",
    "object",
    {},
  ],
] as const) {
  registerNode({
    id,
    label,
    description,
    feature: "security",
    category: "Defensive Security",
    inputs: [pin("input", inputType, fallback)],
    outputs: output(type),
    expression: (_, context) => ({
      kind: "unary",
      op: id,
      value: context.input("input"),
    }),
  });
}

registerNode({
  id: "endpoint",
  feature: "http",
  label: "On HTTP Request",
  category: "HTTP & API",
  description:
    "Starts an endpoint graph when a request matches its method and path.",
  role: "endpoint",
  properties: [endpointMethod, endpointPath],
  outputs: [exec("next"), ...endpointInputs],
  expression: (_, c, output) => read(c.resolve(`:${output}`)),
});
registerNode({
  id: "httpResponse",
  feature: "http",
  label: "HTTP Response",
  category: "HTTP & API",
  description:
    "Finishes an endpoint request and returns a status code and a JSON body.",
  terminal: true,
  inputs: [pin("status", "number", 200), pin("body", "any", null)],
  action: (_, c) => {
    c.requireEndpoint();
    return {
      kind: "respond",
      status: c.input("status"),
      body: c.input("body"),
    };
  },
});
const apiTarget: Property = {
  ...named("target", "project"),
  choices: ["project", "connected"],
};
for (const method of httpMethods) {
  registerNode({
    id: `http${method}`,
    feature: "http",
    label: `HTTP ${method}`,
    category: "HTTP & API",
    description:
      "Send a request to a project endpoint or to the configured API connection. Use a relative path.",
    properties: [apiTarget],
    inputs: [
      pin("path", "string", "/example"),
      ...(method === "GET" ? [] : [pin("body", "any", null)]),
    ],
    outputs: [pin("status", "number"), pin("body", "any")],
    action: (node, c) => ({
      kind: "request",
      method,
      target:
        property(node, apiTarget) === "connected" ? "connected" : "project",
      path: c.input("path"),
      body: method === "GET" ? literal(null) : c.input("body"),
      result: c.bind(`@${node.id}:result`, "response", "object").symbol,
    }),
    expression: (node, c, key) => ({
      kind: "property",
      object: read(c.resolve(`@${node.id}:result`)),
      key: literal(key),
    }),
  });
}

const aiNodes: Record<AutomationTask, string> = {
  summarize: "AI Summarize Text",
  actions: "AI Extract Action Items",
  explain: "AI Explain JavaScript",
};
for (const task of Object.keys(aiNodes) as AutomationTask[]) {
  registerNode({
    id: `ai_${task}`,
    feature: "automation",
    label: aiNodes[task],
    category: "AI Automation",
    description:
      "Use the OpenAI key connected in Studio. The input goes to OpenAI when you run this node.",
    inputs: [pin("input", "string")],
    outputs: [pin("output", "string")],
    action: (node, c) => ({
      kind: "automation",
      task,
      input: c.input("input"),
      result: c.bind(`@${node.id}:result`, "aiOutput", "string").symbol,
    }),
    expression: (node, c) => read(c.resolve(`@${node.id}:result`)),
  });
}
for (const [type, label, value] of [
  ["string", "String", ""],
  ["number", "Number", 0],
  ["boolean", "Boolean", false],
  ["null", "Null", null],
  ["undefined", "Undefined", undefined],
  ["object", "Object", {}],
] as const) {
  const definition = pin("literal", type, value);
  registerNode({
    id: type,
    label,
    category: "Values",
    description: `Supplies a ${label.toLowerCase()} value.`,
    outputs: output(type),
    properties: value == null ? undefined : [definition],
    expression: (node) => literal(property(node, definition)),
  });
}

function binary(
  id: Binary,
  label: string,
  category: string,
  type: DataType,
  result = type,
) {
  const fallback =
    type === "number"
      ? 0
      : type === "boolean"
        ? false
        : type === "string"
          ? ""
          : null;
  registerNode({
    id,
    label,
    category,
    description: `${label} evaluates two input values.`,
    inputs: [
      pin("a", type, fallback),
      pin("b", type, id === "divide" || id === "modulo" ? 1 : fallback),
    ],
    outputs: output(result),
    expression: (_, context) => ({
      kind: "binary",
      op: id,
      left: context.input("a"),
      right: context.input("b"),
    }),
  });
}
for (const [id, label] of [
  ["add", "Add"],
  ["subtract", "Subtract"],
  ["multiply", "Multiply"],
  ["divide", "Divide"],
  ["modulo", "Modulo"],
  ["power", "Power"],
  ["minimum", "Minimum"],
  ["maximum", "Maximum"],
] as const)
  binary(id, label, "Math", "number");
for (const [id, label] of [
  ["greater", "Greater Than"],
  ["less", "Less Than"],
  ["atLeast", "At Least"],
  ["atMost", "At Most"],
] as const)
  binary(id, label, "Comparison", "number", "boolean");
binary("equal", "Strict Equal", "Comparison", "any", "boolean");
binary("notEqual", "Not Equal", "Comparison", "any", "boolean");
binary("concat", "Concatenate", "Strings", "string");
for (const [id, label] of [
  ["and", "AND"],
  ["or", "OR"],
  ["xor", "XOR"],
] as const)
  binary(id, label, "Logic", "boolean");

function unary(
  op: Unary,
  label: string,
  category: string,
  type: DataType,
  result: DataType,
  id: string = op,
) {
  registerNode({
    id,
    label,
    category,
    description: `${label} uses one input value.`,
    inputs: [pin("input", type)],
    outputs: output(result),
    expression: (_, context) => ({
      kind: "unary",
      op,
      value: context.input("input"),
    }),
  });
}
unary("not", "NOT", "Logic", "boolean", "boolean");
for (const [id, label] of [
  ["round", "Round"],
  ["floor", "Floor"],
  ["ceil", "Ceiling"],
  ["sqrt", "Square Root"],
  ["abs", "Absolute Value"],
] as const)
  unary(id, label, "Math", "number", "number");
unary("string", "To String", "Conversion", "any", "string", "toString");
unary("number", "To Number", "Conversion", "any", "number", "toNumber");
unary("boolean", "To Boolean", "Conversion", "any", "boolean", "toBoolean");
unary("json", "JSON Stringify", "Conversion", "any", "string");
unary("length", "String Length", "Strings", "string", "number", "stringLength");
unary("length", "Array Length", "Arrays", "array", "number", "arrayLength");
unary("upper", "Uppercase", "Strings", "string", "string");
unary("lower", "Lowercase", "Strings", "string", "string");
unary("trim", "Trim", "Strings", "string", "string");
registerNode({
  id: "array",
  label: "Create Array",
  category: "Arrays",
  description: "Creates an array from three values.",
  inputs: [
    pin("first", "any", null),
    pin("second", "any", null),
    pin("third", "any", null),
  ],
  outputs: output("array"),
  expression: (_, c) => ({
    kind: "array",
    items: ["first", "second", "third"].map(c.input),
  }),
});
for (const [id, label, category, type, keyType] of [
  ["element", "Get Element", "Arrays", "array", "number"],
  ["property", "Get Property", "Objects", "object", "string"],
] as const)
  registerNode({
    id,
    label,
    category,
    description:
      "Looks up an own value by index or key. Missing values are undefined.",
    inputs: [pin("collection", type), pin("key", keyType)],
    outputs: output("any"),
    expression: (_, c) => ({
      kind: "property",
      object: c.input("collection"),
      key: c.input("key"),
    }),
  });

for (const id of ["declare", "set", "get"] as const) {
  const label = {
    declare: "Declare Variable",
    set: "Set Variable",
    get: "Get Variable",
  }[id];
  registerNode({
    id,
    label,
    category: "Variables",
    description:
      "Use the same name and data type when referring to a variable.",
    properties: [variableName, typeProperty],
    ...(id === "get"
      ? {
          outputs: (node) => output(typeOfVariable(node)),
          expression: (node, c) =>
            read(c.resolve(variableKey(node), typeOfVariable(node))),
        }
      : {
          inputs: valueInput,
          action: (node, c) => {
            const name = variableNameOf(node);
            const type = typeOfVariable(node);
            const value = c.input("value");
            const binding =
              id === "declare"
                ? c.bind(name, name, type, variableAlias(node.id))
                : c.resolve(variableKey(node), type);
            return {
              kind: id === "declare" ? "declare" : "assign",
              name: binding.symbol,
              value,
            };
          },
        }),
  });
}

registerNode({
  id: "print",
  label: "Print",
  category: "Debugging",
  description: "Writes a value to the console.",
  inputs: [pin("value", "any", "Hello World")],
  action: (_, c) => ({ kind: "print", value: c.input("value") }),
});
registerNode({
  id: "assert",
  label: "Assert",
  category: "Debugging",
  description: "Stops execution when the condition is false.",
  inputs: [pin("condition", "boolean", false)],
  action: (_, c) => ({ kind: "assert", value: c.input("condition") }),
});
registerNode({
  id: "breakpoint",
  label: "Breakpoint",
  category: "Debugging",
  description: "Pauses execution in Debug mode.",
  action: () => ({ kind: "breakpoint" }),
});
registerNode({
  id: "delay",
  label: "Delay",
  category: "Flow",
  description: "Waits for up to 1,000 milliseconds.",
  inputs: [pin("milliseconds", "number", 100)],
  action: (_, c) => ({ kind: "delay", value: c.input("milliseconds") }),
});
registerNode({
  id: "branch",
  label: "Branch",
  category: "Flow",
  description: "Runs True or False, then continues through Next.",
  inputs: [pin("condition", "boolean", false)],
  outputs: [exec("true"), exec("false")],
  action: (_, c) => ({
    kind: "branch",
    test: c.input("condition"),
    yes: c.block("true"),
    no: c.block("false"),
  }),
});
registerNode({
  id: "sequence",
  label: "Sequence",
  category: "Flow",
  description: "Runs First, then Second, then continues through Next.",
  outputs: [exec("first"), exec("second")],
  action: (_, c) => ({
    kind: "sequence",
    blocks: [c.block("first"), c.block("second")],
  }),
});
const loopOutputs = [exec("body"), pin("index", "number")];
registerNode({
  id: "for",
  label: "For Loop",
  category: "Flow",
  description:
    "Counts from Start up to the exclusive End. Next runs after the loop.",
  inputs: [pin("start", "number", 0), pin("end", "number", 10)],
  outputs: loopOutputs,
  expression: (node, c, id) => read(c.resolve(`@${node.id}:${id}`)),
  action: (node, c) => {
    const key = `@${node.id}:index`;
    const index = c.bind(key, "index", "number");
    return {
      kind: "for",
      name: index.symbol,
      start: c.input("start"),
      end: c.input("end"),
      body: c.block("body", { loop: true, bindings: { [key]: index } }),
    };
  },
});
registerNode({
  id: "while",
  label: "While Loop",
  category: "Flow",
  description:
    "Rechecks Condition before each iteration. Next runs after the loop.",
  inputs: [pin("condition", "boolean", false)],
  outputs: [exec("body")],
  action: (_, c) => ({
    kind: "while",
    test: c.input("condition"),
    body: c.block("body", { loop: true }),
  }),
});
registerNode({
  id: "foreach",
  label: "For Each Loop",
  category: "Flow",
  description: "Runs Body once for each array element.",
  inputs: [pin("collection", "array", [])],
  outputs: [...loopOutputs, pin("item", "any")],
  expression: (node, c, id) => read(c.resolve(`@${node.id}:${id}`)),
  action: (node, c) => {
    const indexKey = `@${node.id}:index`;
    const itemKey = `@${node.id}:item`;
    const index = c.bind(indexKey, "index", "number");
    const item = c.bind(itemKey, "item", "any");
    return {
      kind: "foreach",
      index: index.symbol,
      item: item.symbol,
      collection: c.input("collection"),
      body: c.block("body", {
        loop: true,
        bindings: { [itemKey]: item, [indexKey]: index },
      }),
    };
  },
});
for (const kind of ["break", "continue"] as const)
  registerNode({
    id: kind,
    label: kind === "break" ? "Break" : "Continue",
    category: "Flow",
    description: "Transfers control within the nearest loop.",
    terminal: true,
    action: (_, c) => {
      c.requireLoop();
      return { kind };
    },
  });
const functionName = named("functionName", "Function");
export const functionNameOf = (node: Node) => nameOf(node, functionName);
registerNode({
  id: "parameter",
  label: "Parameter",
  category: "Functions",
  description: "Reads an argument passed to the current function.",
  properties: [variableName],
  outputs: output("any"),
  expression: (node, c) => {
    c.requireFunction();
    return read(c.resolve(`:${nameOf(node, variableName)}`));
  },
});
registerNode({
  id: "setParameter",
  label: "Set Parameter",
  category: "Functions",
  description:
    "Changes the parameter’s value for the rest of this function call.",
  properties: [variableName],
  inputs: [pin("value", "any")],
  action: (node, c) => {
    c.requireFunction();
    return {
      kind: "assign",
      name: c.resolve(`:${variableNameOf(node)}`).symbol,
      value: c.input("value"),
    };
  },
});
for (const id of ["call", "callMethod"] as const)
  registerNode({
    id,
    label: id === "call" ? "Call Function" : "Call Method",
    category: id === "call" ? "Functions" : "Objects & Classes",
    description:
      id === "call"
        ? "Runs a function graph and supplies its result to downstream nodes."
        : "Use a function graph with the receiver as its first parameter, such as self.",
    properties: [functionName],
    inputs: (node, graphs) => {
      const entry = graphs
        .slice(1)
        .find(
          (g) =>
            g.name === functionNameOf(node) &&
            g.nodes.some((entry) => entry.kind === "function"),
        )
        ?.nodes.find((n) => n.kind === "function");
      const args = entry
        ? parametersOf(entry).map((label, index) => ({
            ...pin(`arg${index + 1}`, "any"),
            label,
          }))
        : [];
      return id === "callMethod"
        ? [{ ...pin("receiver", "object"), label: "Object" }, ...args.slice(1)]
        : args;
    },
    outputs: [pin("result", "any")],
    expression: (node, c) => read(c.resolve(`@${node.id}:result`)),
    action: (node, c) => {
      const signature = c.function(functionNameOf(node), id === "callMethod");
      const args = signature.parameters.map((_, index) =>
        c.input(
          id === "callMethod" && index === 0 ? "receiver" : `arg${index + 1}`,
        ),
      );
      return {
        kind: "call",
        name: signature.symbol,
        args,
        result: c.bind(`@${node.id}:result`, "result", "any").symbol,
      };
    },
  });
registerNode({
  id: "return",
  label: "Return",
  category: "Functions",
  description: "Returns a value to the caller.",
  inputs: [pin("value", "any", null)],
  terminal: true,
  action: (_, c) => {
    c.requireFunction();
    return { kind: "return", value: c.input("value") };
  },
});
