import { compilePageEvents } from "./html-interactions";
import { classAttribute, cssRuleLines, hexColor } from "./html-styles";
import type {
  DocumentPart,
  Instruction,
  LanguageAdapter,
  SourceRange,
} from "./ir";
import type { Location } from "./model";
import { escapeHtml, isHttpsUrl } from "./security";

const singleLine = (text: string) =>
  escapeHtml(text).replaceAll("\r", "&#13;").replaceAll("\n", "&#10;");
const textTags = {
  heading: "h1",
  subheading: "h2",
  paragraph: "p",
  quote: "blockquote",
  listItem: "li",
  button: "button",
} as const;
type DocumentInstruction = Extract<Instruction, { kind: "document" }>;
const anchor = /^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/;

function containerStyle(part: Extract<DocumentPart, { kind: "container" }>) {
  if (
    !(
      part.gap >= 0 &&
      part.gap <= 120 &&
      part.padding >= 0 &&
      part.padding <= 120
    )
  )
    throw new Error("Set layout gap and padding to values from 0 to 120 px.");
  if (part.background && !hexColor.test(part.background))
    throw new Error(
      "Choose a 3- or 6-digit hex background color for the container.",
    );
  if (!(part.radius >= 0 && part.radius <= 120))
    throw new Error("Set the container radius to a value from 0 to 120 px.");
  const appearance = `${part.background ? `; background-color:${part.background}` : ""}${part.radius ? `; border-radius:${part.radius}px` : ""}`;
  const spacing = `gap:${part.gap}px; padding:${part.padding}px${appearance}`;
  if (part.layout === "row") return `display:flex; flex-wrap:wrap; ${spacing}`;
  if (part.layout === "stack")
    return `display:flex; flex-direction:column; ${spacing}`;
  const columns = part.columns ?? 2;
  if (!Number.isInteger(columns) || columns < 1 || columns > 12)
    throw new Error("Set Grid Columns to a whole number from 1 to 12.");
  return `display:grid; grid-template-columns:repeat(${columns}, minmax(0, 1fr)); ${spacing}`;
}

function pageInstruction(
  instruction: Instruction,
): DocumentInstruction | undefined {
  if (instruction.kind === "breakpoint") return undefined;
  if (instruction.kind !== "document")
    throw new Error(
      "Connect HTML or CSS nodes to On Start to build a page. Use JavaScript for program logic.",
    );
  return instruction;
}

