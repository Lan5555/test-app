import type { CssRule, CssStyle } from "./ir";

export const hexColor = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
const identifier = /^[a-zA-Z_][a-zA-Z0-9_-]{0,79}$/;
const tags = new Set(
  "body div header main section article nav footer h1 h2 p blockquote a img button input label hr details summary ol ul li".split(
    " ",
  ),
);

export function classAttribute(classes?: string) {
  if (!classes) return "";
  const names = classes.trim().split(/\s+/);
  if (!names.every((name) => identifier.test(name)))
    throw new Error(
      "Use CSS class names like card or featured-card, separated by spaces.",
    );
  return ` class="${names.join(" ")}"`;
}

function color(value: string) {
  if (!hexColor.test(value) && value !== "transparent")
    throw new Error(
      "Use a 3- or 6-digit hex color, such as #ffffff, or transparent.",
    );
  return value;
}
function range(
  label: string,
  value: number,
  min: number,
  max: number,
  unit = "",
) {
  if (!Number.isFinite(value) || value < min || value > max)
    throw new Error(
      `Set ${label} to a number from ${min} to ${max}${unit ? ` ${unit}` : ""}.`,
    );
  return `${value}${unit}`;
}
function preset(name: string, choices: Readonly<Record<string, string>>) {
  if (!Object.hasOwn(choices, name))
    throw new Error("Choose a supported CSS preset in Properties.");
  return choices[name];
}
const fontFamilies = {
  system: "system-ui, sans-serif",
  serif: "Georgia, serif",
  monospace: "monospace",
};
const shadows = {
  none: "none",
  soft: "0 4px 16px #17203320",
  raised: "0 12px 28px #17203335",
};

function declarations(style: CssStyle): Record<string, string> {
  switch (style.kind) {
    case "typography":
      if (
        !["400", "500", "600", "700", "800"].includes(style.fontWeight) ||
        !["left", "center", "right"].includes(style.align)
      )
        throw new Error("Choose a supported font weight and text alignment.");
      return {
        color: color(style.color),
        "font-size": range("Font Size", style.fontSize, 8, 120, "px"),
        "font-weight": style.fontWeight,
        "font-family": preset(style.fontFamily, fontFamilies),
        "text-align": style.align,
        "line-height": range("Line Height", style.lineHeight, 1, 3),
      };
    case "surface":
      return {
        "background-color": color(style.background),
        border: `${range("Border Width", style.borderWidth, 0, 24, "px")} solid ${color(style.borderColor)}`,
        "border-radius": range("Radius", style.radius, 0, 120, "px"),
        "box-shadow": preset(style.shadow, shadows),
      };
    case "spacing":
      return {
        margin: range("Margin", style.margin, 0, 200, "px"),
        padding: range("Padding", style.padding, 0, 200, "px"),
        gap: range("Gap", style.gap, 0, 120, "px"),
      };
    case "size":
      return {
        width: range("Width", style.width, 1, 100, "%"),
        "max-width": range("Max Width", style.maxWidth, 1, 2400, "px"),
        "box-sizing": "border-box",
        ...(style.center ? { "margin-inline": "auto" } : {}),
      };
  }
}

export function cssRuleLines({ selector, state, style }: CssRule) {
  if (
    !tags.has(selector) &&
    !(
      (selector.startsWith(".") || selector.startsWith("#")) &&
      identifier.test(selector.slice(1))
    )
  )
    throw new Error("Use a single CSS selector like .card, #about, or h1.");
  if (!["normal", "hover", "focus-visible"].includes(state))
    throw new Error("Choose a supported CSS state.");
  const suffix = state === "normal" ? "" : `:${state}`;
  return [
    `    ${selector}${suffix} {`,
    ...Object.entries(declarations(style)).map(
      ([name, value]) => `      ${name}: ${value};`,
    ),
    "    }",
  ];
}
