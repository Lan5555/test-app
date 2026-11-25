import { CoreService } from "@/app/helpers/api-handler";
import {
  type AutomationTask,
  type HostRequest,
  isEndpointPath,
} from "./core/ir";
import type { Project, Value } from "./core/model";
import { importProject, parseProject } from "./core/schema";

const api = new CoreService();
const endpoint = "/blueprints/api/projects";
export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
  revision: number;
}
export interface SavedProject extends ProjectSummary {
  project: Project;
}
export interface ProjectList {
  accountId: number;
  projects: ProjectSummary[];
}

function data<T>(result: {
  success: boolean;
  data: unknown;
  message: string;
}): T {
  if (!result.success || result.data === null)
    throw new Error(
      typeof result.message === "string" && result.message.trim()
        ? result.message
        : "Blueprint projects are unavailable.",
    );
  return result.data as T;
}

const requestTimeout = 15_000;
async function request<T>(
  send: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeout = requestTimeout,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => {
    controller.abort(
      new Error("Blueprint Studio took too long to respond. Try again."),
    );
  }, timeout);
  try {
    if (controller.signal.aborted) throw controller.signal.reason;
    return await send(controller.signal);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export const projectStore = {
  async list(signal?: AbortSignal) {
    const list = data<ProjectList>(
      await request((active) => api.get(endpoint, active), signal),
    );
    if (!Number.isSafeInteger(list.accountId) || !Array.isArray(list.projects))
      throw new Error("Could not read your Blueprint projects.");
    return list;
  },
  async load(id: string, signal?: AbortSignal) {
    const saved = data<SavedProject>(
      await request((active) => api.get(`${endpoint}/${id}`, active), signal),
    );
    if (saved.id !== id)
      throw new Error("Could not open the requested project.");
    return { ...saved, project: parseProject(saved.project) };
  },
  async create(id: string, project: Project) {
    return data<SavedProject>(
      await request((signal) =>
        api.send(endpoint, { id, project: parseProject(project) }, signal),
      ),
    );
  },
  async update(id: string, revision: number, project: Project) {
    return data<SavedProject>(
      await request((signal) =>
        api.send(
          `${endpoint}/${id}`,
          {
            revision,
            project: parseProject(project),
          },
          signal,
        ),
      ),
    );
  },
  async remove(id: string, revision: number) {
    data<{ id: string }>(
      await request((signal) =>
        api.delete(`${endpoint}/${id}`, { revision }, signal),
      ),
    );
  },
};

export type AutomationOperation = AutomationTask | "buildBlueprint";
export interface AutomationResult {
  output: string;
  incomplete: boolean;
}

export const automationStore = {
  async run(
    apiKey: string,
    operation: AutomationOperation,
    text: string,
    signal?: AbortSignal,
  ) {
    const backend = new URL(
      process.env.NEXT_PUBLIC_DATABASE_LINK || "/",
      window.location.origin,
    );
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      backend.hostname,
    );
    if (
      backend.username ||
      backend.password ||
      backend.search ||
      backend.hash ||
      (backend.protocol !== "https:" &&
        !(loopback && backend.protocol === "http:"))
    )
      throw new Error(
        "AI Automation requires a secure connection to Lan’s Hub.",
      );
    const providerApi = new CoreService();
    providerApi.setBaseUrl(backend.href.replace(/\/+$/, ""));
    const response = await request(
      (active) =>
        providerApi.send(
          "/blueprints/api/automation/run",
          { apiKey, operation, text },
          active,
          "error",
        ),
      signal,
      30_000,
    );
    const result = data<AutomationResult>(response);
    if (typeof result.output !== "string" || !result.output.trim())
      throw new Error("AI Automation returned no readable output.");
    return result;
  },
};

export async function runConnectedHttp(
  action: Extract<HostRequest, { kind: "http" }>,
  signal?: AbortSignal,
): Promise<Value> {
  const configured = process.env.NEXT_PUBLIC_BLUEPRINT_HTTP_BASE_URL;
  if (!configured)
    throw new Error(
      "No API connection is configured. Use a project endpoint or ask an administrator to configure the API connection.",
    );
  const url = new URL(configured);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("The API connection needs a valid HTTPS base URL.");
  if (!isEndpointPath(action.path))
    throw new Error("Use a relative API path like /items.");
  url.pathname = url.pathname.replace(/\/+$/, "") + action.path;
  const body =
    action.method === "GET" || action.body === null
      ? undefined
      : JSON.stringify(action.body);
  if (body && new TextEncoder().encode(body).length > 8192)
    throw new Error("API request bodies are limited to 8 KB.");

  return request(
    async (active) => {
      const response = await fetch(url, {
        method: action.method,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
        signal: active,
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body,
      });
      let data: Value = null;
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let bytes = 0;
        let text = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.length;
            if (bytes > 24576) {
              void reader.cancel();
              throw new Error("API response bodies are limited to 24 KB.");
            }
            text += decoder.decode(value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          reader.releaseLock();
        }
        if (text) {
          try {
            data = JSON.parse(text) as Value;
          } catch {
            data = text;
          }
        }
      }
      return { status: response.status, body: data };
    },
    signal,
    10_000,
  );
}

export function draftStore(accountId: number, id: string) {
  const key = `blueprint:draft:${accountId}:${id}`;
  return {
    read() {
      const raw = localStorage.getItem(key);
      if (!raw) return undefined;
      const draft = JSON.parse(raw);
      if (!Number.isInteger(draft.revision))
        throw new Error("Invalid local draft.");
      return {
        revision: draft.revision as number,
        project: importProject(JSON.stringify(draft.project)),
      };
    },
    write(revision: number, project: Project) {
      localStorage.setItem(key, JSON.stringify({ revision, project }));
    },
    clear(revision: number, project: Project) {
      const raw = localStorage.getItem(key);
      if (raw === JSON.stringify({ revision, project }))
        localStorage.removeItem(key);
    },
  };
}

export function download(name: string, source: string, type: string) {
  const url = URL.createObjectURL(new Blob([source], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
