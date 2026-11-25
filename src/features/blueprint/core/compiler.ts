import {
  type Endpoint,
  type Expr,
  httpMethods,
  type Instruction,
  isEndpointPath,
  type Program,
} from "./ir";
import {
  compatible,
  type Diagnostic,
  type Edge,
  type Graph,
  type Location,
  type Node,
  type Project,
  typeOf,
  type Value,
} from "./model";
import {
  endpointInputs,
  endpointMethod,
  endpointPath,
  type FunctionSignature,
  getNode,
  type LoweringContext,
  parametersOf,
  pinsFor,
  propertyValue,
  type SymbolBinding,
  variableNameOf,
} from "./registry";
import { parseProject } from "./schema";

type Scope = {
  bindings: Map<string, SymbolBinding>;
  parent?: Scope;
  loop: boolean;
};
const pinKey = (node: string, pin: string) => `${node}:${pin}`;
const namePattern = /^[\p{L}_][\p{L}\p{N}_ ]{0,39}$/u;
const literal = (value: Value | undefined): Expr => ({
  kind: "literal",
  value,
});

export function buildIR(input: unknown): {
  diagnostics: Diagnostic[];
  program?: Program;
} {
  let project: Project;
  try {
    project = parseProject(input);
  } catch (error) {
    return {
      diagnostics: [
        {
          severity: "error",
          code: "SCHEMA",
          message: (error as Error).message,
          hint: "Check the project format and size.",
        },
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  let hasErrors = false;
  const functions = new Map<string, FunctionSignature>();
  const endpoints = new Map<string, Endpoint>();
  const report = (
    graph: Graph,
    code: string,
    message: string,
    hint: string,
    node?: Node,
    pinId?: string,
    severity: Diagnostic["severity"] = "error",
  ) => {
    if (severity === "error") hasErrors = true;
    if (diagnostics.length >= 400) {
      const warning = diagnostics.findIndex(
        (entry) => entry.severity === "warning",
      );
      if (severity !== "error" || warning === -1) return;
      diagnostics.splice(warning, 1);
    }
    diagnostics.push({
      graphId: graph.id,
      nodeId: node?.id,
      pinId,
      code,
      message,
      hint,
      severity,
    });
  };
  let symbolId = 0;
  const symbol = (name: string) => `${++symbolId}:${name}`;

  for (const graph of project.graphs.slice(1)) {
    const request = graph.nodes.find((node) => node.kind === "endpoint");
    if (request) {
      const method = httpMethods.find(
        (method) => method === propertyValue(request, endpointMethod),
      );
      const path = propertyValue(request, endpointPath);
      if (!method || typeof path !== "string" || !isEndpointPath(path)) {
        report(
          graph,
          "ENDPOINT",
          "Enter a valid HTTP method and a path like /example.",
          "Use letters, digits, dashes, underscores and slashes.",
          request,
          "path",
        );
      } else if (
        [...endpoints.values()].some(
          (entry) => entry.method === method && entry.path === path,
        )
      ) {
        report(
          graph,
          "ENDPOINT_DUPLICATE",
          `An endpoint already handles ${method} ${path}.`,
          "Choose a different method or path.",
          request,
          "path",
        );
      } else {
        endpoints.set(graph.id, {
          graphId: graph.id,
          method,
          path,
          handler: symbol("httpHandler"),
        });
      }
      continue;
    }
    const entry = graph.nodes.find((node) => node.kind === "function");
    const parameters = entry ? parametersOf(entry) : [];
    if (!namePattern.test(graph.name) || functions.has(graph.name)) {
      report(
        graph,
        "FUNCTION_NAME",
        "Function graph names must be valid and unique.",
        "Choose a different function name.",
        entry,
      );
      continue;
    }
    if (
      parameters.length > 12 ||
      new Set(parameters).size !== parameters.length ||
      parameters.some((name) => !namePattern.test(name))
    )
      report(
        graph,
        "PARAMETERS",
        "Use up to 12 unique, valid parameter names.",
        "Separate parameter names with commas.",
        entry,
        "parameters",
      );
    functions.set(graph.name, {
      symbol: symbol(graph.name),
      parameters: parameters.slice(0, 12),
    });
  }

  function compileGraph(
    graph: Graph,
    entryKind: "start" | "function" | "endpoint",
    parameterSymbols: string[] = [],
  ): Instruction[] {
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const pins = new Map(
      graph.nodes.map((node) => [node.id, pinsFor(node, project.graphs)]),
    );
    const incoming = new Map<string, Edge>();
    const outgoing = new Map<string, Edge>();
    const used = new Set<string>();
    const visiting = new Set<string>();
    const paths = new Set<string>();
    let expressions = 0;

    for (const node of graph.nodes) {
      const definition = getNode(node.kind);
      if (!definition) {
        report(
          graph,
          "NODE",
          `Unknown node type “${node.kind}”.`,
          "Remove or replace this node.",
          node,
        );
        continue;
      }
      for (const prop of definition.properties ?? []) {
        const value = propertyValue(node, prop);
        if (
          !compatible(typeOf(value), prop.type) ||
          (prop.choices && !prop.choices.includes(String(value)))
        )
          report(
            graph,
            "PROPERTY",
            `“${prop.id}” needs a valid ${prop.type}.`,
            "Update the node properties.",
            node,
            prop.id,
          );
      }
    }

    for (const edge of graph.edges) {
      const node = nodes.get(edge.target);
      const from = pins
        .get(edge.source)
        ?.outputs.find((pin) => pin.id === edge.sourcePin);
      const to = pins
        .get(edge.target)
        ?.inputs.find((pin) => pin.id === edge.targetPin);
      const source = pinKey(edge.source, edge.sourcePin);
      const target = pinKey(edge.target, edge.targetPin);
      if (
        !from ||
        !to ||
        edge.kind !== (from.type === "exec" ? "exec" : "data") ||
        !compatible(from.type, to.type)
      ) {
        report(
          graph,
          "WIRE",
          "This wire connects incompatible or missing pins.",
          "Connect matching pin types or use a conversion node.",
          node ?? nodes.get(edge.source),
          edge.targetPin,
        );
      } else if (
        incoming.has(target) ||
        (edge.kind === "exec" && outgoing.has(source))
      ) {
        report(
          graph,
          "MULTIPLE_WIRES",
          "This pin accepts only one wire.",
          "Use Sequence to split execution.",
          node,
          edge.targetPin,
        );
      } else {
        incoming.set(target, edge);
        if (edge.kind === "exec") outgoing.set(source, edge);
      }
    }

    const dataChecked = new Set<string>();
    function checkDataCycle(node: Node, active: Set<string>) {
      if (active.has(node.id)) {
        report(
          graph,
          "DATA_CYCLE",
          "These data wires depend on each other.",
          "Remove the circular wire.",
          node,
        );
        return;
      }
      if (dataChecked.has(node.id)) return;
      active.add(node.id);
      const definition = getNode(node.kind);
      if (definition?.expression && !definition.action) {
        for (const pin of pins.get(node.id)?.inputs ?? []) {
          const edge = incoming.get(pinKey(node.id, pin.id));
          const source = edge && nodes.get(edge.source);
          if (source) checkDataCycle(source, active);
        }
      }
      active.delete(node.id);
      dataChecked.add(node.id);
    }
    for (const node of graph.nodes) checkDataCycle(node, new Set());

    const entry = graph.nodes.filter(
      (node) =>
        getNode(node.kind)?.role === "start" ||
        getNode(node.kind)?.role === "function" ||
        getNode(node.kind)?.role === "endpoint",
    );
    if (entry.length !== 1 || entry[0].kind !== entryKind) {
      report(
        graph,
        "ENTRY",
        entryKind === "start"
          ? "Main needs exactly one On Start node."
          : entryKind === "endpoint"
            ? "An endpoint graph needs exactly one On HTTP Request node."
            : "A function graph needs exactly one Function Entry.",
        "Add the correct entry node and remove extras.",
        entry[0],
      );
      return [];
    }

    function context(node: Node, scope: Scope): LoweringContext {
      const bindings = scope.bindings;
      return {
        input(id) {
          const edge = incoming.get(pinKey(node.id, id));
          const linked = edge && nodes.get(edge.source);
          if (edge && linked) return expression(linked, edge.sourcePin, scope);
          const pin = pins
            .get(node.id)
            ?.inputs.find((candidate) => candidate.id === id);
          const value = Object.hasOwn(node.values, id)
            ? node.values[id]
            : pin?.fallback;
          if (
            value === undefined ||
            !pin ||
            !compatible(typeOf(value), pin.type)
          )
            report(
              graph,
              "INPUT",
              `“${pin?.label ?? id}” needs a ${pin?.type ?? "valid"} value.`,
              "Connect a compatible output or enter a default value.",
              node,
              id,
            );
          return literal(value);
        },
        block(id, options) {
          if (!outgoing.has(pinKey(node.id, id)))
            report(
              graph,
              "EMPTY_BLOCK",
              `The “${id}” path is empty.`,
              "Connect this path if it should do something.",
              node,
              id,
              "warning",
            );
          return chain(node, id, {
            bindings: new Map(Object.entries(options?.bindings ?? {})),
            parent: scope,
            loop: scope.loop || !!options?.loop,
          });
        },
        bind(key, name, type, alias) {
          const internal = key.startsWith("@");
          if (!namePattern.test(name) || (!internal && key.startsWith(":")))
            report(
              graph,
              "NAME",
              "Use a valid variable name.",
              "Start with a letter or underscore and use up to 40 characters.",
              node,
              "name",
            );
          if (!internal && bindings.has(key))
            report(
              graph,
              "DUPLICATE",
              `“${name}” is already declared in this block.`,
              "Choose a different name or use Set Variable.",
              node,
              "name",
            );
          const binding = { symbol: symbol(name), type };
          if (!internal || key.endsWith(":result")) bindings.set(key, binding);
          if (alias) bindings.set(alias, binding);
          return binding;
        },
        resolve(key, type) {
          for (
            let current: Scope | undefined = scope;
            current;
            current = current.parent
          ) {
            const binding = current.bindings.get(key);
            if (binding) {
              if (type && type !== binding.type)
                report(
                  graph,
                  "VARIABLE_TYPE",
                  `This variable is declared as ${binding.type}.`,
                  "Choose the declared variable type.",
                  node,
                  "type",
                );
              return binding;
            }
          }
          const namedReference = key.startsWith("@variable:");
          report(
            graph,
            "SCOPE",
            namedReference
              ? `“${variableNameOf(node)}” is not available on this execution path.`
              : key.startsWith("@")
                ? "This output is unavailable on the current execution path."
                : `“${key.replace(/^:/, "")}” is outside this scope or has not been declared.`,
            namedReference
              ? "Use this variable after its declaration and within its scope."
              : "Use the value after its declaration, call, or inside its loop body.",
            node,
          );
          return { symbol: symbol("missing"), type: "any" };
        },
        function(name, requiresReceiver) {
          const signature = functions.get(name);
          if (signature && requiresReceiver && !signature.parameters.length)
            report(
              graph,
              "METHOD_RECEIVER",
              "A method graph needs a first parameter for its object.",
              "Add a first parameter such as self in Function Entry.",
              node,
              "functionName",
            );
          if (signature) return signature;
          report(
            graph,
            "FUNCTION",
            `Function “${name}” does not exist.`,
            "Choose an existing function graph.",
            node,
            "functionName",
          );
          return { symbol: symbol("missing"), parameters: [] };
        },
        requireLoop() {
          if (!scope.loop)
            report(
              graph,
              "LOOP_SCOPE",
              "This node belongs inside a loop body.",
              "Connect it through a loop’s Body output.",
              node,
            );
        },
        requireFunction() {
          if (entryKind !== "function")
            report(
              graph,
              "FUNCTION_SCOPE",
              "This node belongs in a function graph.",
              "Move the node to a function graph.",
              node,
            );
        },
        requireEndpoint() {
          if (entryKind !== "endpoint")
            report(
              graph,
              "ENDPOINT_SCOPE",
              "HTTP Response belongs inside an endpoint graph.",
              "Add an endpoint and connect this node to On HTTP Request.",
              node,
            );
        },
      };
    }

    function expression(node: Node, output: string, scope: Scope): Expr {
      used.add(node.id);
      if (visiting.has(node.id)) return literal(undefined);
      if (++expressions > 5000) {
        if (expressions === 5001)
          report(
            graph,
            "COMPLEXITY",
            "Too many data expressions are expanded by this graph.",
            "Use a variable for repeated calculations.",
            node,
          );
        return literal(undefined);
      }
      visiting.add(node.id);
      const at: Location = { graphId: graph.id, nodeId: node.id };
      const result = getNode(node.kind)?.expression?.(
        node,
        context(node, scope),
        output,
      );
      visiting.delete(node.id);
      return { ...(result ?? literal(undefined)), at };
    }

    function chain(owner: Node, pin: string, scope: Scope): Instruction[] {
      const result: Instruction[] = [];
      let edge = outgoing.get(pinKey(owner.id, pin));
      while (edge) {
        const node = nodes.get(edge.target);
        if (!node) break;
        if (paths.has(node.id)) {
          report(
            graph,
            "EXECUTION_CYCLE",
            "An execution wire returns to a node already on this path.",
            "Use a structured loop node for repetition.",
            node,
            "in",
          );
          break;
        }
        paths.add(node.id);
        used.add(node.id);
        const action = getNode(node.kind)?.action?.(node, context(node, scope));
        if (action)
          result.push({
            ...action,
            at: { graphId: graph.id, nodeId: node.id },
            breakpoint: node.breakpoint,
          });
        edge = outgoing.get(pinKey(node.id, "next"));
      }
      return result;
    }

    used.add(entry[0].id);
    const signature = functions.get(graph.name);
    const root: Scope = { bindings: new Map(), loop: false };
    if (entryKind === "function")
      signature?.parameters.forEach((name, index) => {
        root.bindings.set(`:${name}`, {
          type: "any",
          symbol: parameterSymbols[index],
        });
      });
    if (entryKind === "endpoint") {
      endpointInputs.forEach((pin, index) => {
        root.bindings.set(`:${pin.id}`, {
          type: pin.type === "exec" ? "any" : pin.type,
          symbol: parameterSymbols[index],
        });
      });
    }
    const result = chain(entry[0], "next", root);
    for (const node of graph.nodes) {
      if (
        !used.has(node.id) &&
        getNode(node.kind)?.role !== "comment" &&
        getNode(node.kind)?.feature !== "design"
      )
        report(
          graph,
          "UNUSED",
          "This node is not reached or read.",
          "Connect it to the program if you want to use it.",
          node,
          undefined,
          "warning",
        );
    }
    return result;
  }

  const main = compileGraph(project.graphs[0], "start");
  const compiled = project.graphs.slice(1).flatMap((graph) => {
    const endpoint = endpoints.get(graph.id);
    if (endpoint) {
      const parameters = endpointInputs.map(({ id }) => symbol(id));
      return [
        {
          name: endpoint.handler,
          parameters,
          body: compileGraph(graph, "endpoint", parameters),
        },
      ];
    }
    const signature = functions.get(graph.name);
    if (!signature) return [];
    const parameters = signature.parameters.map(symbol);
    return [
      {
        name: signature.symbol,
        parameters,
        body: compileGraph(graph, "function", parameters),
      },
    ];
  });
  return {
    diagnostics,
    program: hasErrors
      ? undefined
      : { main, functions: compiled, endpoints: [...endpoints.values()] },
  };
}
