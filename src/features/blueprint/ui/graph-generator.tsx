"use client";

import { Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { blueprintPrompt, insertBlueprintPlan } from "../core/graph-builder";
import type { LanguageAdapter } from "../core/ir";
import type { Graph, Project } from "../core/model";
import { useBlueprintAi } from "./ai-session";
import { LoadingMessage } from "./loading";

export function GraphGenerator({
  project,
  graph,
  adapter,
  disabled,
  onInsert,
}: {
  project: Project;
  graph: Graph;
  adapter: LanguageAdapter;
  disabled: boolean;
  onInsert(base: Project, result: ReturnType<typeof insertBlueprintPlan>): void;
}) {
  const ai = useBlueprintAi();
  const id = useId();
  const pending = useRef<AbortController | null>(null);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      pending.current?.abort();
      pending.current = null;
    },
    [],
  );
  useEffect(() => {
    if ((!ai.connected || disabled) && pending.current) {
      pending.current.abort();
      pending.current = null;
      setRunning(false);
    }
  }, [ai.connected, disabled]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !ai.connected || pending.current || !prompt.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    setError("");
    setRunning(true);
    try {
      const input = blueprintPrompt(prompt, adapter, graph, project);
      const response = await ai.run("buildBlueprint", input, controller.signal);
      if (controller.signal.aborted) return;
      if (response.incomplete)
        throw new Error(
          "AI returned an incomplete plan. Try a smaller request.",
        );
      onInsert(
        project,
        insertBlueprintPlan(project, graph.id, adapter, response.output),
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "Blueprint generation failed.",
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setRunning(false);
      }
    }
  }
  return (
    <form className="bp-graph-generator bp-field" onSubmit={generate}>
      <label htmlFor={id}>Prompt</label>
      <textarea
        id={id}
        rows={4}
        maxLength={1000}
        value={prompt}
        disabled={disabled || running}
        onChange={(event) => setPrompt(event.currentTarget.value)}
        placeholder={
          adapter.preview === "document"
            ? "Make a portfolio with a projects section and a footer."
            : "Print the first five multiples of 3."
        }
      />
      {!ai.connected && <small>Connect an OpenAI key in Settings.</small>}
      <button
        type="submit"
        disabled={disabled || running || !ai.connected || !prompt.trim()}
      >
        <Sparkles size={14} /> Generate and Insert
      </button>
      {running && <LoadingMessage>Building Blueprint…</LoadingMessage>}
      {error && (
        <p className="bp-property-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
