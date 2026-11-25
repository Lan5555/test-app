"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../core/model";
import { parseProject } from "../core/schema";
import { draftStore, projectStore, type SavedProject } from "../persistence";

export function useProject(saved: SavedProject, accountId: number) {
  const [project, setProject] = useState(saved.project);
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [status, setStatus] = useState("Saved");
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{
    project: Project;
    revision: number;
    remote: SavedProject;
  }>();
  const drafts = useMemo(
    () => draftStore(accountId, saved.id),
    [accountId, saved.id],
  );
  const latest = useRef(saved.project);
  const synced = useRef(saved.project);
  const revision = useRef(saved.revision);
  const busy = useRef(false);
  const conflicted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const writeDraft = useCallback(() => {
    try {
      drafts.write(revision.current, latest.current);
      return true;
    } catch {
      return false;
    }
  }, [drafts]);

  const save = useCallback(
    async function persist() {
      clearTimeout(timer.current);
      if (
        busy.current ||
        conflicted.current ||
        latest.current === synced.current
      )
        return;
      const pending = latest.current;
      const expected = revision.current;
      let committed = false;
      busy.current = true;
      setSaving(true);
      setStatus("Saving…");
      try {
        const next = await projectStore.update(saved.id, expected, pending);
        revision.current = next.revision;
        synced.current = pending;
        committed = true;
        setStatus("Saved");
        try {
          drafts.clear(expected, pending);
        } catch {
          /* Storage can be unavailable. */
        }
      } catch (error) {
        setStatus((error as Error).message || "Save failed.");
        try {
          const remote = await projectStore.load(saved.id);
          if (remote.revision > expected) {
            conflicted.current = true;
            setConflict({
              project: latest.current,
              revision: expected,
              remote,
            });
          }
        } catch {
          // Keep the local draft when the server cannot be reached.
        }
      } finally {
        busy.current = false;
        if (committed && latest.current !== synced.current) {
          writeDraft();
          void persist();
        } else {
          setSaving(false);
        }
      }
    },
    [drafts, saved.id, writeDraft],
  );

  const replace = useCallback(
    (next: Project) => {
      latest.current = next;
      setProject(next);
      setStatus(
        writeDraft() ? "Draft saved on this device" : "Saving changes…",
      );
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 750);
    },
    [save, writeDraft],
  );

  useEffect(() => {
    try {
      const draft = drafts.read();
      if (draft?.revision === saved.revision) replace(draft.project);
      else if (draft) {
        conflicted.current = true;
        setConflict({ ...draft, remote: saved });
      }
    } catch {
      setStatus("Could not recover the local draft.");
    }
    return () => clearTimeout(timer.current);
  }, [drafts, replace, saved]);

  function change(update: (previous: Project) => Project) {
    const previous = latest.current;
    try {
      const next = update(previous);
      parseProject(next);
      setPast((items) => [...items.slice(-49), previous]);
      setFuture([]);
      replace(next);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }
  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    const current = latest.current;
    setFuture((items) => [current, ...items]);
    setPast(past.slice(0, -1));
    replace(previous);
  }
  function redo() {
    if (!future.length) return;
    const current = latest.current;
    setPast((items) => [...items, current]);
    setFuture(future.slice(1));
    replace(future[0]);
  }
  function discardConflict() {
    if (!conflict) return;
    try {
      drafts.clear(conflict.revision, conflict.project);
    } catch {
      /* Recovery is optional. */
    }
    const { remote } = conflict;
    revision.current = remote.revision;
    synced.current = remote.project;
    latest.current = remote.project;
    conflicted.current = false;
    setProject(remote.project);
    setPast([]);
    setFuture([]);
    setStatus("Saved");
    setConflict(undefined);
  }
  return {
    project,
    change,
    undo,
    redo,
    canUndo: !!past.length,
    canRedo: !!future.length,
    status,
    saving,
    save,
    conflict: conflict?.project,
    discardConflict,
  };
}
