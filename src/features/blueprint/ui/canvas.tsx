"use client";

import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type EdgeChange,
  type Edge as FlowEdge,
  type Node as FlowNode,
  Handle,
  MiniMap,
  type NodeChange,
  type NodeProps,
  type OnConnectEnd,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { Flag } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type NodeChoice, nodeMatches, nodeTitle } from "../core/catalog";
import {
  addCommentGroup,
  commentFrame,
  commentGroupId,
  commentParents,
  makeCommentGroup,
  moveGraphNodes,
  withoutCommentGroup,
} from "../core/comments";
import type { LanguageAdapter } from "../core/ir";
import {
  compatible,
  type Edge,
  type Graph,
  type Location,
  type Node,
  type Pin,
  type Project,
  pinColors,
} from "../core/model";
import { getNode, pinsFor } from "../core/registry";
import "@xyflow/react/dist/style.css";

type Tile = FlowNode<
  {
    model: Node;
    title: string;
    inputs: Pin[];
    outputs: Pin[];
    active: boolean;
    failed: boolean;
  },
  "blueprint"
>;
export const nodeLabel = (id: string) =>
  id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
const pinTitle = ({ id, label, type }: Pin) =>
  `${label ?? nodeLabel(id)} (${type === "exec" ? "execution" : type})`;
const pinShape = (pins: Pin[]) =>
  pins.map(({ id, type, label }) => `${id}:${type}:${label ?? ""}`).join(",");

const TileView = memo(function TileView({
  id,
  data,
  selected,
}: NodeProps<Tile>) {
  const { model, title, inputs, outputs, active, failed } = data;
  const updateInternals = useUpdateNodeInternals();
  useEffect(() => {
    if (inputs.length || outputs.length) updateInternals(id);
  }, [id, inputs, outputs, updateInternals]);
  const definition = getNode(model.kind);
  if (!definition)
    return <div className="bp-tile bp-failed">Unknown node · {model.kind}</div>;
  if (definition.role === "comment") {
    const name =
      typeof model.values.text === "string" ? model.values.text.trim() : "";
    if (commentFrame(model)) {
      return (
        <div className="bp-comment-frame">
          <div className="bp-comment-heading">{name || "Comment"}</div>
        </div>
      );
    }
    return (
      <div className="bp-note">{String(model.values.text ?? "Add a note")}</div>
    );
  }
  const color = definition.role
    ? "#c283d5"
    : definition.action
      ? "#7aa7ff"
      : "#64ceaf";
  const row = (pin: Pin, incoming: boolean) => (
    <div
      className={`bp-pin ${incoming ? "bp-pin-in" : "bp-pin-out"}`}
      key={pin.id}
    >
      <Handle
        id={pin.id}
        type={incoming ? "target" : "source"}
        position={incoming ? Position.Left : Position.Right}
        title={pinTitle(pin)}
        aria-label={pinTitle(pin)}
        style={{ background: pinColors[pin.type], borderColor: "#191c2a" }}
      />
      <span className="bp-pin-label">{pin.label ?? nodeLabel(pin.id)}</span>
    </div>
  );
  return (
    <div
      className={`bp-tile ${selected ? "bp-selected" : ""} ${active ? "bp-active" : ""} ${failed ? "bp-failed" : ""}`}
    >
      <div className="bp-tile-head" style={{ borderInlineStartColor: color }}>
        <span className="bp-tile-title">{title}</span>
        {model.breakpoint && <Flag size={13} aria-label="Breakpoint set" />}
      </div>
      <div className="bp-pin-grid">
        <div>{inputs.map((pin) => row(pin, true))}</div>
        <div>{outputs.map((pin) => row(pin, false))}</div>
      </div>
      {["string", "number", "boolean"].includes(model.kind) && (
        <div className="bp-tile-value">
          {String(
            model.values.literal ?? definition.properties?.[0]?.fallback ?? "",
          ).slice(0, 60)}
        </div>
      )}
    </div>
  );
});
const nodeTypes = { blueprint: TileView };
const fitViewOptions = { padding: 0.22, maxZoom: 1 };
const panButtons = [1, 2];
const multiSelectionKeys = ["Control", "Meta", "Shift"];
const deleteKeys = ["Backspace", "Delete"];
const proOptions = { hideAttribution: true };

