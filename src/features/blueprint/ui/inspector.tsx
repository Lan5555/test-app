"use client";

import { useEffect, useId, useRef, useState } from "react";
import { nodeTitle, referenceValues, variableChoices } from "../core/catalog";
import { commentFrame } from "../core/comments";
import type { LanguageAdapter } from "../core/ir";
import {
  compatible,
  type Edge,
  type Graph,
  type Node,
  type Pin,
  type Project,
  pinColors,
  type Value,
} from "../core/model";
import {
  getNode,
  parametersOf,
  pinsFor,
  propertyValue,
  variableNameOf,
  variableReferenceId,
} from "../core/registry";
import { nodeLabel } from "./canvas";

function WirePicker({
  node,
  outputs,
  graph,
  graphs,
  disabled,
  connect,
}: {
  node: Node;
  outputs: Pin[];
  graph: Graph;
  graphs: Graph[];
  disabled: boolean;
  connect(edge: Edge): void;
}) {
  const [outputId, setOutputId] = useState("");
  const [destination, setDestination] = useState("");
  const available = outputs.filter(
    (pin) =>
      pin.type !== "exec" ||
      !graph.edges.some(
        (edge) => edge.source === node.id && edge.sourcePin === pin.id,
      ),
  );
  const output = available.find((pin) => pin.id === outputId) ?? available[0];
  const destinations = output
    ? graph.nodes.flatMap((target) => {
        if (target.id === node.id) return [];
        return pinsFor(target, graphs)
          .inputs.filter(
            (pin) =>
              compatible(output.type, pin.type) &&
              !graph.edges.some(
                (edge) =>
                  edge.target === target.id && edge.targetPin === pin.id,
              ),
          )
          .map((pin) => ({
            key: `${target.id}:${pin.id}`,
            name: `${nodeTitle(target, graph.name)} · ${pin.label ?? nodeLabel(pin.id)} (node ${graph.nodes.indexOf(target) + 1})`,
            target: target.id,
            pin: pin.id,
          }));
      })
    : [];
  const to = destinations.find(({ key }) => key === destination);
  if (!available.length) return null;
  return (
    <details className="bp-wire-picker">
      <summary>Connect pins</summary>
      <label>
        Source pin
        <select
          value={output?.id}
          disabled={disabled}
          onChange={(event) => {
            setOutputId(event.currentTarget.value);
            setDestination("");
          }}
        >
          {available.map(({ id, label }) => (
            <option key={id} value={id}>
              {label ?? nodeLabel(id)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Destination pin
        <select
          value={to?.key ?? ""}
          disabled={disabled || !destinations.length}
          onChange={(event) => setDestination(event.currentTarget.value)}
        >
          <option value="">
            {destinations.length ? "Choose an input" : "No compatible inputs"}
          </option>
          {destinations.map(({ key, name }) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={disabled || !to}
        onClick={() => {
          if (!output || !to) return;
          connect({
            id: crypto.randomUUID(),
            source: node.id,
            sourcePin: output.id,
            target: to.target,
            targetPin: to.pin,
            kind: output.type === "exec" ? "exec" : "data",
          });
          setDestination("");
        }}
      >
        Connect
      </button>
    </details>
  );
}

function Field({
  title,
  pin,
  value,
  choices,
  disabled,
  commitOnEnter,
  focusInput,
  onFocused,
  onChange,
  onError,
}: {
  title: string;
  pin: Pin;
  value: Value | undefined;
  choices?: { id: string; label: string }[];
  disabled: boolean;
  commitOnEnter?: boolean;
  focusInput?: boolean;
  onFocused?(): void;
  onChange(value: Value): void;
  onError(message: string): void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!focusInput || disabled || !input.current) return;
    input.current.focus();
    input.current.select();
    onFocused?.();
  }, [disabled, focusInput, onFocused]);
  const structured =
    pin.type === "object" || pin.type === "array" || pin.type === "any";
  return (
    <div className="bp-field">
      <label htmlFor={id}>
        {title} <small>{pin.type}</small>
      </label>
      {choices ? (
        <select
          id={id}
          disabled={disabled}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {!choices.some(({ id }) => id === value) && (
            <option value={String(value ?? "")}>Choose an option</option>
          )}
          {choices.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      ) : pin.type === "boolean" ? (
        <select
          id={id}
          disabled={disabled}
          value={String(value ?? false)}
          onChange={(event) => onChange(event.currentTarget.value === "true")}
        >
          <option value="false">False</option>
          <option value="true">True</option>
        </select>
      ) : structured ? (
        <textarea
          id={id}
          disabled={disabled}
          rows={2}
          key={JSON.stringify(value)}
          defaultValue={value === undefined ? "" : JSON.stringify(value)}
          placeholder={
            pin.type === "any"
              ? '"Text", 42, true…'
              : pin.type === "array"
                ? "[1, 2]"
                : '{"key": "value"}'
          }
          onBlur={(event) => {
            const input = event.currentTarget.value;
            if (
              input === (value === undefined ? "" : JSON.stringify(value)) ||
              !input.trim()
            )
              return;
            try {
              const parsed: Value = JSON.parse(input);
              if (pin.type === "array" && !Array.isArray(parsed))
                throw new Error();
              if (
                pin.type === "object" &&
                (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
              )
                throw new Error();
              onChange(parsed);
            } catch {
              if (pin.type === "any") onChange(input);
              else onError(`Enter a valid JSON ${pin.type}.`);
            }
          }}
        />
      ) : (
        <input
          ref={input}
          id={id}
          disabled={disabled}
          type={pin.type === "number" ? "number" : "text"}
          step={pin.type === "number" ? "any" : undefined}
          key={String(value)}
          defaultValue={String(value ?? "")}
          onKeyDown={(event) => {
            if (commitOnEnter && event.key === "Enter")
              event.currentTarget.blur();
          }}
          onBlur={(event) => {
            const input = event.currentTarget.value;
            if (input === String(value ?? "")) return;
            if (
              pin.type === "number" &&
              (!input.trim() || !Number.isFinite(Number(input)))
            ) {
              onError("Enter a valid number.");
              return;
            }
            onChange(pin.type === "number" ? Number(input) : input);
          }}
        />
      )}
    </div>
  );
}

export default function Inspector({
  node,
  adapter,
  graph,
  graphs,
  disabled,
  focusCommentName,
  onCommentNameFocused,
  update,
  error,
  connect,
}: {
  node?: Node;
  adapter?: LanguageAdapter;
  graph: Graph;
  graphs: Project["graphs"];
  disabled: boolean;
  focusCommentName?: boolean;
  onCommentNameFocused?(): void;
  update(update: (node: Node) => Node): void;
  error(message: string): void;
  connect(edge: Edge): void;
}) {
  const variableSelectId = useId();
  if (!node)
    return (
      <p className="bp-empty">
        Select a node to inspect its pins and defaults.
      </p>
    );
  const definition = getNode(node.kind);
  if (!definition)
    return <p className="bp-empty">The registry does not contain this node.</p>;
  const pins = pinsFor(node, graphs);
  const group = commentFrame(node);
  const reference = variableReferenceId(node);
  const variables = ["get", "set", "addressOf", "referenceTo"].includes(
    node.kind,
  )
    ? variableChoices(graph)
    : [];
  const parameterEntry =
    node.kind === "parameter" || node.kind === "setParameter"
      ? graph.nodes.find((item) => item.kind === "function")
      : undefined;
  const parameters = parameterEntry
    ? [...new Set(parametersOf(parameterEntry))]
    : [];
  const changeValue = (id: string, value: Value) =>
    update((previous) => ({
      ...previous,
      values: { ...previous.values, [id]: value },
    }));
  return (
    <div className="bp-inspector" key={node.id}>
      <h3>{nodeTitle(node, graph.name, adapter)}</h3>
      <p>
        {adapter?.nodePresentation?.[node.kind]?.description ??
          definition.description}
      </p>
      {definition.action && (
        <label className="bp-check">
          <input
            type="checkbox"
            disabled={disabled}
            checked={!!node.breakpoint}
            onChange={(event) => {
              const breakpoint = event.currentTarget.checked;
              update((item) => ({ ...item, breakpoint }));
            }}
          />{" "}
          Breakpoint
        </label>
      )}
      {definition.properties?.length ? <h4>Configuration</h4> : null}
      {(variables.length > 0 || reference) && (
        <div className="bp-field">
          <label htmlFor={variableSelectId}>Variable declaration</label>
          <select
            id={variableSelectId}
            disabled={disabled}
            value={reference ?? ""}
            onChange={(event) => {
              const chosen = variables.find(
                ({ node }) => node.id === event.currentTarget.value,
              )?.node;
              update((previous) => {
                const values = { ...previous.values };
                delete values.declarationId;
                return {
                  ...previous,
                  values: chosen
                    ? { ...values, ...referenceValues(chosen) }
                    : values,
                };
              });
            }}
          >
            <option value="">Enter name manually</option>
            {reference &&
              !variables.some(({ node }) => node.id === reference) && (
                <option value={reference}>
                  {variableNameOf(node)} (declaration missing)
                </option>
              )}
            {variables.map(({ node, label }) => (
              <option key={node.id} value={node.id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}
      {definition.properties?.map((pin) => (
        <Field
          key={pin.id}
          pin={pin}
          title={
            group && pin.id === "text"
              ? "Name"
              : (pin.label ?? nodeLabel(pin.id))
          }
          commitOnEnter={!!group && pin.id === "text"}
          focusInput={focusCommentName && !!group && pin.id === "text"}
          onFocused={onCommentNameFocused}
          value={propertyValue(node, pin)}
          disabled={
            disabled ||
            (!!reference && (pin.id === "name" || pin.id === "type"))
          }
          choices={
            pin.id === "functionName"
              ? graphs
                  .slice(1)
                  .filter((graph) =>
                    graph.nodes.some((node) => node.kind === "function"),
                  )
                  .map(({ name }) => ({ id: name, label: name }))
              : pin.id === "name" && parameters.length
                ? parameters.map((name) => ({ id: name, label: name }))
                : pin.choices?.map((id) => ({ id, label: nodeLabel(id) }))
          }
          onChange={(value) => changeValue(pin.id, value)}
          onError={error}
        />
      ))}
      {pins.inputs.some((pin) => pin.type !== "exec") && (
        <h4>Input defaults</h4>
      )}
      {pins.inputs
        .filter((pin) => pin.type !== "exec")
        .map((pin) => {
          const linked = graph.edges.some(
            (edge) => edge.target === node.id && edge.targetPin === pin.id,
          );
          if (
            pin.type === "class" ||
            pin.type === "pointer" ||
            pin.type === "reference"
          ) {
            return (
              <p key={pin.id}>
                {pin.label ?? nodeLabel(pin.id)}{" "}
                <small>
                  {linked ? "Wired" : `Connect a ${pin.type} output`}
                </small>
              </p>
            );
          }
          return (
            <Field
              key={pin.id}
              title={`${pin.label ?? nodeLabel(pin.id)}${linked ? " · Wired" : ""}`}
              pin={pin}
              value={propertyValue(node, pin)}
              disabled={disabled || linked}
              onChange={(value) => changeValue(pin.id, value)}
              onError={error}
            />
          );
        })}
      {pins.outputs.length > 0 && (
        <>
          <h4>Outputs</h4>
          <ul>
            {pins.outputs.map((pin) => (
              <li key={pin.id}>
                <span style={{ background: pinColors[pin.type] }} />
                {pin.label ?? nodeLabel(pin.id)}{" "}
                <small>{pin.type === "exec" ? "execution" : pin.type}</small>
              </li>
            ))}
          </ul>
          <WirePicker
            node={node}
            outputs={pins.outputs}
            graph={graph}
            graphs={graphs}
            disabled={disabled}
            connect={connect}
          />
        </>
      )}
    </div>
  );
}
