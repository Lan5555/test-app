import type { Value } from "./model";
import { type RuntimeEvent, startRuntime } from "./runtime";
import type { WorkerReply, WorkerRequest } from "./runtime-messages";

let execution: ReturnType<typeof startRuntime> | undefined;
let requestId = 0;
const pending = new Map<
  number,
  { resolve(value: Value): void; reject(error: Error): void }
>();
let traces: RuntimeEvent[] = [];
let frame: ReturnType<typeof setTimeout> | undefined;
function flush() {
  clearTimeout(frame);
  frame = undefined;
  if (traces.length) self.postMessage(traces);
  traces = [];
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.kind === "host-result") {
    const response = pending.get(request.id);
    pending.delete(request.id);
    if (request.ok) response?.resolve(request.value);
    else response?.reject(new Error(request.message));
    return;
  }
  if (request.kind === "control") {
    execution?.control(request.command);
    return;
  }
  if (execution) return;
  execution = startRuntime(
    request.program,
    (event) => {
      traces.push(event);
      if (event.kind === "status" || traces.length >= 16) flush();
      else frame ??= setTimeout(flush, 16);
    },
    {
      debug: request.debug,
      speed: request.speed,
      preview: request.preview,
      host: (request) =>
        new Promise((resolve, reject) => {
          const id = ++requestId;
          pending.set(id, { resolve, reject });
          self.postMessage({ kind: "host", id, request } satisfies WorkerReply);
        }),
    },
  );
};
