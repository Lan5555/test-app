const assert = require("node:assert/strict");
const { execFileSync, spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const {
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const modules = new Map();
const root = path.resolve(__dirname, "../src/features/blueprint");

function load(relative, overrides = {}) {
  const file = path.resolve(
    root,
    relative.endsWith(".tsx") ? relative : `${relative}.ts`,
  );
  if (modules.has(file)) return modules.get(file).exports;
  const instance = new Module(file, module);
  instance.filename = file;
  instance.paths = module.paths;
  instance.require = (name) =>
    Object.hasOwn(overrides, name)
      ? overrides[name]
      : name.endsWith(".css")
        ? {}
        : name.startsWith(".") || name.startsWith("@/")
          ? load(
              path.relative(
                root,
                name.startsWith("@/")
                  ? path.resolve(__dirname, "../src", name.slice(2))
                  : path.resolve(path.dirname(file), name),
              ),
            )
          : require(name);
  modules.set(file, instance);
  instance._compile(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText,
    file,
  );
  return instance.exports;
}

const { buildIR } = load("core/compiler");
const { blueprintPrompt, insertBlueprintPlan } = load("core/graph-builder");
const { addCommentGroup, commentParents, makeCommentGroup, moveGraphNodes } =
  load("core/comments");
const { nodeChoices, nodeMatches, nodeTitle, reconcileVariableReferences } =
  load("core/catalog");
const { createNode, createGraph, newProject, compatible } = load("core/model");
const { importProject, parseProject } = load("core/schema");
const { registerNode, getNode, pinsFor } = load("core/registry");
const { generateSource, languages, projectLanguage } = load("core/languages");
const { startRuntime } = load("core/runtime");
const { templates, checkAssignment } = load("education");
const { automationStore, draftStore, projectStore, runConnectedHttp } =
  load("persistence");
const js = languages.get("javascript");
const cpp = languages.get("cpp");

test("overlapping generated source ranges cannot reselect nodes during a canvas highlight", async () => {
  const { JSDOM } = require("jsdom");
  const React = require("react");
  const dom = new JSDOM("<div id='root'></div>", { pretendToBeVisual: true });
  const previous = [
    globalThis.window,
    globalThis.document,
    globalThis.IS_REACT_ACT_ENVIRONMENT,
  ];
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = require("react-dom/client");
  const root = createRoot(document.querySelector("#root"));
  const first = { graphId: "graph", nodeId: "first" };
  const second = { graphId: "graph", nodeId: "second" };
  const source = {
    code: "one\ntwo\nend",
    extension: ".js",
    ranges: [
      { at: first, start: 1, end: 3 },
      { at: first, start: 2, end: 2 },
      { at: second, start: 1, end: 2 },
      { at: second, start: 3, end: 3 },
    ],
  };
  let props;
  const view = {
    hasFocus: true,
    state: {
      doc: {
        lines: 3,
        line: (number) => ({ from: (number - 1) * 4, to: number * 4 - 1 }),
        lineAt: (position) => ({ number: Math.floor(position / 4) + 1 }),
      },
      selection: { main: { from: 0, to: 0, head: 0 } },
    },
    dispatch({ selection }) {
      this.state.selection.main = {
        from: selection.anchor,
        to: selection.head,
        head: selection.head,
      };
      props.onUpdate({ selectionSet: true, state: this.state, view: this });
    },
  };
  function CodeMirrorStub(next) {
    props = next;
    React.useLayoutEffect(() => props.onCreateEditor(view), []);
    return null;
  }
  const SourceView = load("ui/source.tsx", {
    "@uiw/react-codemirror": CodeMirrorStub,
  }).default;
  const calls = [];
  function Harness({ adapter = js }) {
    const [selected, setSelected] = React.useState(first);
    return React.createElement(SourceView, {
      source,
      language: adapter.id,
      languageLabel: adapter.label,
      selected,
      onLocate(at) {
        calls.push(at);
        if (calls.length < 12) setSelected(at);
      },
    });
  }
  try {
    await React.act(async () => {
      root.render(React.createElement(Harness));
    });
    assert.deepEqual(calls, []);
    assert.equal(props.extensions[0].language.name, "javascript");
    await React.act(async () => {
      view.dispatch({ selection: { anchor: 8, head: 8 } });
    });
    assert.deepEqual(calls, [second]);
    await React.act(async () => {
      root.render(React.createElement(Harness, { adapter: cpp }));
    });
    assert.equal(props.extensions[0].language.name, "cpp");
    assert.equal(props["aria-label"], "Generated C++");
    await React.act(async () => {
      root.render(
        React.createElement(Harness, { adapter: languages.get("html") }),
      );
    });
    assert.equal(props.extensions[0].language.name, "html");
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    dom.window.close();
    [
      globalThis.window,
      globalThis.document,
      globalThis.IS_REACT_ACT_ENVIRONMENT,
    ] = previous;
  }
});

test("the Blueprint canvas handles selection, editing shortcuts and comment groups", async (context) => {
  const { JSDOM } = require("jsdom");
  const React = require("react");
  const dom = new JSDOM("<div id='root'></div>", { pretendToBeVisual: true });
  const { window } = dom;
  window.DOMMatrixReadOnly = class {
    m22 = 1;
  };
  const resizeObservers = new Set();
  class ResizeObserver {
    listeners = new Set();
    constructor(callback) {
      this.callback = callback;
      resizeObservers.add(this);
    }
    observe(target) {
      this.listeners.add(target);
    }
    unobserve(target) {
      this.listeners.delete(target);
    }
    disconnect() {
      this.listeners.clear();
      resizeObservers.delete(this);
    }
    notify() {
      if (this.listeners.size)
        this.callback([...this.listeners].map((target) => ({ target })));
    }
  }
  const globals = {
    window,
    document: window.document,
    navigator: window.navigator,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    ResizeObserver,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const descriptors = Object.fromEntries(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(globals))
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", {
    get: () => 160,
  });
  Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", {
    get: () => 100,
  });
  const errors = context.mock.method(console, "error", () => {});
  const { createRoot } = require("react-dom/client");
  const canvasModule = load("ui/canvas.tsx");
  const Canvas = canvasModule.default;
  const Inspector = load("ui/inspector.tsx", {
    "./canvas": canvasModule,
  }).default;
  const element = window.document.querySelector("#root");
  const root = createRoot(element);
  try {
    const project = templates[0].build();
    const graph = project.graphs[0];
    let editedGraph = graph;
    let addedChoice;
    let recentComment;
    let nameFocused = false;
    const onGraph = (update) => {
      editedGraph = update(editedGraph);
    };
    const app = (selection, selectionRequest = { ids: selection }) =>
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(Canvas, {
          graph: editedGraph,
          graphs: project.graphs,
          choices: nodeChoices(editedGraph, project.graphs),
          selectionRequest,
          editable: true,
          onSelection() {},
          onCommentCreated(id) {
            recentComment = id;
          },
          onGraph,
          onAdd(choice) {
            addedChoice = choice;
          },
        }),
        recentComment &&
          selection.includes(recentComment) &&
          React.createElement(Inspector, {
            node: editedGraph.nodes.find(({ id }) => id === recentComment),
            graph: editedGraph,
            graphs: project.graphs,
            focusCommentName: !nameFocused,
            onCommentNameFocused() {
              nameFocused = true;
            },
            update(update) {
              onGraph((current) => ({
                ...current,
                nodes: current.nodes.map((node) =>
                  node.id === recentComment ? update(node) : node,
                ),
              }));
            },
            error: assert.fail,
          }),
      );
    await React.act(async () => {
      root.render(app([]));
    });
    assert.equal(element.querySelectorAll(".react-flow__node").length, 2);
    for (const id of [graph.nodes[0].id, graph.nodes[1].id]) {
      await React.act(async () => {
        for (const observer of resizeObservers) observer.notify();
        root.render(app([id]));
      });
      assert.equal(
        element
          .querySelector(".react-flow__node.selected")
          ?.getAttribute("data-id"),
        id,
      );
    }
    assert.equal(
      errors.mock.calls.some(({ arguments: args }) =>
        args.some((arg) => String(arg).includes("Maximum update depth")),
      ),
      false,
    );
    for (const selector of [
      ".react-flow__pane",
      ".react-flow__node",
      ".react-flow__edge-interaction",
    ]) {
      const target = element.querySelector(selector);
      assert.ok(target, `Missing canvas surface ${selector}`);
      const event = new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: 40,
        clientY: 30,
      });
      await React.act(async () => {
        target.dispatchEvent(event);
      });
      assert.equal(event.defaultPrevented, true);
      const picker = element.querySelector(".bp-node-picker");
      assert.ok(picker?.querySelector("input"));
      const textMenu = new window.MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
      });
      picker.querySelector("input").dispatchEvent(textMenu);
      assert.equal(textMenu.defaultPrevented, false);
      await React.act(async () => {
        picker.querySelector("button").click();
      });
    }
    const outsideMenu = new window.MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    window.document.body.dispatchEvent(outsideMenu);
    assert.equal(outsideMenu.defaultPrevented, false);
    const pane = element.querySelector(".react-flow__pane");
    const viewport = element.querySelector(".react-flow__viewport");
    const down = (type, x, buttons = 2) =>
      new window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 2,
        buttons,
        clientX: x,
        clientY: 30,
        view: window,
      });
    await React.act(async () => {
      pane.dispatchEvent(down("pointerdown", 40));
      const early = down("contextmenu", 40);
      pane.dispatchEvent(early);
      assert.equal(early.defaultPrevented, true);
      assert.equal(element.querySelector(".bp-node-picker"), null);
      pane.dispatchEvent(down("pointerup", 40, 0));
    });
    assert.ok(element.querySelector(".bp-node-picker"));
    await React.act(async () => {
      element.querySelector(".bp-node-picker button").click();
    });
    const transform = viewport.style.transform;
    await React.act(async () => {
      pane.dispatchEvent(down("pointerdown", 30));
      pane.dispatchEvent(down("mousedown", 30));
      pane.dispatchEvent(down("pointermove", 70));
      window.dispatchEvent(down("mousemove", 70));
      pane.dispatchEvent(down("pointerup", 70, 0));
      window.dispatchEvent(down("mouseup", 70, 0));
      const ending = down("contextmenu", 70, 0);
      pane.dispatchEvent(ending);
      assert.equal(ending.defaultPrevented, true);
    });
    assert.equal(element.querySelector(".bp-node-picker"), null);
    assert.notEqual(viewport.style.transform, transform);
    for (const key of ["Delete", "Backspace"]) {
      const hitArea = element.querySelector(".react-flow__edge-interaction");
      assert.ok(hitArea);
      await React.act(async () => {
        hitArea.dispatchEvent(
          new window.MouseEvent("click", { bubbles: true }),
        );
      });
      const selected = element.querySelector(".react-flow__edge.selected");
      assert.ok(selected, "Clicking a wire should visibly select it.");
      assert.equal(element.querySelector(".react-flow__node.selected"), null);
      await React.act(async () => {
        selected.dispatchEvent(
          new window.KeyboardEvent("keydown", {
            bubbles: true,
            key,
            code: key,
          }),
        );
      });
      assert.equal(editedGraph.edges.length, 0);
      assert.equal(editedGraph.nodes.length, 2);
      await React.act(async () => {
        root.render(app([]));
      });
      assert.equal(element.querySelector(".react-flow__edge"), null);
      await React.act(async () => {
        window.document.body.dispatchEvent(
          new window.KeyboardEvent("keyup", { bubbles: true, key, code: key }),
        );
        editedGraph = graph;
        root.render(app([]));
      });
    }
    const declaration = createNode("declare", 440, 90, {
      name: "i",
      type: "number",
    });
    editedGraph = { ...graph, nodes: [...graph.nodes, declaration] };
    await React.act(async () => {
      root.render(app([]));
    });
    const namedNode = element.querySelector(
      `.react-flow__node[data-id="${declaration.id}"]`,
    );
    assert.match(namedNode.textContent, /Declare i/);
    await React.act(async () => {
      pane.dispatchEvent(down("contextmenu", 40, 0));
    });
    const namedButton = [
      ...element.querySelectorAll(".bp-node-picker button"),
    ].find((button) => button.textContent === "Get i");
    assert.ok(namedButton);
    await React.act(async () => {
      namedButton.click();
    });
    assert.equal(addedChoice.kind, "get");
    assert.deepEqual(addedChoice.values, {
      name: "i",
      type: "number",
      declarationId: declaration.id,
    });
    const request = { ids: [graph.nodes[0].id] };
    await React.act(async () => {
      root.render(app([], request));
    });
    const secondNode = element.querySelector(
      `.react-flow__node[data-id="${graph.nodes[1].id}"]`,
    );
    await React.act(async () => {
      secondNode.dispatchEvent(
        new window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
      secondNode.dispatchEvent(
        new window.KeyboardEvent("keyup", { bubbles: true, key: "Enter" }),
      );
    });
    editedGraph = {
      ...editedGraph,
      nodes: editedGraph.nodes.map((node) =>
        node.id === declaration.id ? { ...node, x: node.x + 12 } : node,
      ),
    };
    await React.act(async () => {
      root.render(app([], request));
    });
    assert.equal(
      element
        .querySelector(".react-flow__node.selected")
        ?.getAttribute("data-id"),
      graph.nodes[1].id,
    );
    const members = graph.nodes.map(({ id }) => id);
    const positionOf = (id) =>
      element.querySelector(`.react-flow__node[data-id="${id}"]`).style
        .transform;
    const beforeGrouping = members.map(positionOf);
    await React.act(async () => {
      root.render(app(members));
    });
    await React.act(async () => {
      window.document.body.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "c",
          code: "KeyC",
        }),
      );
      window.document.body.dispatchEvent(
        new window.KeyboardEvent("keyup", {
          bubbles: true,
          key: "c",
          code: "KeyC",
        }),
      );
    });
    assert.ok(recentComment, "C creates a comment for the selected nodes.");
    await React.act(async () => {
      root.render(app([recentComment]));
    });
    assert.deepEqual(members.map(positionOf), beforeGrouping);
    assert.equal(
      element.querySelector(".react-flow__node.selected .bp-comment-heading")
        ?.textContent,
      "Comment",
    );
    const name = element.querySelector(".bp-inspector input");
    assert.equal(window.document.activeElement, name);
    assert.equal(name.selectionEnd - name.selectionStart, "Comment".length);
    await React.act(async () => {
      name.value = "Print result";
      name.dispatchEvent(
        new window.KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
      );
    });
    assert.equal(
      editedGraph.nodes.find(({ id }) => id === recentComment).values.text,
      "Print result",
    );
    await React.act(async () => {
      root.render(app([recentComment]));
    });
    const beforeDrag = new Map(
      editedGraph.nodes.map((node) => [node.id, node]),
    );
    const heading = element.querySelector(".bp-comment-heading");
    const mouse = (type, clientX, clientY, buttons = 1) =>
      new window.MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons,
        clientX,
        clientY,
        view: window,
      });
    await React.act(async () => {
      heading.dispatchEvent(mouse("mousedown", 60, 70));
      window.dispatchEvent(mouse("mousemove", 65, 75));
      window.dispatchEvent(mouse("mousemove", 110, 105));
      window.dispatchEvent(mouse("mouseup", 110, 105, 0));
    });
    const dragged = editedGraph.nodes.find(({ id }) => id === recentComment);
    const dx = dragged.x - beforeDrag.get(recentComment).x;
    const dy = dragged.y - beforeDrag.get(recentComment).y;
    assert.ok(dx > 0 && dy > 0, "Dragging the heading moves the group.");
    for (const member of editedGraph.nodes.filter(({ id }) =>
      members.includes(id),
    )) {
      assert.ok(Math.abs(member.x - beforeDrag.get(member.id).x - dx) < 1e-6);
      assert.ok(Math.abs(member.y - beforeDrag.get(member.id).y - dy) < 1e-6);
    }
    await React.act(async () => {
      element.querySelector(".react-flow__node.selected").dispatchEvent(
        new window.KeyboardEvent("keydown", {
          bubbles: true,
          key: "Delete",
          code: "Delete",
        }),
      );
    });
    assert.ok(!editedGraph.nodes.some(({ id }) => id === recentComment));
    const ungrouped = editedGraph.nodes.filter(({ id }) =>
      members.includes(id),
    );
    assert.equal(ungrouped.length, members.length);
    assert.ok(ungrouped.every(({ values }) => !values.commentGroup));
    assert.deepEqual(editedGraph.edges, graph.edges);
    await React.act(async () => {
      root.render(app([]));
    });
    assert.equal(element.querySelector(".bp-comment-frame"), null);
  } finally {
    await React.act(async () => {
      root.unmount();
    });
    window.close();
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("comment groups retain their name and members and move those nodes together", () => {
  const project = templates[0].build();
  const [graph] = project.graphs;
  const group = makeCommentGroup(
    graph,
    graph.nodes.map(({ id }) => ({ id, width: 170, height: 100 })),
  );
  assert.ok(group);
  group.node.values.text = "Print the result";
  const grouped = addCommentGroup(graph, group);
  project.graphs[0] = moveGraphNodes(
    grouped,
    new Map([[group.node.id, { x: group.node.x + 35, y: group.node.y + 24 }]]),
  );
  const [restored] = importProject(JSON.stringify(project)).graphs;
  const parents = commentParents(restored.nodes);
  for (const original of graph.nodes) {
    const member = restored.nodes.find(({ id }) => id === original.id);
    assert.equal(parents.get(member.id).values.text, "Print the result");
    assert.equal(member.x, original.x + 35);
    assert.equal(member.y, original.y + 24);
  }
  assert.equal(buildIR(project).diagnostics.length, 0);
});

function wire(graph, source, sourcePin, target, targetPin, kind = "exec") {
  graph.edges.push({
    id: crypto.randomUUID(),
    source: source.id,
    sourcePin,
    target: target.id,
    targetPin,
    kind,
  });
}
function add(graph, kind, values) {
  const node = createNode(kind, 0, 0, values);
  graph.nodes.push(node);
  return node;
}
function program(project) {
  const result = buildIR(project);
  assert.ok(result.program, JSON.stringify(result.diagnostics));
  return result.program;
}
async function interpret(ir, options) {
  const events = [];
  const runtime = startRuntime(ir, (event) => events.push(event), options);
  await runtime.done;
  return {
    available: events,
    output: events
      .filter((event) => event.kind === "output")
      .map((event) => event.value),
    final: events.at(-1),
  };
}

const expected = {
  hello: ["Hello World"],
  arithmetic: ["30"],
  grade: ["Pass"],
  table: ["3", "6", "9", "12", "15"],
  fibonacci: ["0", "1", "1", "2", "3", "5", "8", "13"],
  array: ["red", "green", "blue"],
  function: ["15"],
  json: ['{"student":"Ada","score":75}'],
};
for (const template of templates)
  test(`${template.title} compiles deterministically and matches the runtime`, async () => {
    const project = template.build();
    const roundTrip = importProject(JSON.stringify(project));
    assert.deepEqual(roundTrip, project);
    const ir = program(project);
    const source = js.generate(ir, { comments: true });
    assert.equal(
      source.code,
      js.generate(program(roundTrip), { comments: true }).code,
    );
    const output = [];
    new vm.Script(source.code).runInNewContext(
      {
        console: {
          log(value) {
            output.push(String(value));
          },
        },
      },
      { timeout: 1000 },
    );
    assert.deepEqual(output, expected[template.id]);
    const result = await interpret(ir);
    assert.deepEqual(result.output, output);
    assert.equal(result.final.status, "complete");
    const print = project.graphs[0].nodes.find((node) => node.kind === "print");
    assert.ok(
      source.ranges.some(
        (range) =>
          range.at.nodeId === print.id &&
          source.code.split("\n")[range.start - 1].includes("console.log"),
      ),
    );
  });

test("file parser rejects unsupported versions, oversized values and duplicate node identities", () => {
  const project = newProject();
  assert.throws(() => parseProject({ ...project, version: 2 }), /version/);
  assert.throws(() => importProject(" ".repeat(80100)), /too large/);
  project.graphs[0].nodes.push(project.graphs[0].nodes[0]);
  assert.throws(() => parseProject(project), /unique/);
});
test("the adapter and node registries reject duplicates and invalid pins", () => {
  assert.throws(() => languages.register(js), /already registered/);
  assert.throws(() => languages.get("future"), /Unsupported/);
  assert.deepEqual(
    languages.list().map(({ id }) => id),
    ["javascript", "cpp", "html", "security"],
  );
  assert.throws(() => registerNode(getNode("print")), /already registered/);
  assert.equal(compatible("exec", "any"), false);
  assert.equal(compatible("any", "number"), false);
  assert.equal(compatible("number", "any"), true);
  assert.equal(compatible("number", "string"), false);
});

test("C++ export emits a standalone translation unit and escapes Blueprint literals", () => {
  const project = templates[0].build();
  const print = project.graphs[0].nodes.find((node) => node.kind === "print");
  print.values.value = 'Hi"); throw "unexpected"; //\n🌍';
  const generated = cpp.generate(program(project), { comments: true });
  assert.equal(generated.extension, ".cpp");
  assert.match(generated.code, /int main\(\)/);
  assert.match(
    generated.code.split("\n")[generated.entryLine - 1],
    /int main\(\)/,
  );
  assert.doesNotMatch(generated.code, /throw "unexpected"/);
  assert.ok(generated.ranges.some((range) => range.at.nodeId === print.id));
});

test("HTML/CSS builds a styled document with escaped text and source locations", () => {
  const { JSDOM } = require("jsdom");
  const project = newProject("Page");
  const [graph] = project.graphs;
  const title = add(graph, "pageTitle", { text: "Notes <draft>" });
  const heading = add(graph, "pageHeading", { text: "A & B" });
  const paragraph = add(graph, "pageParagraph", {
    text: "<strong>Example</strong>\nSecond line",
  });
  const style = add(graph, "pageStyle", {
    background: "#eaf",
    foreground: "#312233",
    fontSize: 20,
    padding: 16,
  });
  const chain = [graph.nodes[0], title, heading, paragraph, style];
  for (let index = 1; index < chain.length; index++)
    wire(graph, chain[index - 1], "next", chain[index], "in");

  const html = languages.get("html");
  const choices = nodeChoices(graph, project.graphs, html);
  assert.ok(choices.some(({ kind }) => kind === "pageStyle"));
  assert.ok(!choices.some(({ kind }) => kind === "print"));
  const imported = importProject(JSON.stringify(project));
  assert.equal(projectLanguage(imported), "html");
  const source = generateSource(buildIR(imported), html, false).source;
  assert.equal(source.extension, ".html");
  const page = new JSDOM(source.code);
  try {
    const { document } = page.window;
    assert.equal(document.title, "Notes <draft>");
    assert.equal(document.querySelector("h1").textContent, "A & B");
    assert.equal(
      document.querySelector("p").textContent,
      paragraph.values.text,
    );
    assert.equal(document.querySelector("strong"), null);
    assert.match(
      document.querySelector("style").textContent,
      /font-size: 20px/,
    );
  } finally {
    page.window.close();
  }
  const range = source.ranges.find(({ at }) => at.nodeId === heading.id);
  assert.match(source.code.split("\n")[range.start - 1], /<h1>/);
  style.values.background = "#fff; color: red";
  assert.match(
    generateSource(buildIR(project), html, false).diagnostics.at(-1).message,
    /hex color/,
  );
  assert.match(
    generateSource(buildIR(project), js, false).diagnostics.at(-1).message,
    /Choose HTML/,
  );
});

test("HTML layout nodes nest their Body paths and keep Next outside", () => {
  const { JSDOM } = require("jsdom");
  const project = newProject("Nested layout");
  const [graph] = project.graphs;
  const container = add(graph, "pageContainer", { gap: 8 });
  const grid = add(graph, "pageGrid", { columns: 3 });
  const section = add(graph, "pageSection");
  const heading = add(graph, "pageSubheading", { text: "Checklist" });
  const list = add(graph, "pageList", { ordered: true });
  const task = add(graph, "pageListItem", { text: "<Review> the layout" });
  const button = add(graph, "pageButton", { text: "Done" });
  const quote = add(graph, "pageQuote", { text: "Outside" });
  const footer = add(graph, "pageFooter", {
    anchor: "info",
    background: "#ece",
    radius: 12,
  });
  const details = add(graph, "pageDetails", { summary: "More" });
  const image = add(graph, "pageImage", {
    src: "https://example.com/picture.png",
    alt: "Picture",
    width: 240,
  });
  const link = add(graph, "pageLink", { href: "#info", text: "Go to footer" });
  wire(graph, graph.nodes[0], "next", container, "in");
  wire(graph, container, "body", grid, "in");
  wire(graph, grid, "body", section, "in");
  wire(graph, section, "body", heading, "in");
  wire(graph, heading, "next", list, "in");
  wire(graph, list, "body", task, "in");
  wire(graph, section, "next", button, "in");
  wire(graph, container, "next", quote, "in");
  wire(graph, quote, "next", footer, "in");
  wire(graph, footer, "body", details, "in");
  wire(graph, details, "body", image, "in");
  wire(graph, details, "next", link, "in");

  const html = languages.get("html");
  const choices = nodeChoices(graph, project.graphs, html);
  assert.ok(choices.some(({ kind }) => kind === "pageContainer"));
  assert.ok(choices.some(({ kind }) => kind === "pageRow"));
  const source = generateSource(
    buildIR(importProject(JSON.stringify(project))),
    html,
    false,
  ).source;
  const page = new JSDOM(source.code);
  try {
    const { document } = page.window;
    const top = document.body.firstElementChild;
    const gridElement = top.firstElementChild;
    assert.equal(page.window.getComputedStyle(top).gap, "8px");
    assert.equal(
      page.window.getComputedStyle(gridElement).gridTemplateColumns,
      "repeat(3, minmax(0, 1fr))",
    );
    assert.equal(
      gridElement.querySelector("section > ol > li").textContent,
      task.values.text,
    );
    assert.equal(gridElement.querySelector("button").type, "button");
    assert.equal(top.nextElementSibling.tagName, "BLOCKQUOTE");
    assert.equal(
      document.querySelector("footer#info details summary").textContent,
      "More",
    );
    assert.equal(document.querySelector("footer#info img").alt, "Picture");
    assert.equal(
      document.querySelector("footer#info a").getAttribute("href"),
      "#info",
    );
  } finally {
    page.window.close();
  }
  const range = source.ranges.find(({ at }) => at.nodeId === grid.id);
  assert.match(
    source.code.split("\n")[range.start - 1],
    /data-blueprint-layout=/,
  );
  assert.match(source.code.split("\n")[range.end - 1], /<\/div>/);

  grid.values.columns = 1.5;
  assert.match(
    generateSource(buildIR(project), html, false).diagnostics.at(-1).message,
    /whole number/,
  );
  grid.values.columns = 3;
  task.kind = "pageParagraph";
  assert.match(
    generateSource(buildIR(project), html, false).diagnostics.at(-1).message,
    /List Item/,
  );
});

test("CSS rule nodes style HTML classes and export mapped stylesheet rules", () => {
  const { JSDOM } = require("jsdom");
  const project = newProject("Styled cards");
  const [graph] = project.graphs;
  const card = add(graph, "pageContainer", {
    className: "card featured",
    padding: 4,
  });
  const heading = add(graph, "pageHeading", {
    text: "Welcome",
    className: "hero-title",
  });
  const typography = add(graph, "cssTypography", {
    selector: ".hero-title",
    color: "#123456",
    fontSize: 32,
  });
  const surface = add(graph, "cssSurface", {
    selector: ".card",
    background: "#edf4ff",
    radius: 24,
  });
  const spacing = add(graph, "cssSpacing", {
    selector: ".card",
    padding: 28,
    gap: 10,
  });
  const size = add(graph, "cssSize", {
    selector: ".card",
    width: 95,
    maxWidth: 720,
  });
  const hover = add(graph, "cssSurface", {
    selector: ".card",
    state: "hover",
    shadow: "raised",
  });
  const main = [
    graph.nodes[0],
    typography,
    surface,
    spacing,
    size,
    hover,
    card,
  ];
  for (let index = 1; index < main.length; index++)
    wire(graph, main[index - 1], "next", main[index], "in");
  wire(graph, card, "body", heading, "in");

  const html = languages.get("html");
  assert.ok(
    nodeChoices(graph, project.graphs, html).some(
      ({ kind }) => kind === "cssSurface",
    ),
  );
  assert.ok(
    !nodeChoices(graph, project.graphs, js).some(
      ({ kind }) => kind === "cssSurface",
    ),
  );
  const restored = importProject(JSON.stringify(project));
  const source = generateSource(buildIR(restored), html, false).source;
  const page = new JSDOM(source.code);
  try {
    const { document } = page.window;
    const cardElement = document.querySelector(".card.featured");
    assert.ok(cardElement);
    const style = page.window.getComputedStyle(cardElement);
    assert.equal(style.padding, "28px");
    assert.equal(style.backgroundColor, "rgb(237, 244, 255)");
    assert.equal(style.borderRadius, "24px");
    assert.equal(style.maxWidth, "720px");
    assert.equal(
      page.window.getComputedStyle(document.querySelector(".hero-title"))
        .fontSize,
      "32px",
    );
    assert.match(
      document.querySelector("style").textContent,
      /\.card:hover \{/,
    );
  } finally {
    page.window.close();
  }
  const range = source.ranges.find(({ at }) => at.nodeId === typography.id);
  assert.match(source.code.split("\n")[range.start - 1], /\.hero-title \{/);
  typography.values.selector = ".card, .featured";
  assert.match(
    generateSource(buildIR(project), html, false).diagnostics.at(-1).message,
    /single CSS selector/,
  );
});

test("HTML interaction nodes export runnable click and input handlers", () => {
  const { JSDOM } = require("jsdom");
  const project = newProject("Interactive page");
  const [graph] = project.graphs;
  const button = add(graph, "pageButton", { anchor: "add", text: "Add one" });
  const count = add(graph, "pageHeading", { anchor: "count", text: "0" });
  const panel = add(graph, "pageContainer", { anchor: "panel" });
  const status = add(graph, "pageParagraph", {
    anchor: "status",
    text: "Ready",
  });
  const input = add(graph, "pageTextInput", {
    anchor: "message",
    label: "Message",
  });
  const output = add(graph, "pageParagraph", { anchor: "output" });
  const click = add(graph, "pageOnClick", { source: "add" });
  const increment = add(graph, "pageIncrement", { target: "count" });
  const toggle = add(graph, "pageToggleHidden", { target: "panel" });
  const toggleClass = add(graph, "pageToggleClass", {
    target: "count",
    token: "active",
  });
  const literalText = "</script><b>Saved</b>";
  const setText = add(graph, "pageSetText", {
    target: "status",
    text: literalText,
  });
  const onInput = add(graph, "pageOnInput", { source: "message" });
  const copy = add(graph, "pageCopyInput", {
    source: "message",
    target: "output",
  });
  const main = [
    graph.nodes[0],
    button,
    count,
    panel,
    input,
    output,
    click,
    onInput,
  ];
  for (let i = 1; i < main.length; i++)
    wire(graph, main[i - 1], "next", main[i], "in");
  wire(graph, panel, "body", status, "in");
  wire(graph, click, "body", increment, "in");
  wire(graph, increment, "next", toggle, "in");
  wire(graph, toggle, "next", toggleClass, "in");
  wire(graph, toggleClass, "next", setText, "in");
  wire(graph, onInput, "body", copy, "in");

  const html = languages.get("html");
  assert.ok(
    nodeChoices(graph, project.graphs, html).some(
      ({ kind }) => kind === "pageOnClick",
    ),
  );
  const compiled = generateSource(
    buildIR(importProject(JSON.stringify(project))),
    html,
    false,
  );
  assert.ok(compiled.source?.interactive, JSON.stringify(compiled.diagnostics));
  const page = new JSDOM(compiled.source.code, { runScripts: "dangerously" });
  try {
    const { document } = page.window;
    const find = (id) => document.getElementById(id);
    assert.equal(document.querySelectorAll("script").length, 1);
    find("add").click();
    assert.equal(find("count").textContent, "1");
    assert.equal(find("panel").hidden, true);
    assert.equal(page.window.getComputedStyle(find("panel")).display, "none");
    assert.equal(find("count").classList.contains("active"), true);
    assert.equal(find("status").textContent, literalText);
    assert.equal(find("status").children.length, 0);
    find("add").click();
    assert.equal(find("count").textContent, "2");
    assert.equal(find("panel").hidden, false);
    assert.equal(find("count").classList.contains("active"), false);
    find("message").value = "<i>Hello</i>";
    find("message").dispatchEvent(
      new page.window.Event("input", { bubbles: true }),
    );
    assert.equal(find("output").textContent, "<i>Hello</i>");
    assert.equal(find("output").children.length, 0);
  } finally {
    page.window.close();
  }
  const range = compiled.source.ranges.find(
    ({ at }) => at.nodeId === increment.id,
  );
  assert.match(
    compiled.source.code.split("\n")[range.start - 1],
    /textContent = String/,
  );
  click.values.source = "missing";
  assert.match(
    generateSource(buildIR(project), html, false).diagnostics.at(-1).message,
    /On Click needs an Element ID/,
  );
});

test("defensive security nodes match JavaScript export and runtime", async () => {
  const project = newProject("Defensive checks");
  const [graph] = project.graphs;
  let previous = graph.nodes[0];
  for (const [kind, input] of [
    ["isHttpsUrl", "https://example.com/"],
    ["isHttpsUrl", "https://user:pass@example.com/"],
    ["isHttpsUrl", "http://example.com/"],
    ["isHttpsUrl", "not a URL"],
    ["escapeHtml", "<strong>Tom & Ada</strong>"],
    ["urlOrigin", "https://user:pass@example.com:8443/log?x=yes"],
    ["urlOrigin", "ftp://example.com"],
    ["redactEmails", "Notify <Ada.L+lab@example.com>, help@school.test."],
    ["isSha256Digest", "a1".repeat(32)],
    ["isSha256Digest", "a1".repeat(31)],
    [
      "missingSecurityHeaders",
      {
        "Content-Security-Policy": "default-src 'self'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": " ",
      },
    ],
  ]) {
    const check = add(graph, kind, { input });
    const print = add(graph, "print");
    wire(graph, previous, "next", print, "in");
    wire(graph, check, "value", print, "value", "data");
    previous = print;
  }
  const security = languages.get("security");
  assert.equal(projectLanguage(project), "security");
  assert.ok(
    nodeChoices(graph, project.graphs, security).some(
      ({ kind }) => kind === "isHttpsUrl",
    ),
  );
  assert.ok(
    !nodeChoices(graph, project.graphs, security).some(
      ({ kind }) => kind === "httpGET",
    ),
  );
  const compiled = buildIR(project);
  const source = generateSource(compiled, security, false).source;
  assert.equal(source.extension, ".js");
  const output = [];
  new vm.Script(source.code).runInNewContext({
    URL,
    console: {
      log: (value) =>
        output.push(
          Array.isArray(value) ? JSON.stringify(value) : String(value),
        ),
    },
  });
  assert.deepEqual(output, [
    "true",
    "false",
    "false",
    "false",
    "&lt;strong&gt;Tom &amp; Ada&lt;/strong&gt;",
    "https://example.com:8443",
    "",
    "Notify <[redacted]>, [redacted].",
    "true",
    "false",
    '["strict-transport-security","referrer-policy"]',
  ]);
  assert.deepEqual((await interpret(compiled.program)).output, output);
});

function standardMathProject() {
  const project = newProject("Standard Library Math");
  const [graph] = project.graphs;
  let previous = graph.nodes[0];
  for (const kind of ["minimum", "maximum"]) {
    const math = add(graph, kind, { a: -3, b: 7 });
    const print = add(graph, "print");
    wire(graph, math, "value", print, "value", "data");
    wire(graph, previous, "next", print, "in");
    previous = print;
  }
  return project;
}

test("C++ library nodes map to generated source and stay portable across languages", async () => {
  const project = standardMathProject();
  const [graph] = project.graphs;
  const choices = nodeChoices(graph, project.graphs, cpp);
  assert.equal(
    choices.find(({ kind }) => kind === "minimum").label,
    "std::min · Minimum",
  );
  assert.ok(choices.some((choice) => nodeMatches(choice, "std::cout")));
  assert.equal(
    nodeTitle(
      graph.nodes.find(({ kind }) => kind === "maximum"),
      graph.name,
      cpp,
    ),
    "std::max · Maximum",
  );
  assert.ok(
    !choices.some(
      ({ category, kind }) =>
        ["HTTP & API", "AI Automation"].includes(category) &&
        kind !== "aiBuildBlueprint",
    ),
  );
  assert.ok(choices.some(({ kind }) => kind === "aiBuildBlueprint"));
  assert.ok(
    nodeChoices(graph, project.graphs, js).some(
      ({ kind }) => kind === "httpGET",
    ),
  );
  const result = buildIR(project);
  const preview = generateSource(result, cpp, false);
  const min = graph.nodes.find(({ kind }) => kind === "minimum");
  const range = preview.source.ranges.find(({ at }) => at.nodeId === min.id);
  assert.match(
    preview.source.code.split("\n")[range.start - 1],
    /bp::minimum\(/,
  );
  assert.match(generateSource(result, js, false).source.code, /Math\.max\(/);
  assert.deepEqual((await interpret(result.program)).output, ["-3", "7"]);
});

const compiler = process.env.BLUEPRINT_CXX || "g++";
const hasCompiler =
  spawnSync(compiler, ["--version"], { stdio: "ignore" }).status === 0;

function lcmProgram() {
  const literal = (value) => ({ kind: "literal", value });
  const read = (name) => ({ kind: "read", name });
  const binary = (op, left, right) => ({ kind: "binary", op, left, right });
  const unary = (op, value) => ({ kind: "unary", op, value });
  const at = (nodeId) => ({ graphId: "lcm", nodeId });
  const candidate = read("4:candidate");
  const remainder = (parameter) =>
    binary("modulo", candidate, unary("number", read(parameter)));
  return {
    functions: [
      {
        name: "1:LCM",
        parameters: ["2:num1", "3:num2"],
        body: [
          {
            kind: "declare",
            name: "4:candidate",
            value: literal(1),
            at: at("declare"),
          },
          {
            kind: "while",
            test: binary(
              "or",
              binary("notEqual", remainder("2:num1"), literal(0)),
              binary("notEqual", remainder("3:num2"), literal(0)),
            ),
            body: [
              {
                kind: "assign",
                name: "4:candidate",
                value: binary("add", candidate, literal(1)),
                at: at("increase"),
              },
            ],
            at: at("loop"),
          },
          { kind: "return", value: candidate, at: at("return") },
        ],
      },
    ],
    main: [
      {
        kind: "call",
        name: "1:LCM",
        result: "5:result",
        args: [literal(48), literal(222)],
        at: at("call"),
      },
      {
        kind: "print",
        value: binary(
          "concat",
          literal("The answer is: "),
          unary("string", read("5:result")),
        ),
        at: at("print"),
      },
    ],
  };
}

function pointerProject() {
  const project = newProject("Aliases");
  const [graph] = project.graphs;
  const variable = add(graph, "declare", { name: "score", value: 2 });
  const pointer = add(graph, "addressOf", {
    name: "score",
    declarationId: variable.id,
  });
  const reference = add(graph, "referenceTo", {
    name: "score",
    declarationId: variable.id,
  });
  const write = add(graph, "writePointer", { value: 41 });
  const dereference = add(graph, "dereference");
  const show = add(graph, "print");
  const change = add(graph, "writeReference", { value: 42 });
  const read = add(graph, "readReference");
  const showAgain = add(graph, "print");
  const nullPointer = add(graph, "nullPointer");
  const isNull = add(graph, "isNullPointer");
  const showNull = add(graph, "print");
  const main = [
    graph.nodes[0],
    variable,
    write,
    show,
    change,
    showAgain,
    showNull,
  ];
  for (let i = 1; i < main.length; i++)
    wire(graph, main[i - 1], "next", main[i], "in");
  for (const [from, to] of [
    [pointer, write],
    [pointer, dereference],
    [reference, change],
    [reference, read],
    [nullPointer, isNull],
  ])
    wire(graph, from, "value", to, "target", "data");
  for (const [from, to] of [
    [dereference, show],
    [read, showAgain],
    [isNull, showNull],
  ])
    wire(graph, from, "value", to, "value", "data");
  return project;
}

function classProject() {
  const project = newProject("Student Class");
  const [graph] = project.graphs;
  const method = createGraph("Rename", "function");
  project.graphs.push(method);
  method.nodes[0].values.parameters = "self";
  const self = add(method, "parameter", { name: "self" });
  const setter = add(method, "setField", { field: "name", value: "Grace" });
  wire(method, method.nodes[0], "next", setter, "in");
  wire(method, self, "value", setter, "object", "data");
  const definition = add(graph, "defineClass", {
    className: "Student",
    fields: { name: "Ada" },
  });
  const first = add(graph, "newInstance");
  const second = add(graph, "newInstance");
  const call = add(graph, "callMethod", { functionName: "Rename" });
  const firstField = add(graph, "getField", { field: "name" });
  const secondField = add(graph, "getField", { field: "name" });
  const printFirst = add(graph, "print");
  const printSecond = add(graph, "print");
  const main = [graph.nodes[0], first, second, call, printFirst, printSecond];
  for (let i = 1; i < main.length; i++)
    wire(graph, main[i - 1], "next", main[i], "in");
  wire(graph, definition, "value", first, "definition", "data");
  wire(graph, definition, "value", second, "definition", "data");
  wire(graph, first, "value", call, "receiver", "data");
  wire(graph, first, "value", firstField, "object", "data");
  wire(graph, second, "value", secondField, "object", "data");
  wire(graph, firstField, "value", printFirst, "value", "data");
  wire(graph, secondField, "value", printSecond, "value", "data");
  return project;
}

test("C++ addresses and references update the original variable, with null and type checks", async () => {
  const project = pointerProject();
  const [graph] = project.graphs;
  assert.ok(
    nodeChoices(graph, project.graphs, cpp).some(
      ({ label }) => label === "Reference to score",
    ),
  );
  assert.ok(
    !nodeChoices(graph, project.graphs, js).some(
      ({ kind }) => kind === "addressOf",
    ),
  );
  assert.equal(projectLanguage(project), "cpp");
  const ir = program(importProject(JSON.stringify(project)));
  assert.deepEqual((await interpret(ir)).output, ["41", "42", "true"]);
  assert.throws(() => js.generate(ir, { comments: false }), /Select C\+\+/);
  graph.nodes.find(({ kind }) => kind === "writePointer").values.value =
    "wrong type";
  assert.match(
    (await interpret(program(project))).final.message,
    /expects a number/,
  );
});

test("class instances keep independent fields and method graphs receive the object", async () => {
  const ir = program(classProject());
  const code = js.generate(ir, { comments: false }).code;
  assert.match(code, /class Student/);
  const output = [];
  new vm.Script(code).runInNewContext({
    structuredClone,
    console: { log: (value) => output.push(value) },
  });
  assert.deepEqual(output, ["Grace", "Ada"]);
  assert.deepEqual((await interpret(ir)).output, output);
});

test("AI plans insert connected nodes without rewriting the existing graph", async () => {
  const project = templates[0].build();
  const [graph] = project.graphs;
  const input = blueprintPrompt("Print a second message", js, graph, project);
  assert.match(input, /Catalog:/);
  assert.doesNotMatch(input, /httpGET|aiBuildBlueprint/);
  const nodes = [
    { id: "message", kind: "print", values: { value: "AI example" } },
  ];
  const edges = [
    { source: "entry", sourcePin: "next", target: "message", targetPin: "in" },
  ];
  const generated = insertBlueprintPlan(
    project,
    graph.id,
    js,
    JSON.stringify({ nodes, edges }),
  );
  assert.equal(project.graphs[0].nodes.length, graph.nodes.length);
  assert.deepEqual(
    generated.project.graphs[0].edges.slice(0, graph.edges.length),
    graph.edges,
  );
  assert.deepEqual((await interpret(program(generated.project))).output, [
    "Hello World",
    "AI example",
  ]);
  assert.throws(
    () =>
      insertBlueprintPlan(
        project,
        graph.id,
        js,
        JSON.stringify({ nodes: [{ ...nodes[0], kind: "httpGET" }], edges }),
      ),
    /catalog/,
  );
  assert.throws(
    () =>
      insertBlueprintPlan(
        project,
        graph.id,
        js,
        JSON.stringify({
          nodes,
          edges: [{ ...edges[0], sourcePin: "invalid" }],
        }),
      ),
    /wire/,
  );
  assert.throws(
    () =>
      insertBlueprintPlan(
        project,
        graph.id,
        js,
        JSON.stringify({
          nodes: [...nodes, { id: "unused", kind: "print", values: {} }],
          edges,
        }),
      ),
    /not reached/,
  );
});

test("the C++ student preview shows readable LCM source and keeps runtime helpers in the export", () => {
  const compilation = { program: lcmProgram(), diagnostics: [] };
  const preview = generateSource(compilation, cpp, false, true).source;
  assert.match(preview.code, /double LCM\(double num1, double num2\)/);
  assert.match(
    preview.code,
    /while \(std::fmod\(candidate, num1\) != 0\.0 \|\|/,
  );
  assert.match(preview.code, /std::cout << "The answer is: " << result/);
  assert.doesNotMatch(preview.code, /bp::|namespace bp|bpv\d/);
  const range = preview.ranges.find(({ at }) => at.nodeId === "loop");
  assert.match(preview.code.split("\n")[range.start - 1], /while/);
  assert.match(
    generateSource(compilation, cpp, false).source.code,
    /namespace bp/,
  );

  const arrays = program(templates.find(({ id }) => id === "array").build());
  const fallback = generateSource(
    { program: arrays, diagnostics: [] },
    cpp,
    false,
    true,
  ).source;
  assert.match(fallback.note, /included in the C\+\+ export/);
  assert.match(fallback.code, /^int main\(\)/);
  assert.doesNotMatch(fallback.code, /namespace bp|bpv\d/);
});

test(
  "C++ exports compile and match the interpreter for all examples",
  { skip: !hasCompiler, timeout: 60_000 },
  async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "lanbp-cpp-"));
    const source = path.join(directory, "program.cpp");
    const target = path.join(directory, "program.exe");
    try {
      for (const example of [
        ...templates,
        { title: "Standard Library Math", build: standardMathProject },
        { title: "Pointers and references", build: pointerProject },
        { title: "Class instances", build: classProject },
      ]) {
        const ir = program(example.build());
        writeFileSync(source, cpp.generate(ir, { comments: false }).code);
        execFileSync(compiler, ["-std=c++11", source, "-o", target], {
          timeout: 8000,
        });
        const output = execFileSync(target, {
          timeout: 3000,
          encoding: "utf8",
        });
        assert.deepEqual(
          output.trimEnd().split(/\r?\n/),
          (await interpret(ir)).output,
          example.title,
        );
      }
      const ir = lcmProgram();
      const preview = generateSource(
        { program: ir, diagnostics: [] },
        cpp,
        false,
        true,
      ).source;
      writeFileSync(source, preview.code);
      execFileSync(compiler, ["-std=c++11", source, "-o", target], {
        timeout: 8000,
      });
      const output = execFileSync(target, { timeout: 3000, encoding: "utf8" });
      assert.equal(output.trimEnd(), "The answer is: 1776");
    } finally {
      rmSync(source, { force: true });
      rmSync(target, { force: true });
      rmdirSync(directory);
    }
  },
);
test("the compiler reports typed pin errors, data cycles and invalid entry points", () => {
  const project = newProject();
  const graph = project.graphs[0];
  const sum1 = add(graph, "add");
  const sum2 = add(graph, "add");
  const text = add(graph, "string");
  wire(graph, sum1, "value", sum2, "a", "data");
  wire(graph, sum2, "value", sum1, "a", "data");
  wire(graph, text, "value", sum1, "b", "data");
  add(graph, "start");
  const { diagnostics, program } = buildIR(project);
  assert.equal(program, undefined);
  assert.deepEqual(
    new Set(diagnostics.map(({ code }) => code)),
    new Set(["DATA_CYCLE", "ENTRY", "WIRE"]),
  );
});

test("lexical declarations are scoped to branches and loops", () => {
  const project = newProject();
  const graph = project.graphs[0];
  const branch = add(graph, "branch", { condition: true });
  const declaration = add(graph, "declare", { name: "hidden", value: 1 });
  const print = add(graph, "print");
  const get = add(graph, "get", { name: "hidden" });
  wire(graph, graph.nodes[0], "next", branch, "in");
  wire(graph, branch, "true", declaration, "in");
  wire(graph, branch, "next", print, "in");
  wire(graph, get, "value", print, "value", "data");
  assert.ok(
    buildIR(project).diagnostics.some(
      (item) => item.code === "SCOPE" && item.nodeId === get.id,
    ),
  );
});

test("named variable nodes retain their declaration and follow name and type edits", async () => {
  const project = newProject();
  const graph = project.graphs[0];
  const declaration = add(graph, "declare", { name: "i", value: 1 });
  const choices = nodeChoices(graph, project.graphs);
  const getter = choices.find((item) => item.label === "Get i");
  const setter = choices.find((item) => item.label === "Set i");
  assert.ok(getter && setter);
  const get = add(graph, getter.kind, getter.values);
  const set = add(graph, setter.kind, { ...setter.values, value: 8 });
  const print = add(graph, "print");
  wire(graph, graph.nodes[0], "next", declaration, "in");
  wire(graph, declaration, "next", set, "in");
  wire(graph, set, "next", print, "in");
  wire(graph, get, "value", print, "value", "data");
  assert.deepEqual((await interpret(program(project))).output, ["8"]);
  const updated = {
    ...declaration,
    values: { name: "message", type: "string", value: "start" },
  };
  const renamed = reconcileVariableReferences({
    ...graph,
    nodes: graph.nodes.map((item) =>
      item.id === declaration.id
        ? updated
        : item.id === set.id
          ? { ...item, values: { ...item.values, value: "end" } }
          : item,
    ),
  });
  project.graphs[0] = renamed;
  const getRenamed = renamed.nodes.find((item) => item.id === get.id);
  assert.equal(nodeTitle(getRenamed), "Get message");
  assert.equal(pinsFor(getRenamed, project.graphs).outputs[0].type, "string");
  assert.deepEqual(
    (await interpret(program(importProject(JSON.stringify(project))))).output,
    ["end"],
  );
});

test("explicit variable references retain their binding when a branch declares the same name", async () => {
  const project = newProject();
  const graph = project.graphs[0];
  const outer = add(graph, "declare", { name: "i", value: 1 });
  const branch = add(graph, "branch", { condition: true });
  const inner = add(graph, "declare", { name: "i", value: 2 });
  const getOuter = add(graph, "get", { name: "i", declarationId: outer.id });
  const print = add(graph, "print");
  wire(graph, graph.nodes[0], "next", outer, "in");
  wire(graph, outer, "next", branch, "in");
  wire(graph, branch, "true", inner, "in");
  wire(graph, inner, "next", print, "in");
  wire(graph, getOuter, "value", print, "value", "data");
  const ir = program(project);
  assert.deepEqual((await interpret(ir)).output, ["1"]);
  const output = [];
  new vm.Script(js.generate(ir, { comments: false }).code).runInNewContext({
    console: { log: (value) => output.push(value) },
  });
  assert.deepEqual(output, [1]);
});

test("function shortcuts preselect the function and preserve parameter wire identifiers", () => {
  const project = templates
    .find((template) => template.id === "function")
    .build();
  const [main, fn] = project.graphs;
  const choice = nodeChoices(main, project.graphs).find(
    (item) => item.label === "Call calculateSum",
  );
  assert.ok(choice);
  const call = createNode(choice.kind, 0, 0, choice.values);
  assert.equal(nodeTitle(call), "Call calculateSum");
  const argumentsOnly = pinsFor(call, project.graphs).inputs.filter(
    ({ type }) => type !== "exec",
  );
  assert.deepEqual(
    argumentsOnly.map(({ id, label }) => [id, label]),
    [
      ["arg1", "a"],
      ["arg2", "b"],
    ],
  );
  assert.ok(
    nodeChoices(fn, project.graphs).some(
      (item) => item.label === "Parameter a",
    ),
  );
});

test("Set Parameter replaces the value inside the active call frame", async () => {
  const project = newProject();
  const [main] = project.graphs;
  const fn = createGraph("updateAmount", "function");
  fn.nodes[0].values.parameters = "amount";
  project.graphs.push(fn);
  const choice = nodeChoices(fn, project.graphs).find(
    (item) => item.label === "Set Parameter amount",
  );
  assert.ok(choice);
  assert.equal(
    nodeChoices(main, project.graphs).some(
      ({ kind }) => kind === "setParameter",
    ),
    false,
  );
  const set = add(fn, choice.kind, { ...choice.values, value: 20 });
  const param = add(fn, "parameter", { name: "amount" });
  const ret = add(fn, "return");
  wire(fn, fn.nodes[0], "next", set, "in");
  wire(fn, set, "next", ret, "in");
  wire(fn, param, "value", ret, "value", "data");
  const original = add(main, "declare", { name: "amount", value: 5 });
  const get = add(main, "get", { name: "amount", declarationId: original.id });
  const call = add(main, "call", { functionName: fn.name });
  const printResult = add(main, "print");
  const printOriginal = add(main, "print");
  wire(main, main.nodes[0], "next", original, "in");
  wire(main, original, "next", call, "in");
  wire(main, get, "value", call, "arg1", "data");
  wire(main, call, "next", printResult, "in");
  wire(main, call, "result", printResult, "value", "data");
  wire(main, printResult, "next", printOriginal, "in");
  wire(main, get, "value", printOriginal, "value", "data");
  const ir = program(project);
  assert.deepEqual((await interpret(ir)).output, ["20", "5"]);
  const output = [];
  new vm.Script(js.generate(ir, { comments: false }).code).runInNewContext({
    console: { log: (value) => output.push(value) },
  });
  assert.deepEqual(output, [20, 5]);
});

test("an execution path with an invalid function argument is rejected and locatable", () => {
  const project = templates.find((item) => item.id === "function").build();
  const node = project.graphs[0].nodes.find((node) => node.kind === "call");
  delete node.values.arg1;
  assert.ok(
    buildIR(project).diagnostics.some(
      (item) =>
        item.code === "INPUT" &&
        item.nodeId === node.id &&
        item.pinId === "arg1",
    ),
  );
});

test("JavaScript escapes user literals, handles names that shadow builtins, and preserves object keys", async () => {
  const project = newProject();
  const graph = project.graphs[0];
  const text = '"); throw new Error("unexpected"); //\n\u2028\u2029';
  const declaration = add(graph, "declare", {
    name: "console",
    type: "string",
    value: text,
  });
  const get = add(graph, "get", { name: "console", type: "string" });
  const print = add(graph, "print");
  const object = add(graph, "object", {
    literal: JSON.parse('{"__proto__":"own"}'),
  });
  const prop = add(graph, "property", { key: "__proto__" });
  const printKey = add(graph, "print");
  wire(graph, graph.nodes[0], "next", declaration, "in");
  wire(graph, declaration, "next", print, "in");
  wire(graph, print, "next", printKey, "in");
  wire(graph, get, "value", print, "value", "data");
  wire(graph, object, "value", prop, "collection", "data");
  wire(graph, prop, "value", printKey, "value", "data");
  const ir = program(project);
  const output = [];
  new vm.Script(js.generate(ir, { comments: false }).code).runInNewContext({
    console: { log: (value) => output.push(value) },
  });
  assert.deepEqual(output, [text, "own"]);
  assert.deepEqual((await interpret(ir)).output, output);
});

test("worker interpreter can pause, step over the loop body, and stop", async () => {
  const project = templates.find((item) => item.id === "table").build();
  const graph = project.graphs[0];
  const loop = graph.nodes.find((node) => node.kind === "for");
  const next = add(graph, "print", { value: "done" });
  wire(graph, loop, "next", next, "in");
  const events = [];
  const pauses = [];
  const runtime = startRuntime(
    program(project),
    (event) => {
      events.push(event);
      if (event.kind === "status" && event.status === "paused") {
        pauses.push(event.at.nodeId);
        runtime.control(pauses.length === 1 ? "over" : "stop");
      }
    },
    { debug: true },
  );
  await runtime.done;
  assert.deepEqual(pauses, [loop.id, next.id]);
  assert.equal(events.at(-1).status, "stopped");
  assert.deepEqual(
    events
      .filter((event) => event.kind === "output")
      .map((event) => event.value),
    expected.table,
  );
});

test("a breakpoint in Debug mode can step into a called function", async () => {
  const project = templates.find((item) => item.id === "function").build();
  project.graphs[0].nodes.find((node) => node.kind === "call").breakpoint =
    true;
  const paused = [];
  const runtime = startRuntime(
    program(project),
    (event) => {
      if (event.kind === "status" && event.status === "paused") {
        paused.push(event.at);
        runtime.control(paused.length === 1 ? "into" : "resume");
      }
    },
    { debug: true },
  );
  await runtime.done;
  assert.deepEqual(
    paused.map((at) => at.graphId),
    project.graphs.map(({ id }) => id),
  );
});

test("recursion and infinite loops terminate with a locatable error", async () => {
  const project = newProject();
  const graph = project.graphs[0];
  const loop = add(graph, "while", { condition: true });
  wire(graph, graph.nodes[0], "next", loop, "in");
  const result = await interpret(program(project), { trace: false });
  assert.equal(result.final.status, "error");
  assert.match(result.final.message, /iteration limit/);
  assert.equal(result.final.at.nodeId, loop.id);

  const recursive = newProject();
  const main = recursive.graphs[0];
  const fn = createGraph("recurse", "function");
  recursive.graphs.push(fn);
  wire(
    main,
    main.nodes[0],
    "next",
    add(main, "call", { functionName: "recurse" }),
    "in",
  );
  const recurse = add(fn, "call", { functionName: "recurse" });
  wire(fn, fn.nodes[0], "next", recurse, "in");
  const recursiveResult = await interpret(program(recursive), { trace: false });
  assert.match(recursiveResult.final.message, /recursion limit/);
  assert.equal(recursiveResult.final.at.nodeId, recurse.id);
});

test("delay emits runnable asynchronous JavaScript and can be stopped", async () => {
  const project = newProject();
  const graph = project.graphs[0];
  const delay = add(graph, "delay", { milliseconds: 1 });
  const print = add(graph, "print");
  wire(graph, graph.nodes[0], "next", delay, "in");
  wire(graph, delay, "next", print, "in");
  const ir = program(project);
  const output = [];
  const source = js.generate(ir, { comments: false }).code;
  await new vm.Script(source).runInNewContext({
    setTimeout,
    console: { log: (value) => output.push(value) },
  });
  assert.deepEqual(output, (await interpret(ir)).output);
  const events = [];
  const runtime = startRuntime(ir, (event) => events.push(event));
  runtime.control("stop");
  await runtime.done;
  assert.equal(events.at(-1).status, "stopped");
});

test("assignment checks require the intended executed action and exact output", () => {
  const lines = ["4", "8", "12", "16", "20"];
  assert.equal(checkAssignment("times-four", lines, new Set()), false);
  assert.equal(
    checkAssignment("times-four", [...lines, "extra"], new Set(["for"])),
    false,
  );
  assert.equal(checkAssignment("times-four", lines, new Set(["for"])), true);
});

test("drafts stay associated with the owning account and a save clears only its exact snapshot", () => {
  const original = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  try {
    const mine = draftStore(1, "same-project-id");
    const theirs = draftStore(2, "same-project-id");
    const initial = { ...newProject("Practice"), assignmentId: "times-four" };
    mine.write(1, initial);
    assert.deepEqual(mine.read(), { revision: 1, project: initial });
    assert.equal(theirs.read(), undefined);
    const revised = { ...initial, title: "Revised" };
    mine.write(1, revised);
    mine.clear(1, initial);
    assert.equal(mine.read()?.project.title, "Revised");
    mine.clear(1, revised);
    assert.equal(mine.read(), undefined);
  } finally {
    globalThis.localStorage = original;
  }
});

test("a slow Blueprint project request times out and can be retried", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const response = { accountId: 1, projects: [] };
  const fetchMock = context.mock.method(
    globalThis,
    "fetch",
    (_, { signal }) => {
      if (fetchMock.mock.callCount() > 0)
        return Promise.resolve(
          Response.json({ success: true, data: response }),
        );
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      });
    },
  );
  const waiting = assert.rejects(projectStore.list(), /took too long/);
  context.mock.timers.tick(15_000);
  await waiting;
  assert.deepEqual(await projectStore.list(), response);
});

