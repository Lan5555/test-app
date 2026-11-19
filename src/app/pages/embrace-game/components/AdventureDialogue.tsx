"use client";

import { useEffect, useRef, useState } from "react";
import type { ExplorerNpc } from "../lib/adventure";
import { adventureIdleStyle } from "../lib/adventureSprites";
import styles from "./adventure-world.module.css";

export default function AdventureDialogue({ npc, onClose }: { npc: ExplorerNpc; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const [continued, setContinued] = useState(false);
  const [personal, setPersonal] = useState(false);
  const hasNextLine = !continued && Boolean(npc.followUp);
  const line = personal ? npc.personal.answer : continued ? npc.followUp : npc.dialogue;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  useEffect(() => primary.current?.focus({ preventScroll: true }), [continued, personal]);

  return (
    <dialog ref={dialog} className={styles.dialogue} aria-labelledby="adventure-speaker" aria-describedby="adventure-line"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key.toLowerCase() !== "e") return;
        event.preventDefault();
        if (event.repeat) return;
        const button = event.target instanceof HTMLButtonElement ? event.target : primary.current;
        button?.click();
      }}>
      <div className={styles.speakerSprite} style={adventureIdleStyle(npc.fighter)} aria-hidden="true" />
      <div className={styles.dialogueText}>
        <h2 id="adventure-speaker">{npc.name}</h2>
        <p id="adventure-line" aria-live="polite">{line}</p>
        <div className={styles.dialogueChoices} aria-label="Conversation choices" role="group">
          {hasNextLine ? (
            <button ref={primary} type="button" className={styles.dialogueAdvance} onClick={() => setContinued(true)}>Continue</button>
          ) : (
            <button ref={primary} type="button" className={styles.dialogueAdvance} onClick={() => setPersonal(!personal)}>
              {personal ? "Back to conversation" : npc.personal.question}
            </button>
          )}
          <button type="button" className={styles.dialogueLeave} onClick={onClose}>Goodbye</button>
        </div>
      </div>
    </dialog>
  );
}