export const html: LanguageAdapter = {
  id: "html",
  label: "HTML / CSS",
  preview: "document",
  onlyFeatures: ["document", "design"],
  unsupportedFeatures: ["http", "automation"],
  generate(program) {
    if (program.functions.length || program.endpoints?.length)
      throw new Error(
        "HTML/CSS pages use a single Blueprint graph. Create a page from a blank project.",
      );

    const lines = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="utf-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    ];
    const ranges: SourceRange[] = [];
    const body: DocumentInstruction[] = [];
    const bodyLines: string[] = [];
    const bodyRanges: SourceRange[] = [];
    const defaults: string[] = [];
    const authorRules: { at: Location; lines: string[] }[] = [];
    const events: Parameters<typeof compilePageEvents>[0] = [];
    const elements = new Map<string, string>();
    let layouts = 0;
    let title: { text: string; at: Location } | undefined;
    let style:
      | { part: Extract<DocumentPart, { kind: "style" }>; at: Location }
      | undefined;
    function emit(at: Location, ...block: string[]) {
      const start = lines.length + 1;
      lines.push(...block);
      ranges.push({ at, start, end: lines.length });
    }
    function emitMarkup(at: Location, ...block: string[]) {
      const start = bodyLines.length + 1;
      bodyLines.push(...block);
      bodyRanges.push({ at, start, end: bodyLines.length });
    }
    function render(
      instruction: DocumentInstruction,
      depth: number,
      insideList = false,
    ) {
      const { part, at } = instruction;
      const indent = "  ".repeat(depth);
      const className = classAttribute(part.className);
      const id = part.kind === "container" ? part.anchor : part.elementId;
      if (id) {
        if (!anchor.test(id))
          throw new Error(
            "Start each Element ID with a letter and use letters, numbers, hyphens, or underscores.",
          );
        if (elements.has(id))
          throw new Error(`The Element ID ${id} is already in use.`);
        elements.set(id, part.kind);
      }
      const identity = `${id ? ` id="${id}"` : ""}${className}`;
      if (insideList && part.kind !== "listItem")
        throw new Error("Connect only List Item nodes to a List’s Body path.");
      if (!insideList && part.kind === "listItem")
        throw new Error("Connect List Item to the Body path of a List.");

      switch (part.kind) {
        case "container":
        case "list":
        case "details": {
          const tag =
            part.kind === "container"
              ? part.tag
              : part.kind === "details"
                ? "details"
                : part.ordered
                  ? "ol"
                  : "ul";
          let attributes = identity;
          if (part.kind === "container") {
            const id = ++layouts;
            defaults.push(
              `    :where([data-blueprint-layout="${id}"]) { ${containerStyle(part)}; }`,
            );
            attributes += ` data-blueprint-layout="${id}"`;
          }
          const start = bodyLines.length + 1;
          bodyLines.push(`${indent}<${tag}${attributes}>`);
          if (part.kind === "details")
            bodyLines.push(
              `${indent}  <summary>${singleLine(part.summary)}</summary>`,
            );
          for (const instruction of part.body) {
            const child = pageInstruction(instruction);
            if (child) render(child, depth + 1, part.kind === "list");
          }
          bodyLines.push(`${indent}</${tag}>`);
          bodyRanges.push({ at, start, end: bodyLines.length });
          break;
        }
        case "title":
        case "style":
        case "cssRule":
          throw new Error(
            "Place Page Title and CSS nodes on the main page path.",
          );
        case "pageEvent":
          throw new Error(
            "Place JavaScript Event nodes on the main page path.",
          );
        case "pageAction":
          throw new Error(
            "Connect JavaScript Action nodes to an event’s Body pin.",
          );
        case "divider":
          emitMarkup(at, `${indent}<hr${identity}>`);
          break;
        case "input":
          if (!id) throw new Error("Give each Text Input a unique Element ID.");
          emitMarkup(
            at,
            `${indent}<label for="${id}">${singleLine(part.label)}</label>`,
            `${indent}<input${identity} type="text" placeholder="${singleLine(part.placeholder)}" value="${singleLine(part.initial)}">`,
          );
          break;
        case "link": {
          const internal =
            part.href.startsWith("#") && anchor.test(part.href.slice(1));
          if (!internal && !isHttpsUrl(part.href))
            throw new Error("Use an HTTPS URL or a page anchor for Link.");
          const external = internal
            ? ""
            : ' target="_blank" rel="noopener noreferrer"';
          const href = internal ? part.href : new URL(part.href).href;
          emitMarkup(
            at,
            `${indent}<a${identity} href="${singleLine(href)}"${external}>${singleLine(part.text)}</a>`,
          );
          break;
        }
        case "image": {
          if (part.src && !isHttpsUrl(part.src))
            throw new Error("Use an HTTPS URL for Image.");
          if (
            !Number.isInteger(part.width) ||
            part.width < 1 ||
            part.width > 1920
          )
            throw new Error("Use a whole image width from 1 to 1920 px.");
          const source = part.src
            ? ` src="${singleLine(new URL(part.src).href)}"`
            : "";
          emitMarkup(
            at,
            `${indent}<img${identity}${source} alt="${singleLine(part.alt)}" width="${part.width}" loading="lazy" referrerpolicy="no-referrer">`,
          );
          if (
            !defaults.includes(
              "    :where(img) { max-width:100%; height:auto; }",
            )
          )
            defaults.push("    :where(img) { max-width:100%; height:auto; }");
          break;
        }
        default: {
          const tag = textTags[part.kind];
          const attributes = part.kind === "button" ? ' type="button"' : "";
          emitMarkup(
            at,
            `${indent}<${tag}${identity}${attributes}>${singleLine(part.text)}</${tag}>`,
          );
        }
      }
    }

    for (const item of program.main) {
      const instruction = pageInstruction(item);
      if (!instruction) continue;
      const { part, at } = instruction;
      if (part.kind === "title") title = { text: part.text, at };
      else if (part.kind === "style") style = { part, at };
      else if (part.kind === "cssRule")
        authorRules.push({ at, lines: cssRuleLines(part) });
      else if (part.kind === "pageEvent") events.push({ ...instruction, part });
      else body.push(instruction);
    }
    const interactive = events.length > 0;
    lines.push(
      `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https:${interactive ? "; script-src 'unsafe-inline'" : ""}">`,
    );
    if (title) emit(title.at, `  <title>${singleLine(title.text)}</title>`);
    else lines.push("  <title>Blueprint Page</title>");
    for (const instruction of body) render(instruction, 1);
    if (interactive)
      defaults.push("    [hidden] { display: none !important; }");
    const scripts = compilePageEvents(events, elements);
    const hasStyles = style || defaults.length || authorRules.length;
    if (hasStyles) lines.push("  <style>", ...defaults);
    if (style) {
      const { background, foreground, fontSize, padding } = style.part;
      if (!hexColor.test(background) || !hexColor.test(foreground))
        throw new Error(
          "Use a 3- or 6-digit hex color in Page Style, such as #ffffff.",
        );
      if (!(fontSize >= 8 && fontSize <= 72 && padding >= 0 && padding <= 120))
        throw new Error(
          "Page Style needs a font size of 8 to 72 px and padding of 0 to 120 px.",
        );
      emit(
        style.at,
        "    :where(body) {",
        `      background-color: ${background};`,
        `      color: ${foreground};`,
        `      font-size: ${fontSize}px;`,
        `      padding: ${padding}px;`,
        "    }",
      );
    }
    for (const rule of authorRules) emit(rule.at, ...rule.lines);
    if (hasStyles) lines.push("  </style>");
    lines.push("</head>", "<body>");
    const offset = lines.length;
    ranges.push(
      ...bodyRanges.map(({ at, start, end }) => ({
        at,
        start: start + offset,
        end: end + offset,
      })),
    );
    lines.push(...bodyLines);
    if (interactive) {
      lines.push("  <script>");
      const scriptOffset = lines.length;
      ranges.push(
        ...scripts.ranges.map(({ at, start, end }) => ({
          at,
          start: start + scriptOffset,
          end: end + scriptOffset,
        })),
      );
      lines.push(...scripts.lines, "  </script>");
    }
    lines.push("</body>", "</html>", "");
    return { code: lines.join("\n"), ranges, extension: ".html", interactive };
  },
};
