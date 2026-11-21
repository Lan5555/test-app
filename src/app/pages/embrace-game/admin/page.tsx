'use client';

import Link from 'next/link';
import { BookOpen, ClipboardList, ShoppingBag, Swords, Users } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  formatCinders,
  gameApi,
  GameApiError,
  type Catalog,
  type GameProfile,
} from '../lib/progression';
import type { GameState, Player, TeamId } from '../types/game';

type Scene = { id: string; title: string };
type Room = Pick<
  GameState,
  | 'roomCode'
  | 'phase'
  | 'battleMode'
  | 'adventure'
  | 'encounterPath'
  | 'teams'
  | 'battle'
  | 'currentTeamId'
  | 'activePlayerId'
  | 'teamCap'
> & {
  paused?: boolean;
  resolving: boolean;
  startingHp?: number;
  scene?: Scene & { choices: { id: string; text: string; result: string }[] };
  scenes: Scene[];
};
type History = {
  revision: string;
  versions: {
    id: string;
    createdAt: string;
    publisher: string | null;
    initialNodeId: string;
  }[];
};
type Preview = {
  initialNodeId: string;
  scenes: (Scene & { choiceCount: number })[];
};
type Order = {
  id: string;
  username: string;
  gearId: string;
  amountMinor: number;
  currency: string;
  status: string;
  reviewReason?: string;
  createdAt: string;
};
type Activity = {
  id: string;
  username: string | null;
  action: string;
  target: string;
  details: { reason?: string };
  createdAt: string;
};
type Command = {
  action: string;
  value?: number;
  playerId?: string;
  teamId?: TeamId;
  nodeId?: string;
  choiceId?: string;
};
type Tab = 'rooms' | 'story' | 'accounts' | 'shop' | 'activity';

const tabs = [
  { id: 'rooms', label: 'Live rooms', icon: Swords },
  { id: 'story', label: 'Story library', icon: BookOpen },
  { id: 'accounts', label: 'Player accounts', icon: Users },
  { id: 'shop', label: 'Shop items', icon: ShoppingBag },
  { id: 'activity', label: 'Payments & activity', icon: ClipboardList },
] as const;
const shell = 'rounded-2xl border border-white/12 bg-[#1d1a24] p-4 sm:p-5';
const input =
  'block min-w-0 w-full rounded-lg border border-white/20 bg-[#131119] px-3 py-2 text-sm text-white';
const button =
  'rounded-lg border border-amber-200/40 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-100/10 disabled:opacity-40';
const danger =
  'rounded-lg border border-red-300/40 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-300/10 disabled:opacity-40';
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'The game server is unavailable.';
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const timeframe = (date: string) => new Date(date).toLocaleString();
const playersIn = (room: Room) =>
  Object.values(room.teams).flatMap((team) => team.players);

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={shell}>
      <h2 className="mb-4 text-lg font-semibold text-amber-50">{title}</h2>
      {children}
    </section>
  );
}

function NumberCommand({
  name,
  min,
  max,
  initial,
  send,
}: {
  name: string;
  min: number;
  max: number;
  initial: number;
  send: (value: number) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send(Number(new FormData(event.currentTarget).get('value')));
  }
  return (
    <form onSubmit={submit} className="flex items-end gap-2">
      <label className="min-w-0 flex-1 space-y-1 text-sm text-stone-200">
        {name}
        <input
          key={initial}
          name="value"
          type="number"
          min={min}
          max={max}
          step={1}
          defaultValue={initial}
          required
          className={input}
        />
      </label>
      <button className={button}>Apply</button>
    </form>
  );
}

