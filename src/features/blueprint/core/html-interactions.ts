import type { DocumentPart, Instruction, PageAction, SourceRange } from "./ir";

type PageEvent = Instruction & {
  kind: "document";
  part: Extract<DocumentPart, { kind: "pageEvent" }>;
};
const textKinds = new Set([
  "heading",
  "subheading",
  "paragraph",
  "quote",
  "listItem",
  "button",
  "link",
]);
const classToken = /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/;
const jsString = (value: string) =>
  JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
const find = (id: string) => `document.getElementById(${jsString(id)})`;

export function compilePageEvents(
  events: PageEvent[],
  elements: ReadonlyMap<string, string>,
) {
  const lines: string[] = [];
  const ranges: SourceRange[] = [];
  function element(id: string, label: string) {
    const kind = elements.get(id);
    if (!kind)
      throw new Error(
        `${label} needs an Element ID from the rendered page${id ? `: ${id}` : ""}.`,
      );
    return kind;
  }
  function actionLine(action: PageAction) {
    const kind = element(action.target, "A JavaScript action");
    const target = find(action.target);
    if (
      ["setText", "copyInput", "increment"].includes(action.kind) &&
      !textKinds.has(kind)
    )
      throw new Error(
        "Text actions need a text element, such as a Heading or Paragraph, as their target.",
      );
    switch (action.kind) {
      case "setText":
        return `${target}.textContent = ${jsString(action.text)};`;
      case "copyInput":
        if (element(action.source, "Copy Input Text") !== "input")
          throw new Error(
            "Copy Input Text needs the Element ID of a Text Input.",
          );
        return `${target}.textContent = ${find(action.source)}.value;`;
      case "toggleHidden":
        return `${target}.hidden = !${target}.hidden;`;
      case "toggleClass":
        if (!classToken.test(action.token))
          throw new Error(
            "Toggle CSS Class needs one class name, such as active.",
          );
        return `${target}.classList.toggle(${jsString(action.token)});`;
      case "increment":
        if (!Number.isFinite(action.step) || Math.abs(action.step) > 10000)
          throw new Error(
            "Set the counter step to a number from -10000 to 10000.",
          );
        return `${target}.textContent = String((Number(${target}.textContent) || 0) + (${action.step}));`;
    }
  }

  for (const { at, part } of events) {
    const sourceKind = element(
      part.source,
      part.event === "click" ? "On Click" : "On Input",
    );
    if (part.event === "input" && sourceKind !== "input")
      throw new Error("On Input needs the Element ID of a Text Input.");
    if (
      part.event === "click" &&
      sourceKind !== "button" &&
      sourceKind !== "link"
    )
      throw new Error("On Click needs the Element ID of a Button or Link.");
    const start = lines.length + 1;
    lines.push(
      `    ${find(part.source)}.addEventListener(${jsString(part.event)}, () => {`,
    );
    for (const instruction of part.body) {
      if (instruction.kind === "breakpoint") continue;
      if (
        instruction.kind !== "document" ||
        instruction.part.kind !== "pageAction"
      )
        throw new Error(
          "Connect JavaScript Action nodes to the event’s Body pin.",
        );
      lines.push(`      ${actionLine(instruction.part.action)}`);
      ranges.push({
        at: instruction.at,
        start: lines.length,
        end: lines.length,
      });
    }
    lines.push("    });");
    ranges.push({ at, start, end: lines.length });
  }
  return { lines, ranges };
}
