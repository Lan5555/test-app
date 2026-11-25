import type { LanguageAdapter } from "./ir";
import type { Graph, Node } from "./model";
import {
  allNodes,
  functionNameOf,
  getNode,
  parametersOf,
  typeOfVariable,
  variableNameOf,
  variableReferenceId,
} from "./registry";

export interface NodeChoice {
  id: string;
  kind: string;
  label: string;
  category: string;
  description: string;
  values?: Node["values"];
  searchLabel?: string;
}

export function variableChoices(graph: Graph) {
  const declarations = graph.nodes.flatMap((node) => {
    if (node.kind !== "declare") return [];
    const name = variableNameOf(node);
    return name ? [{ node, name }] : [];
  });
  const counts = new Map<string, number>();
  for (const { name } of declarations)
    counts.set(name, (counts.get(name) ?? 0) + 1);
  const order = new Map<string, number>();
  return declarations.map(({ node, name }) => {
    const index = (order.get(name) ?? 0) + 1;
    order.set(name, index);
    return {
      node,
      label: counts.get(name) === 1 ? name : `${name} (declaration ${index})`,
    };
  });
}

export function referenceValues(declaration: Node): Node["values"] {
  return {
    declarationId: declaration.id,
    name: variableNameOf(declaration),
    type: typeOfVariable(declaration),
  };
}

export function nodeChoices(
  graph: Graph,
  graphs: Graph[],
  adapter?: LanguageAdapter,
): NodeChoice[] {
  const variables = variableChoices(graph).flatMap(({ node, label }) =>
    (["get", "set"] as const).map((kind) => ({
      id: `${kind}:${node.id}`,
      kind,
      label: `${kind === "get" ? "Get" : "Set"} ${label}`,
      category: "Variables",
      description: `${kind === "get" ? "Read" : "Update"} ${label} in this graph.`,
      values: referenceValues(node),
    })),
  );
  const aliases = adapter?.unsupportedFeatures?.includes("memory")
    ? []
    : variableChoices(graph).flatMap(({ node, label }) =>
        (["addressOf", "referenceTo"] as const).map((kind) => ({
          id: `${kind}:${node.id}`,
          kind,
          label: `${kind === "addressOf" ? "Address of" : "Reference to"} ${label}`,
          category: "Pointers & References",
          description: `Alias ${label} in this graph.`,
          values: referenceValues(node),
        })),
      );
  const functions = graphs.slice(1).flatMap((fn) =>
    fn.nodes.some((node) => node.kind === "function")
      ? [
          {
            id: `call:${fn.id}`,
            kind: "call",
            label: `Call ${fn.name}`,
            category: "Functions",
            description: `Call ${fn.name} and use its result.`,
            values: { functionName: fn.name },
          },
        ]
      : [],
  );
  const entry = graph.nodes.find((node) => node.kind === "function");
  const parameters = entry
    ? [...new Set(parametersOf(entry))].flatMap((name, index) =>
        (["parameter", "setParameter"] as const).map((kind) => ({
          id: `${kind}:${index}`,
          kind,
          label:
            kind === "parameter"
              ? `Parameter ${name}`
              : `Set Parameter ${name}`,
          category: "Functions",
          description:
            kind === "parameter"
              ? `Read the ${name} parameter.`
              : `Change ${name} for this function call.`,
          values: { name },
        })),
      )
    : [];
  const builtins = allNodes()
    .filter((node) => !node.role || node.role === "comment")
    .filter((node) => node.id !== "setParameter" || !!entry)
    .filter(
      (node) =>
        !adapter?.onlyFeatures ||
        node.role === "comment" ||
        (node.feature && adapter.onlyFeatures.includes(node.feature)),
    )
    .filter(
      (node) =>
        !node.feature || !adapter?.unsupportedFeatures?.includes(node.feature),
    )
    .map((node) => ({
      id: node.id,
      kind: node.id,
      label: node.label,
      category: node.category,
      description: node.description,
      searchLabel: node.label,
      ...adapter?.nodePresentation?.[node.id],
    }));
  return adapter?.onlyFeatures
    ? builtins
    : [...variables, ...aliases, ...functions, ...parameters, ...builtins];
}

export function nodeMatches(choice: NodeChoice, search: string) {
  return `${choice.label} ${choice.searchLabel ?? ""} ${choice.category}`
    .toLowerCase()
    .includes(search.trim().toLowerCase());
}

export function nodeTitle(
  node: Node,
  graphName?: string,
  adapter?: LanguageAdapter,
) {
  const name = variableNameOf(node);
  switch (node.kind) {
    case "declare":
      return name ? `Declare ${name}` : "Declare Variable";
    case "get":
      return name ? `Get ${name}` : "Get Variable";
    case "set":
      return name ? `Set ${name}` : "Set Variable";
    case "call":
      return `Call ${functionNameOf(node)}`;
    case "callMethod":
      return `Call Method ${functionNameOf(node)}`;
    case "defineClass":
      return `Class ${String(node.values.className ?? "Student")}`;
    case "addressOf":
      return `Address of ${name}`;
    case "referenceTo":
      return `Reference to ${name}`;
    case "parameter":
      return name ? `Parameter ${name}` : "Parameter";
    case "setParameter":
      return name ? `Set Parameter ${name}` : "Set Parameter";
    case "function":
      return graphName ?? "Function Entry";
    default:
      return (
        adapter?.nodePresentation?.[node.kind]?.label ??
        getNode(node.kind)?.label ??
        node.kind
      );
  }
}

export function reconcileVariableReferences(graph: Graph): Graph {
  const variables = new Map(
    graph.nodes
      .filter((node) => node.kind === "declare")
      .map((node) => [node.id, node]),
  );
  let changed = false;
  const nodes = graph.nodes.map((node) => {
    const id = variableReferenceId(node);
    const declaration = id && variables.get(id);
    if (!declaration) return node;
    const values = referenceValues(declaration);
    if (node.values.name === values.name && node.values.type === values.type)
      return node;
    changed = true;
    return { ...node, values: { ...node.values, ...values } };
  });
  return changed ? { ...graph, nodes } : graph;
}
