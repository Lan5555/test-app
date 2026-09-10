import { io, type Socket } from "socket.io-client";
import type { GameEvent } from "../types/game";

export type { GameEvent } from "../types/game";

export type SocketStatus =
  | "connecting"
  | "connected"
  | "error"
  | "disconnected";

type Listener = (event: GameEvent) => void;
type StatusListener = (status: SocketStatus) => void;

const gameServerUrl =
  process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? "http://localhost:4000";

/**
 * Events that only flow from the server to the client. Sending them
 * from the client would be meaningless (or dangerous), so we exclude
 * them from the `send` signature to catch misuse at compile time.
 *
 * Everything else in the GameEvent union is client-originated and is
 * therefore allowed — including admin-only events like ELIMINATE and
 * TEAM_TURN, which the admin page sends.
 */
type ServerOnlyEvent =
  | { type: "STATE_SYNC" }
  | { type: "STORY_UPDATE" }
  | { type: "BATTLE_UPDATE" }
  | { type: "ROOM_LIST_UPDATE" };

export type ClientEvent = Exclude<GameEvent, ServerOnlyEvent>;

class GameSocket {
  private connection: Socket | null = null;
  private listeners: Listener[] = [];
  private statusListeners: StatusListener[] = [];
  private status: SocketStatus = "disconnected";

  connect() {
    if (typeof window === "undefined" || this.connection) return this;

    console.debug("[Embrace socket] Connecting", { url: gameServerUrl });
    this.setStatus("connecting");

    this.connection = io(gameServerUrl, { transports: ["websocket"] });

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
      console.error("[Embrace socket] Connection error", error.message);
      this.setStatus("error");
    });

    this.connection.on("message", (payload: unknown) => {
      if (typeof payload !== "string") {
        console.error("[Embrace socket] Ignoring non-string message", payload);
        return;
      }
      try {
        const event = JSON.parse(payload) as GameEvent;
        console.debug("[Embrace socket] Received", event);
        this.receive(event);
      } catch (error) {
        console.error("[Embrace socket] Invalid JSON message", {
          payload,
          error,
        });
      }
    });

    return this;
  }

  disconnect() {
    console.debug("[Embrace socket] Disconnecting");
    this.connection?.disconnect();
    this.connection = null;
    this.setStatus("disconnected");
  }

  send(event: ClientEvent) {
    const payload = JSON.stringify(event);
    console.debug("[Embrace socket] Sending", payload);
    this.connection?.emit("message", payload);
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
    console.debug("[Embrace socket] Dispatching game event", event);
    for (const listener of this.listeners) listener(event);
  }

  private setStatus(status: SocketStatus) {
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

export const socket = new GameSocket();