function Rooms({ report }: { report: (error: unknown) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      setRooms(await gameApi<Room[]>('/admin/rooms'));
    } catch (error) {
      report(error);
    } finally {
      setLoading(false);
    }
  }, [report]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const room =
    rooms.find((entry) => entry.roomCode === selectedRoom) ?? rooms[0];
  const players = room ? playersIn(room) : [];
  const player: Player | undefined =
    players.find((entry) => entry.id === selectedPlayer) ?? players[0];

  async function send(command: Command, confirmation?: string) {
    if (!room || busy || (confirmation && !window.confirm(confirmation)))
      return;
    setBusy(true);
    setNotice('');
    try {
      await gameApi(
        `/admin/rooms/${encodeURIComponent(room.roomCode)}/commands`,
        { method: 'POST', body: command },
      );
      setNotice('Room updated.');
      await refresh();
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading live rooms…</p>;
  if (!room)
    return (
      <Panel title="Live rooms">
        <p className="text-stone-300">
          Rooms will appear here when a player joins the story or creates an
          arena.
        </p>
      </Panel>
    );
  return (
    <div className="space-y-4">
      <div className={`${shell} flex flex-wrap items-end gap-4`}>
        <label className="min-w-48 flex-1 space-y-1 text-sm">
          Room
          <select
            className={input}
            value={room.roomCode}
            onChange={(event) => {
              setSelectedRoom(event.target.value);
              setSelectedPlayer('');
              setNotice('');
            }}
          >
            {rooms.map((entry) => (
              <option key={entry.roomCode} value={entry.roomCode}>
                {entry.roomCode === 'global'
                  ? 'Highlands story'
                  : entry.roomCode}{' '}
                · {entry.adventure ? `Adventure · Chapter ${(entry.encounterPath?.index ?? 0) + 1}` : entry.battleMode?.toUpperCase() ?? 'Story'}
              </option>
            ))}
          </select>
        </label>
        <p className="py-2 text-sm text-amber-100">
          {room.paused ? 'Paused' : label(room.phase)} ·{' '}
          {players.filter((entry) => entry.connected).length} online
        </p>
        <button type="button" className={button} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      {notice && (
        <p role="status" className="text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {room.resolving && (
        <p role="status" className="text-sm text-amber-100">
          Wait for the current round to finish.
        </p>
      )}
      <fieldset
        disabled={busy || room.resolving}
        className="grid gap-4 lg:grid-cols-2"
      >
        <Panel title="Session">
          <div className="flex flex-wrap gap-2">
            {room.phase === 'waiting' && (
              <button
                type="button"
                className={button}
                onClick={() => void send({ action: 'start' })}
              >
                Start session
              </button>
            )}
            {(room.phase === 'story' || room.phase === 'battle') && (
              <button
                type="button"
                className={button}
                onClick={() =>
                  void send({ action: room.paused ? 'resume' : 'pause' })
                }
              >
                {room.paused ? 'Resume' : 'Pause'}
              </button>
            )}
            <button
              type="button"
              className={danger}
              onClick={() =>
                void send(
                  { action: 'restart' },
                  'Reset this room and return all players to the lobby?',
                )
              }
            >
              Restart
            </button>
            {room.phase !== 'ended' && (
              <button
                type="button"
                className={danger}
                onClick={() =>
                  void send({ action: 'end' }, 'End the current session?')
                }
              >
                End session
              </button>
            )}
          </div>
          {room.phase === 'waiting' && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <NumberCommand
                name="Starting HP"
                min={250}
                max={10000}
                initial={room.startingHp ?? 2000}
                send={(value) => void send({ action: 'room_hp', value })}
              />
              <NumberCommand
                name="Players per team"
                min={1}
                max={10}
                initial={room.teamCap ?? 4}
                send={(value) => void send({ action: 'capacity', value })}
              />
            </div>
          )}
        </Panel>
        <Panel title="Players">
          {player ? (
            <div className="space-y-3">
              <label className="block space-y-1 text-sm">
                Player
                <select
                  className={input}
                  value={player.id}
                  onChange={(event) => setSelectedPlayer(event.target.value)}
                >
                  {players.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {label(entry.teamId)} ·{' '}
                      {entry.connected ? 'online' : 'offline'}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-stone-300">
                {player.hp} / {player.maxHp} HP · {label(player.status)} ·{' '}
                {player.ready ? 'ready' : 'not ready'}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {player.status === 'alive' && (
                  <NumberCommand
                    key={`hp-${player.id}`}
                    name="Current HP"
                    min={1}
                    max={player.maxHp}
                    initial={Math.max(1, player.hp)}
                    send={(value) =>
                      void send({ action: 'hp', playerId: player.id, value })
                    }
                  />
                )}
                <NumberCommand
                  key={`max-${player.id}`}
                  name="Maximum HP"
                  min={250}
                  max={10000}
                  initial={player.maxHp}
                  send={(value) =>
                    void send({ action: 'max_hp', playerId: player.id, value })
                  }
                />
              </div>
              {room.phase === 'waiting' && (
                <label className="block space-y-1 text-sm">
                  Team
                  <select
                    className={input}
                    value={player.teamId}
                    onChange={(event) =>
                      void send({
                        action: 'move_team',
                        playerId: player.id,
                        teamId: event.target.value as TeamId,
                      })
                    }
                  >
                    {Object.values(room.teams).map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap gap-2">
                {room.phase === 'story' &&
                  player.connected &&
                  player.status === 'alive' && (
                    <button
                      type="button"
                      className={button}
                      onClick={() =>
                        void send({
                          action: 'turn',
                          playerId: player.id,
                          teamId: player.teamId,
                        })
                      }
                    >
                      Give turn
                    </button>
                  )}
                <button
                  type="button"
                  className={button}
                  onClick={() =>
                    void send({ action: 'revive', playerId: player.id })
                  }
                >
                  Restore and revive
                </button>
                <button
                  type="button"
                  className={danger}
                  disabled={player.status !== 'alive'}
                  onClick={() =>
                    void send(
                      { action: 'eliminate', playerId: player.id },
                      `Eliminate ${player.name} from play?`,
                    )
                  }
                >
                  Eliminate
                </button>
                <button
                  type="button"
                  className={danger}
                  onClick={() =>
                    void send(
                      { action: 'kick', playerId: player.id },
                      `Remove ${player.name} from this room until it restarts?`,
                    )
                  }
                >
                  Kick from room
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-300">
              No players in this room yet.
            </p>
          )}
        </Panel>
        {room.phase === 'story' && room.scene && (
          <Panel title={room.scene.title}>
            <p className="mb-3 text-sm text-stone-300">
              Current turn ·{' '}
              {players.find((entry) => entry.id === room.activePlayerId)
                ?.name ?? label(room.currentTeamId)}
            </p>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void send({
                  action: 'scene',
                  nodeId: String(
                    new FormData(event.currentTarget).get('nodeId'),
                  ),
                });
              }}
            >
              <label className="min-w-0 flex-1 space-y-1 text-sm">
                Jump to scene
                <select
                  key={room.scene.id}
                  className={input}
                  name="nodeId"
                  defaultValue={room.scene.id}
                >
                  {room.scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.title}
                    </option>
                  ))}
                </select>
              </label>
              <button className={button}>Go</button>
            </form>
            <div className="mt-4 space-y-2">
              {room.scene.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  disabled={room.paused}
                  className={`${button} block w-full text-left`}
                  onClick={() =>
                    void send(
                      { action: 'choice', choiceId: choice.id },
                      `Play “${choice.text}” for the room?`,
                    )
                  }
                >
                  {choice.text}{' '}
                  <span className="text-xs text-stone-400">
                    · {label(choice.result)}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        )}
        {room.battle && (
          <Panel
            title={
              room.battle.mode === 'cpu' ? room.battle.enemyName : 'Team battle'
            }
          >
            <div className="space-y-3">
              {room.battle.mode === 'cpu' &&
                room.battle.status === 'active' && (
                  <NumberCommand
                    name="Enemy HP"
                    min={1}
                    max={room.battle.enemyMaxHp}
                    initial={room.battle.enemyHp}
                    send={(value) => void send({ action: 'enemy_hp', value })}
                  />
                )}
              {room.battle.status === 'active' && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={button}
                    disabled={room.paused}
                    onClick={() => void send({ action: 'round' })}
                  >
                    Resolve round
                  </button>
                  <button
                    type="button"
                    className={danger}
                    onClick={() =>
                      void send(
                        { action: 'victory' },
                        'Record a victory and finish this battle?',
                      )
                    }
                  >
                    Force victory
                  </button>
                  <button
                    type="button"
                    className={danger}
                    onClick={() =>
                      void send(
                        { action: 'defeat' },
                        'Record a defeat and finish this battle?',
                      )
                    }
                  >
                    Force defeat
                  </button>
                </div>
              )}
              <ul className="space-y-1 text-sm text-stone-300">
                {room.battle.log.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>
          </Panel>
        )}
      </fieldset>
    </div>
  );
}

