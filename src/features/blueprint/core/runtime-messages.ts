import type { HostRequest, Program } from "./ir";
import type { Value } from "./model";
import type { Control, RuntimeEvent } from "./runtime";

export type WorkerRequest =
  | {
      kind: "run";
      program: Program;
      debug: boolean;
      speed: number;
      preview?: { graphId: string; body: Value | null };
    }
  | { kind: "control"; command: Control }
  | ({ kind: "host-result"; id: number } & (
      | { ok: true; value: Value }
      | { ok: false; message: string }
    ));
export type WorkerReply =
  | RuntimeEvent[]
  | { kind: "host"; id: number; request: HostRequest };
