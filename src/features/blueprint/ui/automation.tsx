"use client";

import { Play, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AutomationOperation, AutomationResult } from "../persistence";
import { AiConnection, useBlueprintAi } from "./ai-session";
import { LoadingMessage } from "./loading";

const tasks = [
  {
    id: "summarize",
    label: "Summarize text",
    placeholder: "Paste notes, a passage, or an article.",
  },
  {
    id: "actions",
    label: "Extract action items",
    placeholder: "Paste meeting notes, tasks, or a project brief.",
  },
  {
    id: "explain",
    label: "Explain JavaScript",
    placeholder:
      "Paste a Blueprint’s exported JavaScript or ask about a programming concept.",
  },
] as const;

export default function Automation() {
  const ai = useBlueprintAi();
  const pending = useRef<AbortController | null>(null);
  const [operation, setOperation] = useState<AutomationOperation>("summarize");
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AutomationResult>();
  const [runError, setRunError] = useState("");
  const [notice, setNotice] = useState("");
  const task = tasks.find(({ id }) => id === operation) ?? tasks[0];

  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ai.connected || !input.trim() || pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setRunning(true);
    setRunError("");
    setResult(undefined);
    setNotice("");
    try {
      const response = await ai.run(operation, input, controller.signal);
      if (controller.signal.aborted) return;
      setResult(response);
    } catch (error) {
      if (!controller.signal.aborted)
        setRunError(
          (error as Error).message || "This automation could not run.",
        );
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setRunning(false);
    }
  }

  return (
    <section className="bp-automation" aria-labelledby="bp-automation-title">
      <h2 id="bp-automation-title">AI Automation</h2>
      <p>
        Connect OpenAI, choose a task, and review the result before using it.
      </p>
      <div className="bp-automation-grid">
        <AiConnection disabled={running} />
        <div className="bp-automation-panel">
          <h3>
            <Sparkles size={17} /> Run a task
          </h3>
          <form onSubmit={run}>
            <label htmlFor="bp-ai-task">Task</label>
            <select
              id="bp-ai-task"
              value={operation}
              disabled={running}
              onChange={(event) => {
                const task = tasks.find(
                  ({ id }) => id === event.currentTarget.value,
                );
                if (!task) return;
                setOperation(task.id);
                setResult(undefined);
                setNotice("");
                setRunError("");
              }}
            >
              {tasks.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <label htmlFor="bp-ai-input">Input</label>
            <textarea
              id="bp-ai-input"
              value={input}
              rows={7}
              maxLength={8000}
              placeholder={task.placeholder}
              onChange={(event) => setInput(event.currentTarget.value)}
              disabled={running}
              required
            />
            <button
              className="bp-primary"
              type="submit"
              disabled={!ai.connected || !input.trim() || running}
            >
              <Play size={15} /> Run task
            </button>
          </form>
          {running && <LoadingMessage>Waiting for OpenAI…</LoadingMessage>}
          {runError && <p role="alert">{runError}</p>}
          {result && (
            <div className="bp-automation-result">
              <div className="bp-section-title">
                <h3>Result</h3>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(result.output);
                      setNotice("Result copied.");
                    } catch {
                      setNotice(
                        "Could not copy the result. You can select it and copy it manually.",
                      );
                    }
                  }}
                >
                  Copy result
                </button>
              </div>
              {result.incomplete && (
                <p>
                  OpenAI reached the response length limit. The result below is
                  partial.
                </p>
              )}
              <pre>{result.output}</pre>
              {notice && <output>{notice}</output>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