type Anchor = {
  node: string;
  pin: string;
  side: "source" | "target";
  type: Pin["type"];
};
type Menu = {
  left: number;
  top: number;
  position: { x: number; y: number };
  anchor?: Anchor;
};
interface Props {
  graph: Graph;
  graphs: Project["graphs"];
  choices: NodeChoice[];
  adapter?: LanguageAdapter;
  selectionRequest?: { ids: string[] };
  onSelectionApplied?(request: NonNullable<Props["selectionRequest"]>): void;
  onSelection(ids: string[]): void;
  onCommentCreated?(id: string): void;
  onGraph(update: (graph: Graph) => Graph): void;
  onAdd(
    choice: NodeChoice,
    position: { x: number; y: number },
    anchor?: Anchor,
  ): void;
  active?: Location;
  previous?: Location;
  failed?: Location;
  focus?: { id: string; nonce: number };
  editable: boolean;
}

function GraphCanvas({
  graph,
  graphs,
  choices,
  adapter,
  selectionRequest,
  onSelectionApplied,
  onSelection,
  onCommentCreated,
  onGraph,
  onAdd,
  active,
  previous,
  failed,
  focus,
  editable,
}: Props) {
  const {
    screenToFlowPosition,
    getNode: getFlowNode,
    getNodes: getFlowNodes,
    setCenter,
    viewportInitialized,
  } = useReactFlow<Tile>();
  const root = useRef<HTMLDivElement>(null);
  const rightGesture = useRef<{
    x: number;
    y: number;
    active: boolean;
    moved: boolean;
  } | null>(null);
  const [nodes, setNodes] = useState<Tile[]>([]);
  const [selectedEdges, setSelectedEdges] = useState<string[]>([]);
  const appliedSelection = useRef<Props["selectionRequest"]>(undefined);
  const appliedFocus = useRef<Props["focus"]>(undefined);
  const onNodesChange = useCallback((changes: NodeChange<Tile>[]) => {
    setNodes((nodes) => {
      const byId = new Map(nodes.map((node) => [node.id, node]));
      const effective = changes.filter((change) => {
        // onDelete updates the graph and detaches surviving members together.
        if (change.type === "remove") return false;
        if (change.type === "add" || change.type === "replace") return true;
        const node = byId.get(change.id);
        if (!node) return false;
        if (change.type === "dimensions") {
          return (
            (change.dimensions !== undefined &&
              (node.measured?.width !== change.dimensions.width ||
                node.measured?.height !== change.dimensions.height ||
                ((change.setAttributes === true ||
                  change.setAttributes === "width") &&
                  node.width !== change.dimensions.width) ||
                ((change.setAttributes === true ||
                  change.setAttributes === "height") &&
                  node.height !== change.dimensions.height))) ||
            (change.resizing !== undefined && node.resizing !== change.resizing)
          );
        }
        if (change.type === "select") return node.selected !== change.selected;
        if (change.type === "position") {
          return (
            (change.position !== undefined &&
              (node.position.x !== change.position.x ||
                node.position.y !== change.position.y)) ||
            (change.dragging !== undefined && node.dragging !== change.dragging)
          );
        }
        return true;
      });
      return effective.length ? applyNodeChanges(effective, nodes) : nodes;
    });
  }, []);
  const [menu, setMenu] = useState<Menu>();
  const [search, setSearch] = useState("");
  const parents = useMemo(() => commentParents(graph.nodes), [graph.nodes]);
  const modelNodes = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );
  const modelPins = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, pinsFor(node, graphs)])),
    [graph.nodes, graphs],
  );
  const activeId = active?.graphId === graph.id ? active.nodeId : undefined;
  const failedId = failed?.graphId === graph.id ? failed.nodeId : undefined;

  useEffect(() => {
    function groupSelection(event: KeyboardEvent) {
      if (
        !editable ||
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "c"
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          "input, textarea, select, [contenteditable], .bp-node-picker",
        )
      )
        return;
      const selection = getFlowNodes().flatMap((tile) =>
        tile.selected
          ? [
              {
                id: tile.id,
                width: tile.measured?.width || 170,
                height: tile.measured?.height || 100,
              },
            ]
          : [],
      );
      const group = makeCommentGroup(graph, selection);
      if (!group) return;
      event.preventDefault();
      onGraph((current) => addCommentGroup(current, group));
      onCommentCreated?.(group.node.id);
    }
    window.addEventListener("keydown", groupSelection);
    return () => window.removeEventListener("keydown", groupSelection);
  }, [editable, getFlowNodes, graph, onGraph, onCommentCreated]);

  useEffect(() => {
    let requested: Set<string> | undefined;
    if (selectionRequest && selectionRequest !== appliedSelection.current) {
      appliedSelection.current = selectionRequest;
      requested = new Set(selectionRequest.ids);
      setSelectedEdges((current) => (current.length ? [] : current));
    }
    setNodes((currently) => {
      const existing = new Map(currently.map((node) => [node.id, node]));
      // React Flow must receive groups before their members.
      const ordered = [
        ...graph.nodes.filter((node) => commentFrame(node)),
        ...graph.nodes.filter((node) => !commentFrame(node)),
      ];
      const next = ordered.map((node): Tile => {
        const old = existing.get(node.id);
        const parent = parents.get(node.id);
        const frame = commentFrame(node);
        const pins = modelPins.get(node.id) ?? { inputs: [], outputs: [] };
        const title = nodeTitle(node, graph.name, adapter);
        const position =
          old?.dragging && old.parentId === parent?.id
            ? old.position
            : { x: node.x - (parent?.x ?? 0), y: node.y - (parent?.y ?? 0) };
        const samePins =
          old &&
          pinShape(old.data.inputs) === pinShape(pins.inputs) &&
          pinShape(old.data.outputs) === pinShape(pins.outputs);
        const sameData =
          samePins &&
          old.data.model === node &&
          old.data.title === title &&
          old.data.active === (node.id === activeId) &&
          old.data.failed === (node.id === failedId);
        const isSelected = requested
          ? requested.has(node.id)
          : (old?.selected ?? false);
        if (
          sameData &&
          old.parentId === parent?.id &&
          old.selected === isSelected &&
          old.position.x === position.x &&
          old.position.y === position.y
        )
          return old;
        return {
          ...old,
          id: node.id,
          type: "blueprint",
          parentId: parent?.id,
          style: frame ? { ...frame, pointerEvents: "none" } : undefined,
          dragHandle: frame ? ".bp-comment-heading" : undefined,
          zIndex: frame ? -1001 : undefined,
          position,
          selected: isSelected,
          data: sameData
            ? old.data
            : {
                model: node,
                title,
                inputs: samePins ? old.data.inputs : pins.inputs,
                outputs: samePins ? old.data.outputs : pins.outputs,
                active: node.id === activeId,
                failed: node.id === failedId,
              },
        };
      });
      return next.length === currently.length &&
        next.every((node, index) => node === currently[index])
        ? currently
        : next;
    });
    if (requested && selectionRequest) onSelectionApplied?.(selectionRequest);
  }, [
    graph.nodes,
    graph.name,
    modelPins,
    parents,
    adapter,
    selectionRequest,
    onSelectionApplied,
    activeId,
    failedId,
  ]);

  useEffect(() => {
    if (!viewportInitialized || !focus || focus === appliedFocus.current)
      return;
    const stored = modelNodes.get(focus.id);
    if (!stored) return;
    appliedFocus.current = focus;
    const node = getFlowNode(focus.id);
    void setCenter(
      stored.x + (node?.measured?.width ?? 170) / 2,
      stored.y + (node?.measured?.height ?? 100) / 2,
      { zoom: 1, duration: 220 },
    );
  }, [focus, getFlowNode, setCenter, modelNodes, viewportInitialized]);

  const onEdgesChange = useCallback((changes: EdgeChange<FlowEdge>[]) => {
    const selection = changes.filter(
      (change) => change.type === "select" || change.type === "remove",
    );
    if (!selection.length) return;
    setSelectedEdges((current) => {
      const selected = new Set(current);
      for (const change of selection) {
        if (change.type === "select" && change.selected)
          selected.add(change.id);
        else selected.delete(change.id);
      }
      const next = [...selected];
      return next.length === current.length &&
        next.every((id, index) => id === current[index])
        ? current
        : next;
    });
  }, []);
  const reconnecting = useRef<string | undefined>(undefined);
  const edges: FlowEdge[] = useMemo(
    () =>
      graph.edges.map((edge) => {
        const type =
          modelPins
            .get(edge.source)
            ?.outputs.find((pin) => pin.id === edge.sourcePin)?.type ?? "any";
        const running =
          edge.kind === "exec" &&
          edge.target === activeId &&
          previous?.graphId === graph.id &&
          edge.source === previous.nodeId;
        const selected = selectedEdges.includes(edge.id);
        return {
          id: edge.id,
          source: edge.source,
          sourceHandle: edge.sourcePin,
          target: edge.target,
          targetHandle: edge.targetPin,
          selected,
          animated: running,
          style: {
            stroke: pinColors[type],
            strokeWidth: running || selected ? 4 : 2,
          },
          ariaLabel: `${edge.kind === "exec" ? "Execution" : "Data"} wire from ${edge.sourcePin} to ${edge.targetPin}`,
        };
      }),
    [graph.edges, graph.id, modelPins, activeId, previous, selectedEdges],
  );

  const makeEdge = useCallback(
    (connection: Connection, existing?: string): Edge | undefined => {
      if (
        !connection.sourceHandle ||
        !connection.targetHandle ||
        connection.source === connection.target
      )
        return;
      const source = modelPins
        .get(connection.source)
        ?.outputs.find((pin) => pin.id === connection.sourceHandle);
      const target = modelPins
        .get(connection.target)
        ?.inputs.find((pin) => pin.id === connection.targetHandle);
      if (!source || !target || !compatible(source.type, target.type)) return;
      const kind = source.type === "exec" ? "exec" : "data";
      if (
        graph.edges.some(
          (edge) =>
            edge.id !== existing &&
            ((edge.target === connection.target &&
              edge.targetPin === target.id) ||
              (kind === "exec" &&
                edge.source === connection.source &&
                edge.sourcePin === source.id)),
        )
      )
        return;
      return {
        id: existing ?? crypto.randomUUID(),
        source: connection.source,
        sourcePin: source.id,
        target: connection.target,
        targetPin: target.id,
        kind,
      };
    },
    [graph.edges, modelPins],
  );

  const openMenu = (x: number, y: number, anchor?: Anchor) => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds) return;
    setSearch("");
    setMenu({
      left: Math.max(6, Math.min(x - bounds.left, bounds.width - 205)),
      top: Math.max(6, Math.min(y - bounds.top, bounds.height - 208)),
      position: screenToFlowPosition({ x, y }),
      anchor,
    });
  };
  const connectEnd: OnConnectEnd = (event, state) => {
    if (
      state.isValid ||
      state.toHandle ||
      !state.fromNode ||
      !state.fromHandle?.id ||
      reconnecting.current
    )
      return;
    const side = state.fromHandle.type;
    const pins = modelPins.get(state.fromNode.id);
    const handle = state.fromHandle.id;
    const pin = (side === "source" ? pins?.outputs : pins?.inputs)?.find(
      (candidate) => candidate.id === handle,
    );
    if (!pin) return;
    if (
      graph.edges.some((edge) =>
        side === "target"
          ? edge.target === state.fromNode?.id && edge.targetPin === pin.id
          : pin.type === "exec" &&
            edge.source === state.fromNode?.id &&
            edge.sourcePin === pin.id,
      )
    )
      return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    if (point)
      openMenu(point.clientX, point.clientY, {
        node: state.fromNode.id,
        pin: pin.id,
        side,
        type: pin.type,
      });
  };
  const menuNodes = menu
    ? choices.filter((choice) => {
        if (!nodeMatches(choice, search)) return false;
        if (!menu.anchor) return true;
        const pins = pinsFor(
          {
            id: "",
            x: 0,
            y: 0,
            kind: choice.kind,
            values: choice.values ?? {},
          },
          graphs,
        );
        const { side, type } = menu.anchor;
        return side === "source"
          ? pins.inputs.some((pin) => compatible(type, pin.type))
          : pins.outputs.some((pin) => compatible(pin.type, type));
      })
    : [];
  const selectionChanged = useCallback(
    ({ nodes: selected }: { nodes: Tile[] }) => {
      onSelection(selected.map(({ id }) => id));
    },
    [onSelection],
  );
  return (
    <div
      className="bp-canvas"
      ref={root}
      onPointerDownCapture={(event) => {
        rightGesture.current = null;
        if (
          event.button !== 2 ||
          !(event.target instanceof Element) ||
          event.target.closest(".bp-node-picker, input, textarea")
        )
          return;
        rightGesture.current = {
          x: event.clientX,
          y: event.clientY,
          active: true,
          moved: false,
        };
        setMenu(undefined);
      }}
      onPointerMoveCapture={(event) => {
        const gesture = rightGesture.current;
        if (
          gesture?.active &&
          Math.hypot(gesture.x - event.clientX, gesture.y - event.clientY) >= 6
        )
          gesture.moved = true;
      }}
      onPointerUpCapture={(event) => {
        const gesture = rightGesture.current;
        if (event.button !== 2 || !gesture?.active) return;
        gesture.active = false;
        gesture.moved ||=
          Math.hypot(gesture.x - event.clientX, gesture.y - event.clientY) >= 6;
        if (editable && !gesture.moved) openMenu(event.clientX, event.clientY);
      }}
      onPointerCancelCapture={() => {
        rightGesture.current = null;
      }}
      onContextMenuCapture={(event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest("input, textarea, [contenteditable='true']"))
          return;
        event.preventDefault();
        if (!editable || event.target.closest(".bp-node-picker")) return;
        // Windows can fire contextmenu before pointerup, while the gesture is still undecided.
        if (event.button === 2 && rightGesture.current) {
          if (!rightGesture.current.active) rightGesture.current = null;
          return;
        }
        if (event.clientX || event.clientY) {
          openMenu(event.clientX, event.clientY);
        } else {
          const bounds = event.target.getBoundingClientRect();
          openMenu(
            bounds.left + bounds.width / 2,
            bounds.top + bounds.height / 2,
          );
        }
      }}
    >
      <ReactFlow<Tile, FlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={selectionChanged}
        onConnectEnd={connectEnd}
        isValidConnection={(wire) =>
          !!makeEdge(wire as Connection, reconnecting.current)
        }
        onConnect={(connection) => {
          const edge = makeEdge(connection);
          if (edge)
            onGraph((current) => ({
              ...current,
              edges: [...current.edges, edge],
            }));
        }}
        onReconnectStart={(_, edge) => {
          reconnecting.current = edge.id;
        }}
        onReconnectEnd={() => {
          reconnecting.current = undefined;
        }}
        onReconnect={(previous, connection) => {
          const edge = makeEdge(connection, previous.id);
          if (edge)
            onGraph((current) => ({
              ...current,
              edges: current.edges.map((wire) =>
                wire.id === edge.id ? edge : wire,
              ),
            }));
        }}
        onBeforeDelete={({ nodes: candidates, edges: wires }) => {
          // Removing a comment dissolves the group. Only explicitly selected members are deleted.
          const deleting = candidates.filter(
            (node) => !node.parentId || node.selected,
          );
          const ids = new Set(deleting.map(({ id }) => id));
          return Promise.resolve({
            nodes: deleting,
            edges: wires.filter(
              (edge) =>
                edge.selected || ids.has(edge.source) || ids.has(edge.target),
            ),
          });
        }}
        onDelete={({ nodes: deleted, edges: wires }) => {
          const ids = new Set(deleted.map(({ id }) => id));
          const wireIds = new Set(wires.map(({ id }) => id));
          if (ids.size || wireIds.size)
            onGraph((current) => ({
              ...current,
              nodes: current.nodes
                .filter(({ id }) => !ids.has(id))
                .map((node) => {
                  const parent = commentGroupId(node);
                  return parent && ids.has(parent)
                    ? withoutCommentGroup(node)
                    : node;
                }),
              edges: current.edges.filter(
                (edge) =>
                  !ids.has(edge.source) &&
                  !ids.has(edge.target) &&
                  !wireIds.has(edge.id),
              ),
            }));
        }}
        onNodeDragStop={(_, node, selected) => {
          const moved = new Map(
            [node, ...selected].map((tile) => [tile.id, tile.position]),
          );
          onGraph((current) => moveGraphNodes(current, moved));
        }}
        onPaneClick={() => setMenu(undefined)}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(event) => {
          event.preventDefault();
          const id = event.dataTransfer.getData("application/blueprint-node");
          const choice = choices.find((item) => item.id === id);
          if (choice)
            onAdd(
              choice,
              screenToFlowPosition({ x: event.clientX, y: event.clientY }),
            );
        }}
        fitView
        fitViewOptions={fitViewOptions}
        colorMode="dark"
        minZoom={0.15}
        maxZoom={2.5}
        selectionOnDrag
        panOnDrag={panButtons}
        multiSelectionKeyCode={multiSelectionKeys}
        nodesDraggable={editable}
        nodesConnectable={editable}
        edgesReconnectable={editable}
        deleteKeyCode={editable ? deleteKeys : null}
        proOptions={proOptions}
      >
        <Background
          color="#41465c"
          variant={BackgroundVariant.Dots}
          gap={21}
          size={1}
        />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor="#646891"
          maskColor="#161726aa"
        />
      </ReactFlow>
      {menu && (
        <section
          className="bp-node-picker"
          aria-label="Add node"
          style={{ left: menu.left, top: menu.top }}
        >
          <div>
            <input
              ref={(element) => element?.focus()}
              placeholder="Find a node"
              aria-label="Find a node"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              aria-label="Close node picker"
              onClick={() => setMenu(undefined)}
            >
              ×
            </button>
          </div>
          <ul>
            {menuNodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAdd(node, menu.position, menu.anchor);
                    setMenu(undefined);
                  }}
                >
                  {node.label}
                </button>
              </li>
            ))}
          </ul>
          {!menuNodes.length && <p>No matching nodes</p>}
        </section>
      )}
    </div>
  );
}

export default function Canvas(props: Props) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