test("leaving a Blueprint route aborts its pending project request", async (context) => {
  const controller = new AbortController();
  context.mock.method(
    globalThis,
    "fetch",
    (_, { signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      }),
  );
  const waiting = assert.rejects(
    projectStore.load("previous-project", controller.signal),
    { name: "AbortError" },
  );
  controller.abort();
  await waiting;
});

test("AI requests use the secured Lan’s Hub route and reject plaintext origins", async (context) => {
  const setting = "NEXT_PUBLIC_DATABASE_LINK";
  const original = process.env[setting];
  const originalWindow = globalThis.window;
  const storage = globalThis.sessionStorage;
  globalThis.window = { location: { origin: "https://hub.test" } };
  globalThis.sessionStorage = {
    getItem: () => JSON.stringify({ token: "student-session" }),
  };
  const fetcher = context.mock.method(globalThis, "fetch", async () =>
    Response.json({
      success: true,
      data: { output: "Summary", incomplete: false },
    }),
  );
  try {
    process.env[setting] = "http://api.test";
    await assert.rejects(
      automationStore.run("sk-demo", "summarize", "Text"),
      /secure connection/,
    );
    assert.equal(fetcher.mock.callCount(), 0);
    process.env[setting] = "https://api.test/";
    assert.deepEqual(
      await automationStore.run("sk-demo", "summarize", "Text"),
      { output: "Summary", incomplete: false },
    );
    const [url, request] = fetcher.mock.calls[0].arguments;
    assert.equal(url, "https://api.test/blueprints/api/automation/run");
    assert.equal(request.redirect, "error");
    assert.equal(request.headers.Authorization, "Bearer student-session");
    assert.deepEqual(JSON.parse(request.body), {
      apiKey: "sk-demo",
      operation: "summarize",
      text: "Text",
    });
  } finally {
    if (original === undefined) delete process.env[setting];
    else process.env[setting] = original;
    globalThis.window = originalWindow;
    globalThis.sessionStorage = storage;
  }
});

