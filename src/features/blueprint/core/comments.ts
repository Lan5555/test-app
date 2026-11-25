import { createNode, type Graph, type Node } from "./model";

type Point = { x: number; y: number };
interface NodeBounds {
  id: string;
  width: number;
  height: number;
}
export interface CommentGroup {
  node: Node;
  members: string[];
}

export function commentFrame(node: Node) {
  const { width, height } = node.values;
  if (
    node.kind !== "comment" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !(width > 0 && width <= 201_000 && height > 0 && height <= 201_000)
  )
    return undefined;
  return { width, height };
}

export const commentGroupId = (node: Node) =>
  node.kind !== "comment" && typeof node.values.commentGroup === "string"
    ? node.values.commentGroup
    : undefined;

export function commentParents(nodes: Node[]) {
  const frames = new Map(
    nodes.filter((node) => commentFrame(node)).map((node) => [node.id, node]),
  );
  const members = new Map<string, Node>();
  for (const node of nodes) {
    const id = commentGroupId(node);
    const frame = id && frames.get(id);
    if (frame) members.set(node.id, frame);
  }
  return members;
}

export function makeCommentGroup(
  graph: Graph,
  selection: NodeBounds[],
): CommentGroup | undefined {
  const measured = new Map(selection.map((node) => [node.id, node]));
  const included = graph.nodes.filter(
    (node) => node.kind !== "comment" && measured.has(node.id),
  );
  if (!included.length) return undefined;

  const padding = 28;
  const left = Math.min(...included.map(({ x }) => x)) - padding;
  const top = Math.min(...included.map(({ y }) => y)) - padding - 26;
  const right =
    Math.max(
      ...included.map(({ id, x }) => x + (measured.get(id)?.width ?? 170)),
    ) + padding;
  const bottom =
    Math.max(
      ...included.map(({ id, y }) => y + (measured.get(id)?.height ?? 100)),
    ) + padding;
  return {
    node: createNode(
      "comment",
      Math.max(left, -100_000),
      Math.max(top, -100_000),
      {
        text: "Comment",
        width: right - Math.max(left, -100_000),
        height: bottom - Math.max(top, -100_000),
      },
    ),
    members: included.map(({ id }) => id),
  };
}

export function withoutCommentGroup(node: Node): Node {
  if (!commentGroupId(node)) return node;
  const values = { ...node.values };
  delete values.commentGroup;
  return { ...node, values };
}

export function addCommentGroup(graph: Graph, group: CommentGroup): Graph {
  const assigned = new Set(group.members);
  const nodes = graph.nodes.map((node) =>
    assigned.has(node.id)
      ? { ...node, values: { ...node.values, commentGroup: group.node.id } }
      : node,
  );
  return { ...graph, nodes: [...nodes, group.node] };
}

export function moveGraphNodes(
  graph: Graph,
  positions: ReadonlyMap<string, Point>,
): Graph {
  const parents = commentParents(graph.nodes);
  const nodes = graph.nodes.map((node) => {
    const moved = positions.get(node.id);
    const parent = parents.get(node.id);
    const movedParent = parent && positions.get(parent.id);
    let point = moved;
    if (parent && moved) {
      const origin = movedParent ?? parent;
      point = { x: moved.x + origin.x, y: moved.y + origin.y };
    } else if (parent && movedParent) {
      point = {
        x: node.x + movedParent.x - parent.x,
        y: node.y + movedParent.y - parent.y,
      };
    }
    return point && (point.x !== node.x || point.y !== node.y)
      ? { ...node, ...point }
      : node;
  });
  return nodes.every((node, index) => node === graph.nodes[index])
    ? graph
    : { ...graph, nodes };
}
