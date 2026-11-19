import { io, type Socket } from "socket.io-client";
import { gameServerUrl, readGameSession } from "./progression";
import type { GameEvent } from "../types/game";

export type { GameEvent } from "../types/game";

export type SocketStatus =
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

type Listener = (event: GameEvent) => void;
type StatusListener = (status: SocketStatus) => void;


/**
 * Events that only flow from the server to the client. Sending them
 * from the client would be meaningless (or dangerous), so we exclude
 * them from the `send` signature to catch misuse at compile time.
 *
 * Everything else in the GameEvent union is client-originated and is
 * therefore allowed — including admin-only events like ELIMINATE and
 * TEAM_TURN, which the admin page sends, and the new battle-lobby
 * events CREATE_ROOM and START_PVP.
 */
type ServerOnlyEvent =
  | { type: "STATE_SYNC" }
  | { type: "STORY_UPDATE" }
  | { type: "BATTLE_UPDATE" }
  | { type: "ROOM_LIST_UPDATE" }
  | { type: "CONNECTED" }
  | { type: "CUTSCENE" }
  | { type: "COMBAT_ROUND_UPDATE" }
  | { type: "ROUND_TIMER" }
  | { type: "BREAK" }
  | { type: "ROOM_CREATED" }
  | { type: "PROFILE_UPDATED" }
  | { type: "ROOM_NOT_FOUND" }
  | { type: "ROOM_REMOVED" }
  | { type: "PLAYER_LIST_UPDATE" };

export type ClientEvent = Exclude<GameEvent, ServerOnlyEvent>;

class GameSocket {
  private connection: Socket | null = null;
  private listeners: Listener[] = [];
  private statusListeners: StatusListener[] = [];
  private status: SocketStatus = "disconnected";

  connect() {
    if (typeof window === "undefined") return this;
    if (this.connection) {
      if (!this.connection.active && !this.connection.connected) {
        this.setStatus("connecting");
        this.connection.connect();
      }
      return this;
    }

    console.debug("[Embrace socket] Connecting", { url: gameServerUrl });
    this.setStatus("connecting");

    this.connection = io(gameServerUrl, {
      autoConnect: false,
      transports: ["polling", "websocket"],
      tryAllTransports: true,
      auth: (done) => done({ gameToken: readGameSession()?.token }),
    });

    this.connection.on("connect", () => {
      console.debug("[Embrace socket] Connected", {
        socketId: this.connection?.id,
      });
      this.setStatus("connected");
    });

    this.connection.on("disconnect", (reason) => {
      console.debug("[Embrace socket] Disconnected", { reason });
      this.setStatus("disconnected");
    });

    this.connection.on("connect_error", (error) => {
      if (this.status !== "error") {
        console.debug("[Embrace socket] Connection unavailable", error.message);
      }
      this.setStatus("error");
    });

    this.connection.on("message", (...args: unknown[]) => {
      // Diagnostic logging — keep during development, remove in prod.
      console.debug("[socket] message received", {
        argCount: args.length,
        argTypes: args.map((a) => typeof a),
      });

      const payload = args[0];

      if (typeof payload !== "string") {
        console.error("[socket] non-string payload", {
          type: typeof payload,
          value: payload,
        });
        return;
      }

      // Phase 1 — parse. Isolated so a malformed payload never
      // masquerades as a downstream error.
      let event: GameEvent;
      try {
        event = JSON.parse(payload) as GameEvent;
      } catch (error) {
        console.error("[socket] JSON.parse failed", {
          error: error instanceof Error ? error.message : String(error),
          payloadPreview: payload.slice(0, 200),
        });
        return;
      }

      // Phase 2 — dispatch. Any error thrown by a listener is
      // reported with the event type and stack trace, so we can
      // pinpoint which handler blew up.
      try {
        this.receive(event);
      } catch (error) {
        console.error("[socket] handler threw", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          eventType: event.type,
        });
      }
    });

    this.connection.connect();
    return this;
  }

  async waitUntilConnected(timeoutMs = 8_000) {
    this.connect();
    const connection = this.connection;
    const unavailable = "Could not connect to the Embrace game server. Try again.";
    if (!connection) throw new Error(unavailable);
    if (connection.connected) return;

    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        clearTimeout(timeout);
        resolve();
      };
      const timeout = setTimeout(() => {
        connection.off("connect", onConnect);
        reject(new Error(unavailable));
      }, timeoutMs);
      connection.once("connect", onConnect);
    });
  }

  disconnect() {
    console.debug("[Embrace socket] Disconnecting");
    this.connection?.disconnect();
    this.connection = null;
    this.setStatus("disconnected");
  }

  send(event: ClientEvent) {
    if (!this.connection) {
      console.warn(
        "[socket] send() called before connect(). Dropping:",
        event.type,
      );
      return;
    }
    const payload = JSON.stringify(event);
    console.debug("[Embrace socket] Sending", event.type);
    this.connection.emit("message", payload);
  }

  onMessage(listener: Listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(
        (candidate) => candidate !== listener,
      );
    };
  }

  onStatus(listener: StatusListener) {
    this.statusListeners.push(listener);
    listener(this.status);
    return () => {
      this.statusListeners = this.statusListeners.filter(
        (candidate) => candidate !== listener,
      );
    };
  }

  private receive(event: GameEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private setStatus(status: SocketStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

export const socket = new GameSocket();