function StoryLibrary({ report }: { report: (error: unknown) => void }) {
  const [history, setHistory] = useState<History>();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<Preview>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setHistory(await gameApi<History>('/admin/story'));
  }, []);
  useEffect(() => {
    void refresh().catch(report);
  }, [refresh, report]);

  async function upload(publish: boolean) {
    if (!file || (publish && (!preview || !history))) return;
    const form = new FormData();
    form.set('file', file);
    if (publish && history) form.set('expectedRevision', history.revision);
    setBusy(true);
    setNotice('');
    try {
      if (publish) {
        await gameApi('/admin/story/publish', {
          method: 'POST',
          body: form,
          timeoutMs: 20000,
        });
        setNotice('Story published. New sessions will use this version.');
        setPreview(undefined);
        await refresh();
      } else
        setPreview(
          await gameApi<Preview>('/admin/story/preview', {
            method: 'POST',
            body: form,
            timeoutMs: 20000,
          }),
        );
    } catch (error) {
      report(error);
      if (error instanceof GameApiError && error.status === 409) {
        setPreview(undefined);
        await refresh().catch(report);
      }
    } finally {
      setBusy(false);
    }
  }

  async function restore(revision: string) {
    if (
      !history ||
      !window.confirm('Publish this older story for all new sessions?')
    )
      return;
    setBusy(true);
    try {
      await gameApi(`/admin/story/revisions/${revision}/restore`, {
        method: 'POST',
        body: { expectedRevision: history.revision },
      });
      setNotice('Version restored as the published story.');
      setPreview(undefined);
      await refresh();
    } catch (error) {
      report(error);
      await refresh().catch(report);
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    try {
      const story = await gameApi<unknown>('/admin/story/document');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(story, null, 2)], {
          type: 'application/json',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'highlands-story.json';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      report(error);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Upload a story">
        <p className="mb-4 text-sm text-stone-300">
          Upload a JSON file up to 1 MB. Download the published story for the
          format and a copy you can edit.
        </p>
        <label className="block space-y-1 text-sm">
          Story JSON
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            className={input}
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setPreview(undefined);
              setNotice('');
            }}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            disabled={busy || !file}
            onClick={() => void upload(false)}
          >
            Validate and preview
          </button>
          <button
            type="button"
            className={button}
            onClick={() => void download()}
          >
            Download published JSON
          </button>
        </div>
        {preview && (
          <div className="mt-4 rounded-xl border border-emerald-300/30 p-3">
            <p role="status" className="text-sm text-emerald-200">
              {preview.scenes.length} valid scenes. Starts at{' '}
              {
                preview.scenes.find(
                  (scene) => scene.id === preview.initialNodeId,
                )?.title
              }
              .
            </p>
            <ul className="my-3 max-h-56 space-y-1 overflow-auto text-sm text-stone-300">
              {preview.scenes.map((scene) => (
                <li key={scene.id}>
                  {scene.title} · {scene.choiceCount} choices
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={button}
              disabled={busy || !history}
              onClick={() => void upload(true)}
            >
              Publish for new sessions
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm text-emerald-200">
            {notice}
          </p>
        )}
      </Panel>
      <Panel title="Publication history">
        {!history?.versions.length ? (
          <p className="text-sm text-stone-300">
            The original story is published. A backup will be saved with your
            first upload.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.versions.map((version) => (
              <li
                key={version.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3"
              >
                <div className="text-sm">
                  <p>
                    {timeframe(version.createdAt)} ·{' '}
                    {version.publisher ?? 'Original story'}
                  </p>
                  <p className="text-stone-400">
                    Starts at {version.initialNodeId}
                  </p>
                </div>
                {version.id === history.revision ? (
                  <span className="text-sm text-emerald-200">Published</span>
                ) : (
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => void restore(version.id)}
                  >
                    Restore
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Accounts({ report }: { report: (error: unknown) => void }) {
  const [accounts, setAccounts] = useState<GameProfile[]>([]);
  const [catalog, setCatalog] = useState<Catalog>();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [action, setAction] = useState('credits');
  const pending = useRef<{ key: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const account =
    accounts.find((entry) => entry.id === selected) ?? accounts[0];
  const load = useCallback(async (prefix: string) => {
    setAccounts(
      await gameApi<GameProfile[]>(
        `/admin/accounts?search=${encodeURIComponent(prefix)}`,
      ),
    );
  }, []);
  useEffect(() => {
    void load('').catch(report);
    void gameApi<Catalog>('/catalog').then(setCatalog).catch(report);
  }, [load, report]);

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!account) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setNotice('');
    const body = {
      action,
      reason: form.get('reason'),
      ...(action !== 'grant_gear'
        ? { amount: Number(form.get('amount')) }
        : {}),
      ...(action !== 'credits' ? { product: form.get('product') } : {}),
    };
    const key = JSON.stringify([account.id, body]);
    if (pending.current?.key !== key)
      pending.current = { key, id: crypto.randomUUID() };
    try {
      await gameApi(`/admin/accounts/${account.id}/adjustments`, {
        method: 'POST',
        body: { ...body, requestId: pending.current.id },
      });
      pending.current = null;
      await load(search);
      setNotice('Inventory adjustment recorded.');
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }
  const products = action === 'grant_gear' ? catalog?.gear : catalog?.items;
  return (
    <Panel title="Player inventory">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(search).catch(report);
        }}
      >
        <label className="min-w-0 flex-1 space-y-1 text-sm">
          Search by username
          <input
            className={input}
            value={search}
            maxLength={24}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button className={button}>Search</button>
      </form>
      {account && (
        <form className="mt-4 space-y-4" onSubmit={adjust}>
          <label className="block space-y-1 text-sm">
            Account
            <select
              className={input}
              value={account.id}
              onChange={(event) => {
                setSelected(event.target.value);
                setNotice('');
              }}
            >
              {accounts.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.username}
                  {entry.moderator ? ' · Moderator' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-white/10 p-3 text-sm">
            <p className="font-semibold text-amber-100">
              {formatCinders(account.credits)}
            </p>
            <p className="mt-2 text-stone-300">
              Gear ·{' '}
              {account.gear
                .map((id) => catalog?.gear[id]?.name ?? label(id))
                .join(', ')}
            </p>
            <p className="mt-1 text-stone-300">
              Items ·{' '}
              {Object.entries(account.items)
                .map(
                  ([id, count]) =>
                    `${catalog?.items[id]?.name ?? label(id)} × ${count}`,
                )
                .join(', ') || 'None'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              Adjustment
              <select
                className={input}
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="credits">Adjust Cinders</option>
                <option value="grant_gear">Grant equipment</option>
                <option value="items">Adjust battle items</option>
              </select>
            </label>
            {action !== 'credits' && (
              <label className="space-y-1 text-sm">
                {action === 'grant_gear' ? 'Equipment' : 'Item'}
                <select key={action} name="product" className={input} required>
                  <option value="">Choose an item</option>
                  {Object.entries(products ?? {}).map(([id, product]) => (
                    <option key={id} value={id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {action !== 'grant_gear' && (
              <label className="space-y-1 text-sm">
                Change in quantity (positive or negative)
                <input
                  name="amount"
                  type="number"
                  step={1}
                  required
                  className={input}
                />
              </label>
            )}
            <label className="space-y-1 text-sm">
              Reason
              <input name="reason" required maxLength={300} className={input} />
            </label>
          </div>
          <button className={button} disabled={busy}>
            Save adjustment
          </button>
          {notice && (
            <p role="status" className="text-sm text-emerald-200">
              {notice}
            </p>
          )}
        </form>
      )}
      {!account && (
        <p className="mt-4 text-sm text-stone-300">
          No accounts match this search.
        </p>
      )}
    </Panel>
  );
}

function ShopItems({ report }: { report: (error: unknown) => void }) {
  const [effect, setEffect] = useState<'heal' | 'guard'>('heal');
  const [paidGear, setPaidGear] = useState(false);
  const [items, setItems] = useState<Catalog['items']>({});
  const [gear, setGear] = useState<Catalog['gear']>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const pending = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    let active = true;
    gameApi<Catalog>('/catalog').then(
      (catalog) => {
        if (active) {
          setItems(catalog.items);
          setGear(catalog.gear);
        }
      },
      (error: unknown) => { if (active) report(error); },
    );
    return () => { active = false; };
  }, [report]);

  async function createGear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const cashAmountMinor = paidGear ? Number(data.get('cashAmountMinor')) : undefined;
    const newGear = {
      gearId: String(data.get('gearId')).trim().toLowerCase(),
      name: String(data.get('gearName')).trim(),
      slot: String(data.get('slot')) === 'armor' ? 'armor' as const : 'weapon' as const,
      rarity: String(data.get('rarity')) as 'common' | 'rare' | 'legendary',
      attack: Number(data.get('attack')),
      armor: Number(data.get('armor')),
      price: Number(data.get('price')),
      paid: paidGear,
      ...(cashAmountMinor ? { cashAmountMinor } : {}),
      ...(String(data.get('imageUrl')).trim() ? { imageUrl: String(data.get('imageUrl')).trim() } : {}),
    };
    setBusy(true);
    setNotice('');
    try {
      const created = await gameApi<{ success: boolean; message: string }>('/admin/shop/gear', { method: 'POST', body: newGear });
      if (!created.success) throw new Error(created.message);
      const catalog = await gameApi<Catalog>('/catalog');
      setGear(catalog.gear);
      setNotice(`${newGear.name} was published.`);
      form.reset();
      setPaidGear(false);
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const item = {
      name: String(data.get('name')).trim(),
      effect,
      power: Number(data.get('power')),
      price: Number(data.get('price')),
    };
    const key = JSON.stringify(item);
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    setBusy(true);
    setNotice('');
    try {
      const created = await gameApi<Catalog['items'][string] & { id: string }>('/admin/shop/items', {
        method: 'POST',
        body: { requestId: pending.current.id, ...item },
      });
      setItems((previous) => ({ ...previous, [created.id]: created }));
      setNotice(`${created.name} is available in the Cinder shop.`);
      pending.current = null;
      form.reset();
      setEffect('heal');
    } catch (error) {
      report(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Create gear">
        <form onSubmit={createGear}>
          <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <label>Gear ID<input className={input} name="gearId" pattern="[a-z][a-z0-9_]*" minLength={2} maxLength={60} required /></label>
            <label>Gear name<input className={input} name="gearName" minLength={2} maxLength={60} required /></label>
            <label>Slot<select className={input} name="slot"><option value="weapon">Weapon</option><option value="armor">Armor</option></select></label>
            <label>Rarity<select className={input} name="rarity"><option value="common">Common</option><option value="rare">Rare</option><option value="legendary">Legendary</option></select></label>
            <label>Attack<input className={input} name="attack" type="number" min={0} max={100000} defaultValue={0} required /></label>
            <label>Armor<input className={input} name="armor" type="number" min={0} max={100000} defaultValue={0} required /></label>
            <label>Cinder price<input className={input} name="price" type="number" min={paidGear ? 0 : 1} max={100000} defaultValue={paidGear ? 0 : 1} required /></label>
            <label className="flex items-center gap-2 py-2">
              <input type="checkbox" checked={paidGear} onChange={(event) => setPaidGear(event.target.checked)} />
              Paid cash gear
            </label>
            {paidGear && <label>Cash price in kobo<input className={input} name="cashAmountMinor" type="number" min={100} max={100000000} required /></label>}
            <label className="sm:col-span-2">Image URL <span className="text-stone-400">(optional)</span><input className={input} name="imageUrl" type="url" placeholder="https://... or /forge/shop/example.webp" /></label>
            <button type="submit" className={button}>{busy ? 'Publishing…' : 'Publish gear'}</button>
          </fieldset>
        </form>
      </Panel>
      <Panel title="Create a battle item">
      <form onSubmit={create}>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label>Item name<input className={input} name="name" minLength={2} maxLength={60} required /></label>
          <label>Effect
            <select className={input} value={effect} onChange={(event) => setEffect(event.target.value === 'guard' ? 'guard' : 'heal')}>
              <option value="heal">Restore health</option>
              <option value="guard">Raise guard and add Focus</option>
            </select>
          </label>
          <label>{effect === 'heal' ? 'Health restored' : 'Focus gained'}
            <input className={input} name="power" type="number" min={1} max={effect === 'heal' ? 320 : 25} required />
          </label>
          <label>Price in Cinders<input className={input} name="price" type="number" min={1} max={100000} required /></label>
          <button type="submit" className={button}>{busy ? 'Publishing…' : 'Publish to the shop'}</button>
        </fieldset>
      </form>
      {notice && <p className="mt-3 text-emerald-200" role="status">{notice}</p>}
      <ul className="mt-4 grid gap-2">
        {Object.entries(items).filter(([id]) => id.startsWith('custom_')).map(([id, item]) => (
          <li key={id} className="rounded-lg border border-white/15 p-3">
            <strong>{item.name}</strong> · {formatCinders(item.price)}
            <p className="text-sm text-stone-300">{item.description}</p>
          </li>
        ))}
      </ul>
      </Panel>
      <Panel title="Catalog gear">
        <ul className="grid gap-2">
          {Object.entries(gear).map(([id, entry]) => (
            <li key={id} className="rounded-lg border border-white/15 p-3">
              <strong>{entry.name}</strong> · {entry.slot} · {entry.rarity}
              <p className="text-sm text-stone-300">Attack {entry.attack} · Armor {entry.armor} · {formatCinders(entry.price)}{entry.paid && entry.cashAmountMinor ? ` · Cash ₦${(entry.cashAmountMinor / 100).toLocaleString()}` : ''}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function Operations({ report }: { report: (error: unknown) => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const load = useCallback(async () => {
    const [payments, log] = await Promise.all([
      gameApi<Order[]>('/admin/orders'),
      gameApi<Activity[]>('/admin/activity'),
    ]);
    setOrders(payments);
    setActivity(log);
  }, []);
  useEffect(() => {
    void load().catch(report);
  }, [load, report]);

  return (
    <div className="space-y-4">
      <button
        type="button"
        className={button}
        onClick={() => void load().catch(report)}
      >
        Refresh activity
      </button>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Flutterwave orders">
          <ul className="space-y-3">
            {orders.map((order) => (
              <li
                key={order.id}
                className="border-b border-white/10 pb-3 text-sm"
              >
                <p className="font-semibold">
                  {order.username} · {label(order.gearId)} ·{' '}
                  {new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: order.currency,
                  }).format(order.amountMinor / 100)}
                </p>
                <p className="text-stone-300">
                  {label(order.status)}
                  {order.reviewReason
                    ? ` · ${label(order.reviewReason)}`
                    : ''}{' '}
                  · {timeframe(order.createdAt)}
                </p>
                <p className="select-all break-all text-xs text-stone-400">
                  {order.id}
                </p>
              </li>
            ))}
          </ul>
          {!orders.length && (
            <p className="text-sm text-stone-300">No cash orders yet.</p>
          )}
        </Panel>
        <Panel title="Moderator activity">
          <ul className="space-y-3">
            {activity.map((entry) => (
              <li
                key={entry.id}
                className="border-b border-white/10 pb-3 text-sm"
              >
                <p className="font-semibold">
                  {entry.username ?? 'Moderator'} · {label(entry.action)}
                </p>
                <p className="text-stone-300">
                  {timeframe(entry.createdAt)}
                  {entry.details.reason ? ` · ${entry.details.reason}` : ''}
                </p>
                <p className="break-all text-xs text-stone-400">
                  {entry.target}
                </p>
              </li>
            ))}
          </ul>
          {!activity.length && (
            <p className="text-sm text-stone-300">
              No moderator actions recorded yet.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [moderator, setModerator] = useState<GameProfile>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('rooms');
  const [error, setError] = useState('');
  const report = useCallback((reason: unknown) => {
    setError(errorText(reason));
    if (reason instanceof GameApiError && [401, 403].includes(reason.status))
      setModerator(undefined);
  }, []);

  useEffect(() => {
    gameApi<GameProfile>('/profile')
      .then((profile) => {
        if (profile.moderator) setModerator(profile);
      })
      .catch(report)
      .finally(() => setLoading(false));
  }, [report]);

  return (
    <main className="min-h-screen bg-[#131119] px-4 py-8 text-stone-100 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-amber-100/20 pb-5">
          <div>
            <h1 className="font-serif text-4xl text-amber-100">
              Game administration
            </h1>
            {moderator && (
              <p className="mt-2 text-sm text-stone-300">
                Signed in as {moderator.username}
              </p>
            )}
          </div>
          <Link className={button} href="/pages/embrace-game">
            Back to the Highlands
          </Link>
        </header>
        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl border border-red-200/35 bg-red-950/60 p-3 text-sm text-red-100"
          >
            {error}
            <button
              type="button"
              className={danger}
              onClick={() => setError('')}
            >
              Dismiss
            </button>
          </div>
        )}
        {loading ? (
          <p>Checking moderator access…</p>
        ) : moderator ? (
          <>
            <nav
              aria-label="Game administration"
              className="grid grid-cols-2 gap-2 lg:grid-cols-4"
            >
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={tab === id ? 'page' : undefined}
                  className={`${button} ${tab === id ? 'bg-amber-100/15' : ''}`}
                  onClick={() => {
                    setTab(id);
                    setError('');
                  }}
                >
                  <Icon aria-hidden="true" size={16} className="mr-2 inline" />
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'rooms' && <Rooms report={report} />}
            {tab === 'story' && <StoryLibrary report={report} />}
            {tab === 'accounts' && <Accounts report={report} />}
            {tab === 'shop' && <ShopItems report={report} />}
            {tab === 'activity' && <Operations report={report} />}
          </>
        ) : (
          <p>Sign in with a moderator game account from the Highlands menu.</p>
        )}
      </div>
    </main>
  );
}
