import type { Edge, Graph, Node, Project, Value } from "./model";

export const MAX_PROJECT_BYTES = 80_000;
function valid(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function record(value: unknown): Record<string, unknown> {
  valid(
    value && typeof value === "object" && !Array.isArray(value),
    "Expected a Blueprint record.",
  );
  return value as Record<string, unknown>;
}
function identifier(value: unknown) {
  valid(
    typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value),
    "Invalid graph, node, edge or pin identifier.",
  );
  return value;
}
function label(value: unknown) {
  valid(
    typeof value === "string" && value.trim().length > 0 && value.length <= 100,
    "Names must contain 1–100 characters.",
  );
  return value;
}
function array(value: unknown, max: number) {
  valid(
    Array.isArray(value) && value.length <= max,
    "A Blueprint collection exceeds its size limit.",
  );
  return value as unknown[];
}
function parseValue(value: unknown, depth = 0): Value {
  valid(depth <= 12, "A literal has too many nested levels.");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length <= 8192) return value;
  if (Array.isArray(value))
    return array(value, 200).map((item) => parseValue(item, depth + 1));
  const entries = Object.entries(record(value));
  valid(
    entries.length <= 200 && entries.every(([key]) => key.length <= 200),
    "A Blueprint object has too many or oversized keys.",
  );
  return Object.fromEntries(
    entries.map(([key, item]) => [key, parseValue(item, depth + 1)]),
  );
}
function position(value: unknown) {
  valid(
    typeof value === "number" &&
      Number.isFinite(value) &&
      Math.abs(value) <= 100_000,
    "Invalid canvas position.",
  );
  return value;
}
function nodeOf(value: unknown): Node {
  const node = record(value);
  const entries = Object.entries(record(node.values));
  valid(entries.length <= 24, "A node has too many properties.");
  return {
    id: identifier(node.id),
    kind: identifier(node.kind),
    x: position(node.x),
    y: position(node.y),
    values: Object.fromEntries(
      entries.map(([key, item]) => [identifier(key), parseValue(item)]),
    ),
    ...(node.breakpoint === true ? { breakpoint: true } : {}),
  };
}
function edgeOf(value: unknown): Edge {
  const edge = record(value);
  valid(edge.kind === "exec" || edge.kind === "data", "Invalid wire type.");
  return {
    id: identifier(edge.id),
    source: identifier(edge.source),
    target: identifier(edge.target),
    sourcePin: identifier(edge.sourcePin),
    targetPin: identifier(edge.targetPin),
    kind: edge.kind,
  };
}
function unique(items: { id: string }[]) {
  valid(
    new Set(items.map((item) => item.id)).size === items.length,
    "Blueprint identifiers must be unique.",
  );
}
function graphOf(value: unknown): Graph {
  const graph = record(value);
  const nodes = array(graph.nodes, 250).map(nodeOf);
  const edges = array(graph.edges, 750).map(edgeOf);
  unique(nodes);
  unique(edges);
  return { id: identifier(graph.id), name: label(graph.name), nodes, edges };
}
export function parseProject(input: unknown): Project {
  const raw = record(input);
  valid(raw.version === 1, "This Blueprint format version is unsupported.");
  const graphs = array(raw.graphs, 12).map(graphOf);
  valid(graphs.length > 0, "A Blueprint needs a main graph.");
  unique(graphs);
  const project: Project = {
    version: 1,
    title: label(raw.title),
    graphs,
    comments: raw.comments === true,
    ...(raw.assignmentId === undefined
      ? {}
      : { assignmentId: identifier(raw.assignmentId) }),
  };
  valid(
    new TextEncoder().encode(JSON.stringify(project)).length <=
      MAX_PROJECT_BYTES,
    "The Blueprint is too large.",
  );
  return project;
}
export function importProject(source: string) {
  valid(
    new TextEncoder().encode(source).length <= MAX_PROJECT_BYTES,
    "The Blueprint file is too large.",
  );
  return parseProject(JSON.parse(source));
}
