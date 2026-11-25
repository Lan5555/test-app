import { buildIR } from "./compiler";
import type { LanguageAdapter } from "./ir";
import {
  compatible,
  createNode,
  type Edge,
  type Graph,
  type Project,
} from "./model";
import { allNodes, pinsFor } from "./registry";
import { parseProject } from "./schema";

const programKinds = new Set([
  "print",
  "declare",
  "get",
  "set",
  "string",
  "number",
  "boolean",
  "array",
  "object",
  "add",
  "subtract",
  "multiply",
  "divide",
  "modulo",
  "greater",
  "less",
  "atLeast",
  "atMost",
  "minimum",
  "maximum",
  "equal",
  "notEqual",
  "and",
  "or",
  "not",
  "concat",
  "toString",
  "toNumber",
  "branch",
  "for",
  "foreach",
  "sequence",
  "defineClass",
  "newInstance",
  "getField",
  "setField",
]);
const allowed = (adapter: LanguageAdapter) =>
  allNodes().filter((node) =>
    adapter.preview === "document"
      ? node.feature === "document" && node.id !== "pageImage"
      : programKinds.has(node.id) ||
        (adapter.id === "cpp" && node.feature === "memory"),
  );

function openOutput(graph: Graph, project: Project) {
  let node = graph.nodes.find(
    (node) => node.kind === "start" || node.kind === "function",
  );
  const visited = new Set<string>();
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    const next = graph.edges.find(
      ({ source, sourcePin }) => source === node?.id && sourcePin === "next",
    );
    if (
      !next &&
      pinsFor(node, project.graphs).outputs.some(({ id }) => id === "next")
    )
      return node;
    node = graph.nodes.find(({ id }) => id === next?.target);
  }
  throw new Error(
    "The main execution path has no open Next pin. Choose a graph with an open Next pin.",
  );
}

export function blueprintPrompt(
  prompt: string,
  adapter: LanguageAdapter,
  graph: Graph,
  project: Project,
) {
  openOutput(graph, project);
  const catalog = allowed(adapter).map((node) => {
    const pins = pinsFor(createNode(node.id, 0, 0), []);
    const describe = (pins: { id: string; type: string }[]) =>
      pins.map(({ id, type }) => `${id}:${type}`).join(",");
    return `${node.id} in[${describe(pins.inputs)}] out[${describe(pins.outputs)}] props[${describe(node.properties ?? [])}]`;
  });
  return [
    'Return JSON only with this shape: {"nodes":[{"id":"a","kind":"...","values":{}}],"edges":[{"source":"entry","sourcePin":"next","target":"a","targetPin":"in"}]}',
    "Use 1 to 16 nodes and wire each node. The reserved id entry is the existing execution source, with only its next output available. Do not include entry in nodes. Use exact pin IDs. Set input defaults and properties in values. Use primitive or JSON data, no source code. Use declarations by matching get/set name and type.",
    adapter.preview === "document"
      ? "Keep links as local #anchors. Place Page Title, CSS rules, and JavaScript Events on the main path. Set className to a name like card on an HTML node and target it with .card in a CSS rule. For interactivity, use matching element IDs (the anchor property) for sources and targets. Place JavaScript Actions on the event's Body path."
      : "End with a Print node when the request asks for output.",
    `Catalog:\n${catalog.join("\n")}`,
    `Student request:\n${prompt.trim().slice(0, 1000)}`,
  ].join("\n\n");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("AI returned an invalid Blueprint record.");
  return value as Record<string, unknown>;
}

export function insertBlueprintPlan(
  project: Project,
  graphId: string,
  adapter: LanguageAdapter,
  response: string,
) {
  const graph = project.graphs.find(({ id }) => id === graphId);
  if (!graph || response.length > 40_000)
    throw new Error("AI returned a plan that cannot be inserted here.");
  const entry = openOutput(graph, project);
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      response.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1"),
    );
  } catch {
    throw new Error(
      "AI returned an unreadable Blueprint plan. Try a more specific prompt.",
    );
  }
  const plan = record(parsed);
  if (
    !Array.isArray(plan.nodes) ||
    plan.nodes.length < 1 ||
    plan.nodes.length > 16 ||
    !Array.isArray(plan.edges) ||
    plan.edges.length > 48
  )
    throw new Error("AI returned a Blueprint plan outside the supported size.");
  const kinds = new Map(allowed(adapter).map((node) => [node.id, node]));
  const model = new Map([["entry", entry]]);
  const left = Math.min(
    94_000,
    Math.max(0, ...graph.nodes.map(({ x }) => x)) + 260,
  );
  const nodes = plan.nodes.map((item, index) => {
    const { id, kind, values = {} } = record(item);
    if (
      typeof id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,32}$/.test(id) ||
      model.has(id) ||
      typeof kind !== "string"
    )
      throw new Error("AI returned duplicate or invalid node identifiers.");
    const definition = kinds.get(kind);
    if (!definition)
      throw new Error("AI used a node outside the generation catalog.");
    const data = record(values);
    const node = createNode(
      kind,
      left + (index % 5) * 235,
      70 + Math.floor(index / 5) * 180,
      data as Graph["nodes"][number]["values"],
    );
    const inputs = [
      ...pinsFor(node, []).inputs,
      ...(definition.properties ?? []),
    ].filter(({ type }) => type !== "exec");
    if (Object.keys(data).some((key) => !inputs.some(({ id }) => id === key)))
      throw new Error("AI returned an unknown property for a generated node.");
    if (
      kind === "pageLink" &&
      typeof data.href === "string" &&
      !data.href.startsWith("#")
    )
      throw new Error("Generated links must use local page anchors.");
    model.set(id, node);
    return node;
  });
  let connectedEntry = false;
  const edges = plan.edges.map((item): Edge => {
    const { source, target, sourcePin, targetPin } = record(item);
    const from = typeof source === "string" && model.get(source);
    const to =
      typeof target === "string" && target !== "entry" && model.get(target);
    if (!from || !to)
      throw new Error("AI returned a wire outside the generated graph.");
    const output = pinsFor(from, project.graphs).outputs.find(
      ({ id }) => id === sourcePin,
    );
    const input = pinsFor(to, project.graphs).inputs.find(
      ({ id }) => id === targetPin,
    );
    if (
      !output ||
      !input ||
      !compatible(output.type, input.type) ||
      (source === "entry" && output.id !== "next")
    )
      throw new Error("AI returned an incompatible Blueprint wire.");
    if (source === "entry") connectedEntry = true;
    return {
      id: crypto.randomUUID(),
      source: from.id,
      target: to.id,
      sourcePin: output.id,
      targetPin: input.id,
      kind: output.type === "exec" ? "exec" : "data",
    };
  });
  if (!connectedEntry)
    throw new Error(
      "AI did not connect the generated nodes to the execution path.",
    );
  const generated = {
    ...graph,
    nodes: [...graph.nodes, ...nodes],
    edges: [...graph.edges, ...edges],
  };
  const next = parseProject({
    ...project,
    graphs: project.graphs.map((item) =>
      item.id === graphId ? generated : item,
    ),
  });
  const result = buildIR(next);
  const ids = new Set(nodes.map(({ id }) => id));
  const invalid = result.diagnostics.find(
    (item) =>
      item.severity === "error" ||
      (item.code === "UNUSED" && item.nodeId && ids.has(item.nodeId)),
  );
  if (!result.program || invalid)
    throw new Error(
      invalid?.message ??
        "AI returned a graph with errors. Try a simpler prompt.",
    );
  adapter.generate(result.program, { comments: project.comments });
  return { project: next, nodes };
}
