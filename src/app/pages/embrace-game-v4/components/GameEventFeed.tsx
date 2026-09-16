import type { GameEvent } from "../types/game";

interface Props {
  events: GameEvent[];
}

export default function GameEventFeed({ events }: Props) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-white/40">
        Server events
      </h3>
      <div className="space-y-3">
        {events
          .slice(-10)
          .reverse()
          .map((event, index) => (
            <div
              key={`${event.type}-${index}`}
              className="border-l border-cyan-200/30 pl-3 text-xs text-white/65"
            >
              <span className="font-bold uppercase tracking-wider text-cyan-100/60">
                {event.type}
              </span>
            </div>
          ))}
      </div>
    </aside>
  );
}
