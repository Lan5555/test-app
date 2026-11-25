export type Value =
  | null
  | boolean
  | number
  | string
  | Value[]
  | { [key: string]: Value };
export type DataType =
  | "number"
  | "string"
  | "boolean"
  | "array"
  | "object"
  | "function"
  | "class"
  | "pointer"
  | "reference"
  | "null"
  | "undefined"
  | "any";
export type PinType = DataType | "exec";
export interface Pin {
  id: string;
  label?: string;
  type: PinType;
  fallback?: Value;
}
export interface Node {
  id: string;
  kind: string;
  x: number;
  y: number;
  values: Record<string, Value>;
  breakpoint?: boolean;
}
export interface Edge {
  id: string;
  source: string;
  sourcePin: string;
  target: string;
  targetPin: string;
  kind: "exec" | "data";
}
export interface Graph {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
}
export interface Project {
  version: 1;
  title: string;
  graphs: Graph[];
  comments: boolean;
  assignmentId?: string;
}
export interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  graphId?: string;
  nodeId?: string;
  pinId?: string;
  hint?: string;
}
export interface Location {
  graphId: string;
  nodeId: string;
}
export const typeOf = (value: Value | undefined): DataType => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as "number" | "string" | "boolean" | "object";
};
export const compatible = (source: PinType, target: PinType) =>
  source === target ||
  (target === "any" &&
    source !== "exec" &&
    source !== "class" &&
    source !== "pointer" &&
    source !== "reference");
export const pinColors: Record<PinType, string> = {
  exec: "#e2e8f0",
  number: "#5ee3a2",
  string: "#f298cf",
  boolean: "#fb8591",
  array: "#f8ad68",
  object: "#82adff",
  function: "#c2a2fa",
  class: "#ddbcff",
  pointer: "#b4a6ff",
  reference: "#a6deff",
  any: "#a2acc0",
  null: "#a2acc0",
  undefined: "#a2acc0",
};
export function createNode(
  kind: string,
  x: number,
  y: number,
  values: Node["values"] = {},
): Node {
  return { id: crypto.randomUUID(), kind, x, y, values };
}
export function createGraph(name = "Main", entry = "start"): Graph {
  return {
    id: crypto.randomUUID(),
    name,
    nodes: [createNode(entry, 60, 100)],
    edges: [],
  };
}
export const newProject = (title = "Untitled Blueprint"): Project => ({
  version: 1,
  title,
  graphs: [createGraph()],
  comments: false,
});
