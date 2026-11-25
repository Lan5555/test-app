"use client";

import {
  ArrowLeft,
  Bug,
  ChevronLeft,
  ChevronRight,
  Code2,
  Download,
  FilePlus2,
  GitBranch,
  LoaderCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  Redo2,
  Save,
  Settings2,
  Square,
  Undo2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { blueprintName, blueprintPath } from "../config";
import {
  type NodeChoice,
  nodeChoices,
  nodeMatches,
  nodeTitle,
  reconcileVariableReferences,
} from "../core/catalog";
import { commentGroupId, withoutCommentGroup } from "../core/comments";
import { buildIR } from "../core/compiler";
import { generateSource, languages, projectLanguage } from "../core/languages";
import {
  compatible,
  createGraph,
  createNode,
  type Diagnostic,
  type Edge,
  type Graph,
  type Location,
  newProject,
  type Pin,
  type Project,
  type Value,
} from "../core/model";
import {
  endpointMethod,
  endpointPath,
  pinsFor,
  propertyValue,
  variableReferenceId,
} from "../core/registry";
import type { Control, RuntimeEvent, Status, Trace } from "../core/runtime";
import type { WorkerReply, WorkerRequest } from "../core/runtime-messages";
import { assignments, checkAssignment } from "../education";
import {
  download,
  projectStore,
  runConnectedHttp,
  type SavedProject,
} from "../persistence";
import { AiConnection, useBlueprintAi } from "./ai-session";
import Canvas, { nodeLabel } from "./canvas";
import { GraphGenerator } from "./graph-generator";
import Inspector from "./inspector";
import { LoadingMessage } from "./loading";
import { useProject } from "./use-project";

const SourceView = dynamic(() => import("./source"), {
  ssr: false,
  loading: () => <LoadingMessage>Opening the source editor…</LoadingMessage>,
});
const sections = ["Console", "Diagnostics", "Variables", "History"] as const;
type Mode = "graph" | "split" | "code";
type Anchor = {
  node: string;
  pin: string;
  side: "source" | "target";
  type: Pin["type"];
};
type Run = {
  status: Status | "idle";
  output: string[];
  history: Trace[];
  executed: Set<string>;
  pausedVariables?: Trace["variables"];
  active?: Location;
  previous?: Location;
  failed?: Location;
  error?: string;
};
const emptyRun = (): Run => ({
  status: "idle",
  output: [],
  history: [],
  executed: new Set(),
});

function mergeEvents(previous: Run, events: RuntimeEvent[]): Run {
  const result = {
    ...previous,
    output: [...previous.output],
    history: [...previous.history],
    executed: new Set(previous.executed),
  };
  for (const event of events) {
    if (event.kind === "output") result.output.push(event.value);
    else if (event.kind === "response") {
      result.output.push(`HTTP ${event.status}`);
      if (event.body !== null)
        result.output.push(JSON.stringify(event.body, null, 2));
    } else if (event.kind === "trace") {
      result.previous = result.active;
      result.active = event.trace.at;
      result.history.push(event.trace);
      result.executed.add(`${event.trace.at.graphId}:${event.trace.at.nodeId}`);
    } else {
      result.status = event.status;
      result.pausedVariables = event.variables;
      if (event.status === "paused") {
        result.previous = result.active;
        result.active = event.at;
      }
      if (event.status === "error") {
        result.error = event.message;
        result.failed = event.at;
      }
    }
  }
  result.history = result.history.slice(-200);
  return result;
}

export default function Editor({
  saved,
  accountId,
}: {
  saved: SavedProject;
  accountId: number;
}) {
  const draft = useProject(saved, accountId);
  const ai = useBlueprintAi();
  const { project } = draft;
  const router = useRouter();
  const assignment = assignments.find(
    (task) => task.id === project.assignmentId,
  );
  const root = useRef<HTMLElement>(null);
  const worker = useRef<Worker | undefined>(undefined);
  const runAbort = useRef<AbortController | undefined>(undefined);
  const clipboard = useRef<Pick<Graph, "nodes" | "edges"> | undefined>(
    undefined,
  );
  const [graphId, setGraphId] = useState(project.graphs[0].id);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectionRequest, setSelectionRequest] = useState<{
    graphId: string;
    ids: string[];
  }>();
  const [focus, setFocus] = useState<{ id: string; nonce: number }>();
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [language, setLanguage] = useState(() => projectLanguage(project));
  const [mode, setMode] = useState<Mode>(() =>
    language === "html" ? "split" : "graph",
  );
  const [pagePreview, setPagePreview] = useState(true);
  const [searchNodes, setSearchNodes] = useState("");
  const [panel, setPanel] = useState<(typeof sections)[number]>("Console");
  const [run, setRun] = useState<Run>(emptyRun);
  const [speed, setSpeed] = useState(0);
  const [left, setLeft] = useState(true);
  const [right, setRight] = useState(true);
  const [commentToName, setCommentToName] = useState<string>();
  const [bottom, setBottom] = useState(true);
  const [outputHeight, setOutputHeight] = useState(200);
  const [settings, setSettings] = useState(false);
  const [testingEndpoint, setTestingEndpoint] = useState(false);
  const [requestBody, setRequestBody] = useState("{}");
  const [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState("");
  const [creating, setCreating] = useState(false);
  const [opening, startOpening] = useTransition();
  const pending = useRef<{ id: string; project: Project } | undefined>(
    undefined,
  );
  const editable =
    run.status !== "running" && run.status !== "paused" && !draft.conflict;
  const graph =
    project.graphs.find(({ id }) => id === graphId) ?? project.graphs[0];
  const endpoint = graph.nodes.find((node) => node.kind === "endpoint");
  const node = graph.nodes.find(({ id }) => id === selected.at(-1));
  const adapter = languages.get(language);
  const sourceLanguage = adapter.sourceLanguage ?? adapter.id;
  const sourceLabel = languages.get(sourceLanguage).label;
  const isDocument = adapter.preview === "document";
  const sourceVisible = mode !== "graph";
  const graphCompilation = useMemo(
    () => (sourceVisible ? buildIR(project) : undefined),
    [project, sourceVisible],
  );
  const preview = useMemo(
    () =>
      graphCompilation &&
      generateSource(graphCompilation, adapter, project.comments, true),
    [graphCompilation, adapter, project.comments],
  );
  const previewSource = preview?.source;
  const previewError = preview?.diagnostics.find(
    ({ severity }) => severity === "error",
  );
  const taskPassed =
    assignment &&
    run.status === "complete" &&
    checkAssignment(
      assignment.id,
      run.output,
      new Set(
        project.graphs.flatMap((item) =>
          item.nodes
            .filter((n) => run.executed.has(`${item.id}:${n.id}`))
            .map((n) => n.kind),
        ),
      ),
    );
  const choices = useMemo(
    () => nodeChoices(graph, project.graphs, adapter),
    [graph, project.graphs, adapter],
  );
  const shown = choices.filter((item) => nodeMatches(item, searchNodes));
  const categories = [...new Set(shown.map((node) => node.category))];

  const endWorker = useCallback(() => {
    runAbort.current?.abort();
    worker.current?.terminate();
    worker.current = undefined;
    runAbort.current = undefined;
  }, []);
  useEffect(() => endWorker, [endWorker]);
  useEffect(() => {
    const sync = () =>
      setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  function selectGraph(id: string) {
    setGraphId(id);
    setTestingEndpoint(false);
    setSelected([]);
    setSelectionRequest({ graphId: id, ids: [] });
    setFocus(undefined);
  }
  const selectNodes = useCallback(
    (ids: string[]) =>
      setSelected((current) =>
        ids.length === current.length &&
        ids.every((id, index) => id === current[index])
          ? current
          : ids,
      ),
    [],
  );
  const acknowledgeSelection = useCallback((request: { ids: string[] }) => {
    setSelectionRequest((current) =>
      current === request ? undefined : current,
    );
  }, []);
  const commentNameFocused = useCallback(() => setCommentToName(undefined), []);
  function locate(at: Location) {
    setGraphId(at.graphId);
    setSelectionRequest({ graphId: at.graphId, ids: [at.nodeId] });
    setFocus({ id: at.nodeId, nonce: performance.now() });
  }
  function change(update: (previous: Project) => Project) {
    if (!editable) return;
    setNotice("");
    setRun(emptyRun());
    setDiagnostics([]);
    draft.change(update);
  }
  function changeGraph(update: (previous: Graph) => Graph) {
    change((previous) => ({
      ...previous,
      graphs: previous.graphs.map((item) =>
        item.id === graph.id ? reconcileVariableReferences(update(item)) : item,
      ),
    }));
  }
  function addNode(
    choice: NodeChoice,
    position?: { x: number; y: number },
    anchor?: Anchor,
  ) {
    if (!editable) return;
    const last = graph.nodes.at(-1);
    const created = createNode(
      choice.kind,
      position?.x ?? (last?.x ?? 0) + 205,
      position?.y ?? last?.y ?? 100,
      choice.values,
    );
    changeGraph((previous) => {
      const pins = pinsFor(created, project.graphs);
      const connect =
        anchor &&
        (anchor.side === "source"
          ? pins.inputs.find((pin) => compatible(anchor.type, pin.type))
          : pins.outputs.find((pin) => compatible(pin.type, anchor.type)));
      const edge: Edge[] =
        anchor && connect
          ? [
              {
                id: crypto.randomUUID(),
                source: anchor.side === "source" ? anchor.node : created.id,
                sourcePin: anchor.side === "source" ? anchor.pin : connect.id,
                target: anchor.side === "target" ? anchor.node : created.id,
                targetPin: anchor.side === "target" ? anchor.pin : connect.id,
                kind: connect.type === "exec" ? "exec" : "data",
              },
            ]
          : [];
      return {
        ...previous,
        nodes: [...previous.nodes, created],
        edges: [...previous.edges, ...edge],
      };
    });
    locate({ graphId: graph.id, nodeId: created.id });
  }
  function copy() {
    const selection = new Set(selected);
    const nodes = graph.nodes.filter((item) => {
      const parent = commentGroupId(item);
      return (
        (selection.has(item.id) || (parent && selection.has(parent))) &&
        !["start", "function"].includes(item.kind)
      );
    });
    if (!nodes.length) return;
    const ids = new Set(nodes.map(({ id }) => id));
    clipboard.current = {
      nodes,
      edges: graph.edges.filter(
        ({ source, target }) => ids.has(source) && ids.has(target),
      ),
    };
    setNotice(
      `Copied ${nodes.length} ${nodes.length === 1 ? "node" : "nodes"}.`,
    );
  }
  function paste() {
    if (!editable || !clipboard.current) return;
    const ids = new Map(
      clipboard.current.nodes.map(({ id }) => [id, crypto.randomUUID()]),
    );
    const nodes = clipboard.current.nodes.map((item) => {
      const reference = variableReferenceId(item);
      const declarationId = reference && ids.get(reference);
      const parent = commentGroupId(item);
      const group = parent && ids.get(parent);
      const values = group
        ? { ...item.values, commentGroup: group }
        : withoutCommentGroup(item).values;
      return {
        ...item,
        id: ids.get(item.id)!,
        x: item.x + 35,
        y: item.y + 35,
        values: declarationId ? { ...values, declarationId } : values,
      };
    });
    const edges = clipboard.current.edges.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      source: ids.get(item.source)!,
      target: ids.get(item.target)!,
    }));
    changeGraph((item) => ({
      ...item,
      nodes: [...item.nodes, ...nodes],
      edges: [...item.edges, ...edges],
    }));
    setSelectionRequest({ graphId: graph.id, ids: nodes.map(({ id }) => id) });
  }
  function undo(redo = false) {
    if (!editable) return;
    setRun(emptyRun());
    setDiagnostics([]);
    if (redo) draft.redo();
    else draft.undo();
  }
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const element = event.target as HTMLElement | null;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void draft.save();
      }
      if (element?.closest("input, textarea, select, [contenteditable]"))
        return;
      if (key === "z" || key === "y") {
        event.preventDefault();
        undo(event.shiftKey || key === "y");
      }
      if (key === "c" && selected.length) {
        event.preventDefault();
        copy();
      }
      if (key === "v" && clipboard.current) {
        event.preventDefault();
        paste();
      }
      if (key === "d" && selected.length) {
        event.preventDefault();
        copy();
        paste();
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });

  function compile() {
    const result = generateSource(
      graphCompilation ?? buildIR(project),
      adapter,
      project.comments,
    );
    setDiagnostics(result.diagnostics);
    if (!result.source) {
      setBottom(true);
      setPanel("Diagnostics");
      setNotice("");
      return;
    }
    setNotice(`Generated ${sourceLabel}.`);
    return result.source;
  }
  function execute(
    debug: boolean,
    preview?: { graphId: string; body: Value | null },
  ) {
    const result = graphCompilation ?? buildIR(project);
    setDiagnostics(result.diagnostics);
    setNotice("");
    if (!result.program) {
      setBottom(true);
      setPanel("Diagnostics");
      return;
    }
    endWorker();
    setPanel("Console");
    setBottom(true);
    setRun({ ...emptyRun(), status: "running" });
    try {
      const runtime = new Worker(
        new URL("../core/runtime.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = runtime;
      const controller = new AbortController();
      runAbort.current = controller;
      runtime.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
        if (worker.current !== runtime) return;
        if (!Array.isArray(data)) {
          const request = data.request;
          const response =
            request.kind === "ai"
              ? ai
                  .run(request.task, request.input, controller.signal)
                  .then((result) => result.output)
              : runConnectedHttp(request, controller.signal);
          void response.then(
            (value) => {
              if (!controller.signal.aborted)
                runtime.postMessage({
                  kind: "host-result",
                  id: data.id,
                  ok: true,
                  value,
                } satisfies WorkerRequest);
            },
            (error: unknown) => {
              if (!controller.signal.aborted)
                runtime.postMessage({
                  kind: "host-result",
                  id: data.id,
                  ok: false,
                  message:
                    error instanceof Error
                      ? error.message
                      : "The connected service failed.",
                } satisfies WorkerRequest);
            },
          );
          return;
        }
        setRun((previous) => mergeEvents(previous, data));
        if (
          data.some(
            (entry) =>
              entry.kind === "status" &&
              ["complete", "error", "stopped"].includes(entry.status),
          )
        ) {
          endWorker();
        }
      };
      runtime.onerror = () => {
        if (worker.current !== runtime) return;
        endWorker();
        setRun((previous) => ({
          ...previous,
          status: "error",
          error: "The Blueprint worker could not run.",
        }));
      };
      runtime.postMessage({
        kind: "run",
        program: result.program,
        debug,
        speed,
        preview,
      } satisfies WorkerRequest);
    } catch {
      setRun({
        ...emptyRun(),
        status: "error",
        error: "This browser could not open the Blueprint worker.",
      });
    }
  }
  function control(command: Control) {
    if (command === "stop") {
      endWorker();
      setRun((previous) => ({
        ...previous,
        status: "stopped",
        active: undefined,
      }));
    } else worker.current?.postMessage({ kind: "control", command });
  }
  async function create(project?: Project, recovered = false) {
    if (creating || opening) return;
    const request = project
      ? { id: crypto.randomUUID(), project }
      : pending.current;
    if (!request) return;
    setCreating(true);
    pending.current = request;
    try {
      const created = await projectStore.create(request.id, request.project);
      pending.current = undefined;
      if (recovered) draft.discardConflict();
      startOpening(() => router.push(`${blueprintPath}/editor/${created.id}`));
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  function createSubgraph(kind: "function" | "endpoint") {
    const label = kind === "endpoint" ? "Endpoint" : "Function";
    let number = project.graphs.length;
    while (project.graphs.some(({ name }) => name === `${label} ${number}`))
      number++;
    const next = createGraph(`${label} ${number}`, kind);
    if (kind === "endpoint") {
      const entry = next.nodes[0];
      entry.values.path = `/endpoint-${number}`;
      const response = createNode("httpResponse", 300, 100, {
        body: { message: "Hello from Blueprint Studio" },
      });
      next.nodes.push(response);
      next.edges.push({
        id: crypto.randomUUID(),
        source: entry.id,
        sourcePin: "next",
        target: response.id,
        targetPin: "in",
        kind: "exec",
      });
    }
    change((previous) => ({ ...previous, graphs: [...previous.graphs, next] }));
    selectGraph(next.id);
    if (kind === "endpoint")
      setSelectionRequest({ graphId: next.id, ids: [next.nodes[0].id] });
  }
  function renameGraph(name: string) {
    name = name.trim();
    if (!name || name === graph.name) return;
    if (project.graphs.some((item) => item.name === name)) {
      setNotice("This graph name already exists.");
      return;
    }
    change((previous) => ({
      ...previous,
      graphs: previous.graphs.map((item) => ({
        ...item,
        name: item.id === graph.id ? name : item.name,
        nodes: item.nodes.map((node) =>
          !endpoint &&
          (node.kind === "call" || node.kind === "callMethod") &&
          node.values.functionName === graph.name
            ? { ...node, values: { ...node.values, functionName: name } }
            : node,
        ),
      })),
    }));
  }
  function removeGraph() {
    if (!window.confirm(`Delete ${graph.name}?`)) return;
    change((previous) => ({
      ...previous,
      graphs: previous.graphs.filter((item) => item.id !== graph.id),
    }));
    selectGraph(project.graphs[0].id);
  }
  function showCode(next: Mode) {
    if (mode === "code" && next !== "code")
      setSelectionRequest({ graphId: graph.id, ids: selected });
    setMode(next);
  }
  function exportCode() {
    const generated = compile();
    if (generated)
      download(
        `${project.title}${generated.extension}`,
        generated.code,
        sourceLanguage === "javascript"
          ? "text/javascript"
          : isDocument
            ? "text/html;charset=utf-8"
            : "text/plain;charset=utf-8",
      );
  }
  function sendPreview(debug: boolean) {
    if (!endpoint || !editable) return;
    let body: Value | null = null;
    if (
      propertyValue(endpoint, endpointMethod) !== "GET" &&
      requestBody.trim()
    ) {
      try {
        if (new TextEncoder().encode(requestBody).length > 8192)
          throw new Error();
        body = JSON.parse(requestBody) as Value;
      } catch {
        setNotice("Enter valid JSON for the request body, up to 8 KB.");
        return;
      }
    }
    execute(debug, { graphId: graph.id, body });
  }
  const trace = run.history.at(-1);
  const variables = run.pausedVariables ?? trace?.variables;
  const nodeName = (at: Location) => {
    const sourceGraph = project.graphs.find((graph) => graph.id === at.graphId);
    const model = sourceGraph?.nodes.find((node) => node.id === at.nodeId);
    return model ? nodeTitle(model, sourceGraph?.name, adapter) : "Node";
  };

  return (
    <main className="bp-studio bp-editor" ref={root}>
      <header className="bp-editor-title">
        <Link href={blueprintPath} aria-label={`Back to ${blueprintName}`}>
          <ArrowLeft size={17} />
          <GitBranch size={17} /> <span>{blueprintName}</span>
        </Link>
        <label className="bp-project-title">
          <span className="bp-sr">Project title</span>
          <input
            key={project.title}
            defaultValue={project.title}
            disabled={!editable}
            maxLength={100}
            onBlur={(event) => {
              const title = event.currentTarget.value.trim();
              if (title && title !== project.title)
                change((previous) => ({ ...previous, title }));
              else event.currentTarget.value = project.title;
            }}
          />
        </label>
        <output className="bp-save-status">{draft.status}</output>
        <div className="bp-actions">
          <button
            type="button"
            onClick={() => setSettings(!settings)}
            aria-expanded={settings}
            aria-label="Editor settings"
          >
            <Settings2 size={16} />
          </button>
          <button
            type="button"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            onClick={() => {
              const action = fullscreen
                ? document.exitFullscreen()
                : root.current?.requestFullscreen();
              void action?.catch(() =>
                setNotice("Fullscreen is unavailable in this browser."),
              );
            }}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </header>
      <fieldset className="bp-toolbar" aria-label="Editor actions">
        <div className="bp-toolbar-actions">
          <button
            type="button"
            disabled={creating || opening || !editable}
            onClick={() => void create(newProject())}
          >
            <FilePlus2 size={15} /> New
          </button>
          <Link className="bp-button" href={`${blueprintPath}/projects`}>
            Open
          </Link>
          <button
            type="button"
            disabled={draft.saving || !!draft.conflict}
            onClick={() => void draft.save()}
          >
            {draft.saving ? (
              <>
                <LoaderCircle
                  className="bp-loading-icon"
                  size={15}
                  aria-hidden="true"
                />{" "}
                Saving…
              </>
            ) : (
              <>
                <Save size={15} /> Save
              </>
            )}
          </button>
          <span className="bp-rule" />
          <button
            type="button"
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            disabled={!draft.canUndo || !editable}
            onClick={() => undo()}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            aria-label="Redo"
            title="Redo (Ctrl+Shift+Z)"
            disabled={!draft.canRedo || !editable}
            onClick={() => undo(true)}
          >
            <Redo2 size={16} />
          </button>
          <span className="bp-rule" />
          <button type="button" onClick={() => compile()}>
            <Code2 size={15} /> Compile
          </button>
          <button
            className="bp-primary"
            type="button"
            disabled={!editable}
            onClick={() => {
              if (isDocument) {
                setPagePreview(true);
                if (mode === "graph") showCode("split");
              } else execute(false);
            }}
          >
            <Play size={15} /> {isDocument ? "Preview Page" : "Run"}
          </button>
          <button
            type="button"
            disabled={!editable || isDocument}
            onClick={() => execute(true)}
          >
            <Bug size={15} /> Debug
          </button>
          <button
            type="button"
            disabled={run.status !== "running" && run.status !== "paused"}
            onClick={() => control("stop")}
          >
            <Square size={14} /> Stop
          </button>
          {run.status === "paused" ? (
            <button type="button" onClick={() => control("resume")}>
              <Play size={15} /> Resume
            </button>
          ) : (
            <button
              type="button"
              disabled={run.status !== "running"}
              onClick={() => control("pause")}
            >
              <Pause size={15} /> Pause
            </button>
          )}
          <button
            type="button"
            disabled={run.status !== "paused"}
            onClick={() => control("into")}
          >
            Step Into
          </button>
          <button
            type="button"
            disabled={run.status !== "paused"}
            onClick={() => control("over")}
          >
            Step Over
          </button>
        </div>
        <div className="bp-toolbar-views">
          <label className="bp-view bp-view-mode">
            <span className="bp-sr">Workspace mode</span>
            <select
              value={mode}
              onChange={(event) => showCode(event.currentTarget.value as Mode)}
            >
              <option value="graph">Blueprint</option>
              <option value="split">Blueprint + {sourceLabel}</option>
              <option value="code">{sourceLabel}</option>
            </select>
          </label>
          <label className="bp-view bp-view-language">
            <span className="bp-sr">Programming language</span>
            <select
              value={language}
              onChange={(event) => {
                setLanguage(event.currentTarget.value);
                setNotice("");
                setDiagnostics([]);
                if (mode === "graph") showCode("split");
              }}
            >
              {languages.list().map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={exportCode}>
            <Download size={15} /> Export {sourceLabel}
          </button>
        </div>
      </fieldset>
      {settings && (
        <section className="bp-settings" aria-label="Editor settings">
          <label>
            Execution speed{" "}
            <select
              value={speed}
              onChange={(event) => setSpeed(Number(event.currentTarget.value))}
            >
              <option value={0}>Full speed</option>
              <option value={100}>100 ms per node</option>
              <option value={250}>250 ms per node</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              disabled={!editable}
              checked={project.comments}
              onChange={(event) => {
                const comments = event.currentTarget.checked;
                change((previous) => ({ ...previous, comments }));
              }}
            />{" "}
            Educational comments
          </label>
          <button
            type="button"
            onClick={() =>
              download(
                `${project.title}.lanbp`,
                JSON.stringify(project),
                "application/json",
              )
            }
          >
            Export project
          </button>
          <AiConnection disabled={!editable} />
        </section>
      )}
      {draft.conflict && (
        <section className="bp-notice" role="alert">
          <span>
            A local draft was saved against an older project revision.
          </span>
          <button
            type="button"
            disabled={creating || opening}
            onClick={() =>
              draft.conflict &&
              void create(
                {
                  ...draft.conflict,
                  title: `${project.title.slice(0, 82)} (recovered draft)`,
                },
                true,
              )
            }
          >
            Recover as a copy
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Discard the older draft?"))
                draft.discardConflict();
            }}
          >
            Open saved version
          </button>
        </section>
      )}
      {(creating || opening) && (
        <div className="bp-notice">
          <LoadingMessage>
            {opening ? "Opening the editor…" : "Creating Blueprint…"}
          </LoadingMessage>
        </div>
      )}
      {notice && (
        <div className="bp-notice">
          <output>{notice}</output>
          {pending.current && (
            <button
              type="button"
              disabled={creating || opening}
              onClick={() => void create(undefined, !!draft.conflict)}
            >
              Retry creation
            </button>
          )}
        </div>
      )}
      {assignment && (
        <section className="bp-assignment">
          <strong>{assignment.title}</strong>
          <span>{assignment.description}</span>
          <span>
            {run.status === "complete"
              ? taskPassed
                ? "Passed"
                : `Try again. ${assignment.hint}`
              : assignment.hint}
          </span>
        </section>
      )}

      <div
        className={`bp-workspace ${left && mode !== "code" ? "" : "bp-no-left"} ${right && mode !== "code" ? "" : "bp-no-right"}`}
      >
        {left && mode !== "code" && (
          <aside className="bp-library">
            <header>
              <h2>Node library</h2>
              <button
                type="button"
                aria-label="Collapse node library"
                onClick={() => setLeft(false)}
              >
                <ChevronLeft size={16} />
              </button>
            </header>
            <input
              className="bp-search"
              value={searchNodes}
              onChange={(event) => setSearchNodes(event.target.value)}
              aria-label="Search nodes"
              placeholder="Search nodes…"
            />
            <div className="bp-node-list">
              {categories.map((category) => (
                <section key={category}>
                  <h3>{category}</h3>
                  {shown
                    .filter((item) => item.category === category)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        title={item.description}
                        disabled={!editable}
                        draggable={editable}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "application/blueprint-node",
                            item.id,
                          );
                          event.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => addNode(item)}
                      >
                        <span>+</span>
                        {item.label}
                      </button>
                    ))}
                </section>
              ))}
            </div>
            <details>
              <summary>Graph explorer</summary>
              {graph.nodes
                .filter((node) =>
                  ["declare", "function", "start"].includes(node.kind),
                )
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      locate({ graphId: graph.id, nodeId: item.id })
                    }
                  >
                    {nodeName({ graphId: graph.id, nodeId: item.id })}
                  </button>
                ))}
              <Link href={`${blueprintPath}/docs`}>Node documentation</Link>
            </details>
          </aside>
        )}
        <section className="bp-main-workspace" aria-label="Blueprint workspace">
          <fieldset className="bp-graphs" aria-label="Graphs">
            {!left && mode !== "code" && (
              <button
                type="button"
                aria-label="Open node library"
                onClick={() => setLeft(true)}
              >
                <ChevronRight size={16} />
              </button>
            )}
            {project.graphs.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={graph.id === item.id}
                onClick={() => {
                  if (mode === "code") setMode("split");
                  selectGraph(item.id);
                }}
              >
                {item.name}
              </button>
            ))}
            {!isDocument && (
              <button
                type="button"
                disabled={!editable || project.graphs.length >= 12}
                onClick={() => createSubgraph("function")}
              >
                + Function
              </button>
            )}
            {!adapter.unsupportedFeatures?.includes("http") && (
              <button
                type="button"
                disabled={!editable || project.graphs.length >= 12}
                onClick={() => createSubgraph("endpoint")}
              >
                + Endpoint
              </button>
            )}
            {endpoint && !isDocument && (
              <button
                type="button"
                aria-expanded={testingEndpoint}
                onClick={() => setTestingEndpoint((open) => !open)}
              >
                Test endpoint
              </button>
            )}
            {!right && mode !== "code" && (
              <button
                type="button"
                aria-label="Open properties"
                onClick={() => setRight(true)}
              >
                <ChevronLeft size={16} />
              </button>
            )}
          </fieldset>
          {testingEndpoint && endpoint && !isDocument && (
            <form
              className="bp-settings bp-endpoint-preview"
              onSubmit={(event) => {
                event.preventDefault();
                sendPreview(false);
              }}
            >
              <strong>
                {String(propertyValue(endpoint, endpointMethod))}{" "}
                {String(propertyValue(endpoint, endpointPath))}
              </strong>
              {propertyValue(endpoint, endpointMethod) !== "GET" && (
                <label>
                  JSON request body{" "}
                  <textarea
                    rows={2}
                    value={requestBody}
                    disabled={!editable}
                    onChange={(event) =>
                      setRequestBody(event.currentTarget.value)
                    }
                  />
                </label>
              )}
              <button type="submit" disabled={!editable}>
                Send request
              </button>
              <button
                type="button"
                disabled={!editable}
                onClick={() => sendPreview(true)}
              >
                Debug request
              </button>
            </form>
          )}
          <div className={`bp-work-area bp-mode-${mode}`}>
            {mode !== "code" && (
              <Canvas
                key={graph.id}
                graph={graph}
                graphs={project.graphs}
                choices={choices}
                adapter={adapter}
                selectionRequest={
                  selectionRequest?.graphId === graph.id
                    ? selectionRequest
                    : undefined
                }
                onSelectionApplied={acknowledgeSelection}
                onSelection={selectNodes}
                onCommentCreated={(id) => {
                  setRight(true);
                  setCommentToName(id);
                  setSelectionRequest({ graphId: graph.id, ids: [id] });
                }}
                onGraph={changeGraph}
                onAdd={addNode}
                active={run.active}
                previous={run.previous}
                failed={run.failed}
                focus={focus}
                editable={editable}
              />
            )}
            {mode !== "graph" && (
              <section
                className="bp-source-pane"
                aria-label={`${adapter.label} preview`}
              >
                <header>
                  <strong>{sourceLabel}</strong>
                  {isDocument && (
                    <div className="bp-page-view">
                      <button
                        type="button"
                        aria-pressed={pagePreview}
                        onClick={() => setPagePreview(true)}
                      >
                        Page
                      </button>
                      <button
                        type="button"
                        aria-pressed={!pagePreview}
                        onClick={() => setPagePreview(false)}
                      >
                        Code
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!previewSource}
                    onClick={async () => {
                      if (!previewSource) return;
                      try {
                        await navigator.clipboard.writeText(previewSource.code);
                        setNotice(`Copied ${sourceLabel}.`);
                      } catch {
                        setNotice("Clipboard is unavailable.");
                      }
                    }}
                  >
                    Copy
                  </button>
                </header>
                {previewSource?.note && (
                  <p className="bp-source-note">{previewSource.note}</p>
                )}
                {previewSource ? (
                  isDocument && pagePreview ? (
                    <iframe
                      className="bp-page-frame"
                      title="Rendered Blueprint page"
                      sandbox={
                        previewSource.interactive
                          ? "allow-scripts allow-popups allow-popups-to-escape-sandbox"
                          : "allow-popups allow-popups-to-escape-sandbox"
                      }
                      srcDoc={previewSource.code}
                    />
                  ) : (
                    <SourceView
                      key={adapter.id}
                      source={previewSource}
                      language={sourceLanguage}
                      languageLabel={sourceLabel}
                      selected={
                        node
                          ? { graphId: graph.id, nodeId: node.id }
                          : undefined
                      }
                      onLocate={(at) => {
                        locate(at);
                        if (mode === "code") setMode("split");
                      }}
                    />
                  )
                ) : (
                  <output className="bp-empty">
                    {previewError?.message ??
                      `Could not generate ${adapter.label}.`}
                  </output>
                )}
              </section>
            )}
          </div>
        </section>
        {right && mode !== "code" && (
          <aside className="bp-properties">
            <header>
              <h2>Properties</h2>
              <button
                type="button"
                aria-label="Collapse properties"
                onClick={() => setRight(false)}
              >
                <ChevronRight size={16} />
              </button>
            </header>
            {graph.id !== project.graphs[0].id && (
              <div className="bp-function-options">
                <label>
                  {endpoint ? "Endpoint name" : "Function name"}{" "}
                  <input
                    key={graph.name}
                    defaultValue={graph.name}
                    disabled={!editable}
                    maxLength={40}
                    onBlur={(event) => renameGraph(event.currentTarget.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={removeGraph}
                >
                  {endpoint ? "Delete endpoint" : "Delete function"}
                </button>
              </div>
            )}
            <Inspector
              node={node}
              adapter={adapter}
              focusCommentName={node !== undefined && node.id === commentToName}
              onCommentNameFocused={commentNameFocused}
              graph={graph}
              graphs={project.graphs}
              disabled={!editable}
              error={setNotice}
              connect={(edge) =>
                changeGraph((previous) => ({
                  ...previous,
                  edges: [...previous.edges, edge],
                }))
              }
              update={(modify) =>
                changeGraph((previous) => ({
                  ...previous,
                  nodes: previous.nodes.map((item) =>
                    item.id === node?.id ? modify(item) : item,
                  ),
                }))
              }
            />
            {node?.kind === "aiBuildBlueprint" && (
              <GraphGenerator
                key={`${node.id}:${adapter.id}`}
                project={project}
                graph={graph}
                adapter={adapter}
                disabled={!editable}
                onInsert={(base, generated) => {
                  let applied = false;
                  draft.change((current) => {
                    if (current !== base)
                      throw new Error(
                        "The project changed while AI was working. Generate again from the current graph.",
                      );
                    applied = true;
                    return generated.project;
                  });
                  if (!applied)
                    throw new Error(
                      "The project changed while AI was working. Generate again from the current graph.",
                    );
                  setRun(emptyRun());
                  setDiagnostics([]);
                  setNotice(
                    `Inserted ${generated.nodes.length} connected nodes.`,
                  );
                  locate({ graphId: graph.id, nodeId: generated.nodes[0].id });
                }}
              />
            )}
            {node &&
              diagnostics
                .filter(
                  (item) =>
                    item.graphId === graph.id && item.nodeId === node.id,
                )
                .map((item, index) => (
                  <p
                    className="bp-property-error"
                    key={`${item.code}-${index}`}
                  >
                    {item.message}
                  </p>
                ))}
          </aside>
        )}
      </div>
      <section className="bp-bottom" aria-label="Compiler and runtime results">
        <header>
          <button
            type="button"
            aria-label={bottom ? "Collapse output" : "Expand output"}
            aria-expanded={bottom}
            onClick={() => setBottom(!bottom)}
          >
            {bottom ? "▾" : "▸"}
          </button>
          {sections.map((name) => (
            <button
              type="button"
              key={name}
              aria-pressed={panel === name && bottom}
              onClick={() => {
                setPanel(name);
                setBottom(true);
              }}
            >
              {name}
              {name === "Diagnostics" && diagnostics.length
                ? ` (${diagnostics.length})`
                : ""}
            </button>
          ))}
          <span className={`bp-run-state bp-state-${run.status}`}>
            {nodeLabel(run.status)}
          </span>
          {bottom && (
            <label className="bp-height">
              <span className="bp-sr">Output panel height</span>
              <input
                type="range"
                min={105}
                max={400}
                value={outputHeight}
                onChange={(event) =>
                  setOutputHeight(Number(event.currentTarget.value))
                }
              />
            </label>
          )}
        </header>
        {bottom && (
          <div className="bp-output" style={{ height: outputHeight }}>
            {panel === "Console" && (
              <>
                {run.error && (
                  <p role="alert" className="bp-runtime-error">
                    {run.error}{" "}
                    {run.failed && (
                      <button type="button" onClick={() => locate(run.failed!)}>
                        Locate failed node
                      </button>
                    )}
                  </p>
                )}
                {run.status === "paused" && run.active && (
                  <p>
                    Paused before {nodeName(run.active)}.{" "}
                    <button type="button" onClick={() => locate(run.active!)}>
                      Locate node
                    </button>
                  </p>
                )}
                {!run.output.length &&
                  !run.error &&
                  run.status !== "paused" && (
                    <p className="bp-empty">Program output will appear here.</p>
                  )}
                <ol className="bp-console-lines">
                  {run.output.map((value, index) => (
                    <li key={`${index}:${value}`}>{value || "\u00a0"}</li>
                  ))}
                </ol>
              </>
            )}
            {panel === "Diagnostics" &&
              (diagnostics.length ? (
                <ul className="bp-diagnostics">
                  {diagnostics.map((item, index) => (
                    <li key={`${item.code}-${index}`}>
                      <button
                        type="button"
                        disabled={!item.nodeId}
                        onClick={() =>
                          item.graphId &&
                          item.nodeId &&
                          locate({ graphId: item.graphId, nodeId: item.nodeId })
                        }
                      >
                        <strong className={`bp-${item.severity}`}>
                          {item.severity} · {item.code}
                        </strong>
                        <span>
                          {item.message} {item.hint}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="bp-empty">No compiler diagnostics.</p>
              ))}
            {panel === "Variables" &&
              (variables ? (
                <div className="bp-values">
                  <div>
                    <h4>Variables</h4>
                    <dl>
                      {Object.entries(variables).map(([key, value]) => (
                        <div key={key}>
                          <dt>{key}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div>
                    <h4>Evaluated inputs</h4>
                    <ol>
                      {trace?.inputs.map((value, index) => (
                        <li key={`${trace.step}:${index}:${value}`}>{value}</li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <h4>Evaluated outputs</h4>
                    <ol>
                      {trace?.outputs.map(({ at, value }, index) => (
                        <li key={`${trace.step}:${index}:${at.nodeId}`}>
                          <button type="button" onClick={() => locate(at)}>
                            {nodeName(at)}
                          </button>{" "}
                          {value}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              ) : (
                <p className="bp-empty">
                  Run or step through a program to inspect values.
                </p>
              ))}
            {panel === "History" &&
              (run.history.length ? (
                <ol className="bp-history">
                  {run.history.map((item, index) => (
                    <li key={`${item.step}:${item.at.nodeId}:${index}`}>
                      <button type="button" onClick={() => locate(item.at)}>
                        Step {item.step} · {nodeName(item.at)} · depth{" "}
                        {item.depth}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="bp-empty">Executed nodes will appear here.</p>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}