function endpointProject() {
  const project = newProject("Echo API");
  const [main] = project.graphs;
  const endpoint = createGraph("Echo", "endpoint");
  project.graphs.push(endpoint);
  const entry = endpoint.nodes[0];
  entry.values = { method: "POST", path: "/echo" };
  const reply = add(endpoint, "httpResponse", { status: 201 });
  wire(endpoint, entry, "next", reply, "in");
  wire(endpoint, entry, "body", reply, "body", "data");
  const send = add(main, "httpPOST", {
    path: "/echo",
    body: { message: "Hello API" },
  });
  const print = add(main, "print");
  wire(main, main.nodes[0], "next", send, "in");
  wire(main, send, "next", print, "in");
  wire(main, send, "body", print, "value", "data");
  return project;
}

test("HTTP nodes call the matching endpoint and expose its status and response", async () => {
  const project = endpointProject();
  const ir = program(project);
  assert.deepEqual((await interpret(ir)).output, ['{"message":"Hello API"}']);
  const preview = await interpret(ir, {
    preview: { graphId: project.graphs[1].id, body: { lesson: 4 } },
  });
  assert.deepEqual(
    preview.available.find((event) => event.kind === "response"),
    { kind: "response", status: 201, body: { lesson: 4 } },
  );
  const output = [];
  const code = js.generate(ir, { comments: false }).code;
  await new vm.Script(code).runInNewContext({
    console: { log: (value) => output.push(JSON.stringify(value)) },
  });
  assert.deepEqual(output, ['{"message":"Hello API"}']);
  assert.throws(
    () => cpp.generate(ir, { comments: false }),
    /export to JavaScript/,
  );
  const unsupported = generateSource(buildIR(project), cpp, false);
  assert.equal(unsupported.source, undefined);
  assert.match(unsupported.diagnostics.at(-1).message, /export to JavaScript/);
  assert.ok(generateSource(buildIR(project), js, false).source);
  const duplicate = createGraph("Duplicate", "endpoint");
  duplicate.nodes[0].values = { ...project.graphs[1].nodes[0].values };
  project.graphs.push(duplicate);
  assert.ok(
    buildIR(project).diagnostics.some(
      (item) => item.code === "ENDPOINT_DUPLICATE",
    ),
  );
});

