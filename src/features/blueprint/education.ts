import {
  createGraph,
  createNode,
  type Graph,
  type Node,
  type Project,
} from "./core/model";

function example(
  title: string,
  build: (
    graph: Graph,
    add: (
      kind: string,
      column: number,
      row: number,
      values?: Node["values"],
    ) => Node,
    link: (
      source: Node,
      sourcePin: string,
      target: Node,
      targetPin: string,
      kind?: "exec" | "data",
    ) => void,
  ) => Graph[] | void,
): Project {
  const main = createGraph();
  const add = (
    kind: string,
    column: number,
    row: number,
    values?: Node["values"],
  ) => {
    const node = createNode(kind, 60 + column * 240, 60 + row * 178, values);
    main.nodes.push(node);
    return node;
  };
  const link = (
    source: Node,
    sourcePin: string,
    target: Node,
    targetPin: string,
    kind: "exec" | "data" = "exec",
  ) => {
    main.edges.push({
      id: crypto.randomUUID(),
      source: source.id,
      sourcePin,
      target: target.id,
      targetPin,
      kind,
    });
  };
  const functions = build(main, add, link) ?? [];
  return { version: 1, title, graphs: [main, ...functions], comments: false };
}

export const templates = [
  {
    id: "hello",
    title: "Hello World",
    concept: "Connect an event to a console action.",
    build: () =>
      example("Hello World", ({ nodes }, add, link) =>
        link(nodes[0], "next", add("print", 1, 0), "in"),
      ),
  },
  {
    id: "arithmetic",
    title: "Arithmetic Calculator",
    concept: "Declare two variables, then wire their values into Add.",
    build: () =>
      example("Arithmetic Calculator", ({ nodes }, add, link) => {
        const a = add("declare", 1, 0, { name: "a", value: 10 });
        const b = add("declare", 2, 0, { name: "b", value: 20 });
        const print = add("print", 4, 0);
        const sum = add("add", 3, 1);
        link(nodes[0], "next", a, "in");
        link(a, "next", b, "in");
        link(b, "next", print, "in");
        link(add("get", 2, 1, { name: "a" }), "value", sum, "a", "data");
        link(add("get", 2, 2, { name: "b" }), "value", sum, "b", "data");
        link(sum, "value", print, "value", "data");
      }),
  },
  {
    id: "grade",
    title: "Conditional Grade Calculator",
    concept: "Compare a score and follow the True or False wire.",
    build: () =>
      example("Conditional Grade Calculator", ({ nodes }, add, link) => {
        const branch = add("branch", 2, 0);
        const comparison = add("atLeast", 1, 1, { a: 75, b: 50 });
        link(nodes[0], "next", branch, "in");
        link(comparison, "value", branch, "condition", "data");
        link(branch, "true", add("print", 3, 0, { value: "Pass" }), "in");
        link(branch, "false", add("print", 3, 1, { value: "Fail" }), "in");
      }),
  },
  {
    id: "table",
    title: "Multiplication Table",
    concept: "Use a loop index to produce the first five multiples of three.",
    build: () =>
      example("Multiplication Table", ({ nodes }, add, link) => {
        const loop = add("for", 1, 0, { start: 1, end: 6 });
        const multiply = add("multiply", 2, 1, { b: 3 });
        const print = add("print", 3, 0);
        link(nodes[0], "next", loop, "in");
        link(loop, "body", print, "in");
        link(loop, "index", multiply, "a", "data");
        link(multiply, "value", print, "value", "data");
      }),
  },
  {
    id: "fibonacci",
    title: "Fibonacci Sequence",
    concept: "Update variables inside a loop and observe the next iteration.",
    build: () =>
      example("Fibonacci Sequence", ({ nodes }, add, link) => {
        const a = add("declare", 1, 0, { name: "current", value: 0 });
        const b = add("declare", 2, 0, { name: "next", value: 1 });
        const loop = add("for", 3, 0, { end: 8 });
        const print = add("print", 4, 0);
        const temp = add("declare", 5, 0, { name: "sum" });
        const setA = add("set", 6, 0, { name: "current" });
        const setB = add("set", 7, 0, { name: "next" });
        const getA = add("get", 3, 1, { name: "current" });
        const getB = add("get", 3, 2, { name: "next" });
        const sum = add("add", 4, 1);
        for (const [from, pin, to] of [
          [nodes[0], "next", a],
          [a, "next", b],
          [b, "next", loop],
          [loop, "body", print],
          [print, "next", temp],
          [temp, "next", setA],
          [setA, "next", setB],
        ] as const)
          link(from, pin, to, "in");
        link(getA, "value", print, "value", "data");
        link(getA, "value", sum, "a", "data");
        link(getB, "value", sum, "b", "data");
        link(sum, "value", temp, "value", "data");
        link(getB, "value", setA, "value", "data");
        link(add("get", 6, 1, { name: "sum" }), "value", setB, "value", "data");
      }),
  },
  {
    id: "array",
    title: "Array Operations",
    concept: "Iterate over an array and print each item.",
    build: () =>
      example("Array Operations", ({ nodes }, add, link) => {
        const loop = add("foreach", 1, 0);
        const print = add("print", 2, 0);
        link(nodes[0], "next", loop, "in");
        link(
          add("array", 0, 1, { first: "red", second: "green", third: "blue" }),
          "value",
          loop,
          "collection",
          "data",
        );
        link(loop, "body", print, "in");
        link(loop, "item", print, "value", "data");
      }),
  },
  {
    id: "function",
    title: "Functions and Parameters",
    concept: "Pass arguments to a reusable graph and print its returned value.",
    build: () =>
      example("Functions and Parameters", ({ nodes }, add, link) => {
        const call = add("call", 1, 0, {
          functionName: "calculateSum",
          arg1: 5,
          arg2: 10,
        });
        const print = add("print", 2, 0);
        link(nodes[0], "next", call, "in");
        link(call, "next", print, "in");
        link(call, "result", print, "value", "data");
        const fn = createGraph("calculateSum", "function");
        fn.nodes[0].values.parameters = "a, b";
        const a = createNode("parameter", 25, 260, { name: "a" });
        const b = createNode("parameter", 25, 420, { name: "b" });
        const numberA = createNode("toNumber", 265, 250);
        const numberB = createNode("toNumber", 265, 400);
        const sum = createNode("add", 500, 270);
        const ret = createNode("return", 740, 100);
        fn.nodes.push(a, b, numberA, numberB, sum, ret);
        fn.edges = [
          {
            id: "exec",
            source: fn.nodes[0].id,
            sourcePin: "next",
            target: ret.id,
            targetPin: "in",
            kind: "exec",
          },
          ...(
            [
              [a, numberA, "input"],
              [b, numberB, "input"],
              [numberA, sum, "a"],
              [numberB, sum, "b"],
              [sum, ret, "value"],
            ] as const
          ).map(([source, target, targetPin], index) => ({
            id: `wire-${index}`,
            source: source.id,
            sourcePin: "value",
            target: target.id,
            targetPin,
            kind: "data" as const,
          })),
        ];
        return [fn];
      }),
  },
  {
    id: "json",
    title: "JSON Processing",
    concept: "Serialize an object to a JSON string.",
    build: () =>
      example("JSON Processing", ({ nodes }, add, link) => {
        const print = add("print", 2, 0);
        const json = add("json", 1, 1);
        link(nodes[0], "next", print, "in");
        link(
          add("object", 0, 1, { literal: { student: "Ada", score: 75 } }),
          "value",
          json,
          "input",
          "data",
        );
        link(json, "value", print, "value", "data");
      }),
  },
];

export const assignments = [
  {
    id: "first-output",
    title: "Your first program",
    description: "Print exactly Hello, Blueprint! once.",
    expected: ["Hello, Blueprint!"],
    hint: "Connect On Start to Print and edit its value.",
  },
  {
    id: "times-four",
    title: "Multiples of four",
    description: "Use a loop to print 4, 8, 12, 16 and 20 in order.",
    expected: ["4", "8", "12", "16", "20"],
    hint: "Start counting at 1 and set End to 6.",
    required: "for",
  },
  {
    id: "decisions",
    title: "Pass or try again",
    description: "Use a Branch to print Pass for a score of 75.",
    expected: ["Pass"],
    hint: "Connect the output of At Least to Condition.",
    required: "branch",
  },
];
export function checkAssignment(
  id: string,
  output: string[],
  executed: Set<string>,
) {
  const task = assignments.find((task) => task.id === id);
  return (
    !!task &&
    (!task.required || executed.has(task.required)) &&
    task.expected.length === output.length &&
    task.expected.every((line, index) => line === output[index])
  );
}