test(
  "JavaScript exports serve project endpoints on a loopback HTTP listener",
  { timeout: 15_000 },
  async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "lanbp-http-"));
    const source = path.join(directory, "project.js");
    writeFileSync(
      source,
      js.generate(program(endpointProject()), { comments: false }).code,
    );
    const child = spawn(process.execPath, [source, "--serve", "0"], {
      windowsHide: true,
    });
    try {
      const address = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(new Error("The exported local HTTP server did not start.")),
          5000,
        );
        child.once("exit", (code) => {
          clearTimeout(timer);
          reject(new Error(`Server exited with ${code}.`));
        });
        child.once("error", (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.stdout.once("data", (buffer) => {
          clearTimeout(timer);
          const match = /http:\/\/127\.0\.0\.1:\d+/.exec(buffer.toString());
          if (match) resolve(match[0]);
          else
            reject(new Error("The export did not report a loopback address."));
        });
      });
      const response = await fetch(`${address}/echo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"safe":true}',
      });
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { safe: true });
      const wrongMethod = await fetch(`${address}/echo`);
      assert.equal(wrongMethod.status, 405);
      const foreign = await fetch(`${address}/echo`, {
        headers: { Origin: "https://outside.test" },
      });
      assert.equal(foreign.status, 403);
    } finally {
      if (child.exitCode === null && child.signalCode === null && child.pid) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
      }
      rmSync(source, { force: true });
      rmdirSync(directory);
    }
  },
);

test("AI nodes pass their text through the runtime host and expose the reply as a data pin", async () => {
  const project = newProject();
  const graph = project.graphs[0];
  const ai = add(graph, "ai_summarize", { input: "Example notes" });
  const print = add(graph, "print");
  wire(graph, graph.nodes[0], "next", ai, "in");
  wire(graph, ai, "next", print, "in");
  wire(graph, ai, "output", print, "value", "data");
  const expected = { kind: "ai", task: "summarize", input: "Example notes" };
  const ir = program(project);
  const output = await interpret(ir, {
    host: async (request) => {
      assert.deepEqual(request, expected);
      return "Example summary";
    },
  });
  assert.deepEqual(output.output, ["Example summary"]);
  assert.match(
    (await interpret(ir)).final.message,
    /Connect the required service/,
  );
  const exported = [];
  await new vm.Script(
    js.generate(ir, { comments: false }).code,
  ).runInNewContext({
    blueprintHost: async (request) => {
      assert.deepEqual({ ...request }, expected);
      return "Example summary";
    },
    console: { log: (value) => exported.push(value) },
  });
  assert.deepEqual(exported, output.output);
});

test("connected HTTP requests stay inside the configured API base and omit credentials", async (context) => {
  const setting = "NEXT_PUBLIC_BLUEPRINT_HTTP_BASE_URL";
  const original = process.env[setting];
  process.env[setting] = "https://api.test/training/";
  const fetcher = context.mock.method(globalThis, "fetch", async () =>
    Response.json({ ok: true }, { status: 201 }),
  );
  try {
    await assert.rejects(
      runConnectedHttp({
        kind: "http",
        method: "GET",
        path: "//outside.test",
        body: null,
      }),
      /relative API path/,
    );
    const response = await runConnectedHttp({
      kind: "http",
      method: "POST",
      path: "/entries",
      body: { test: 1 },
    });
    assert.deepEqual(response, { status: 201, body: { ok: true } });
    const [url, request] = fetcher.mock.calls[0].arguments;
    assert.equal(String(url), "https://api.test/training/entries");
    assert.equal(request.credentials, "omit");
    assert.equal(request.redirect, "error");
    assert.equal(request.headers.Authorization, undefined);
    assert.equal(request.body, '{"test":1}');
  } finally {
    if (original === undefined) delete process.env[setting];
    else process.env[setting] = original;
  }
});
