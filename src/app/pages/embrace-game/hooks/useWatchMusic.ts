"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioController } from "./audioHandler";

// Prime this media element during the join gesture without playing a room cue.
const SILENCE = "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

export function useWatchMusic(source: string | undefined, paused: boolean, ducked: boolean) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<string | undefined>(undefined);
  const attemptRef = useRef(0);
  const [blocked, setBlocked] = useState(false);

  const play = useCallback((audio: HTMLAudioElement, reportBlocked = true) => {
    const attempt = ++attemptRef.current;
    void audio.play().then(() => {
      if (attempt === attemptRef.current) setBlocked(false);
    }, (error: unknown) => {
      if (reportBlocked && attempt === attemptRef.current &&
          error instanceof DOMException && error.name === "NotAllowedError") {
        setBlocked(true);
      }
    });
  }, []);

  const prime = useCallback(() => {
    if (audioRef.current) return;
    AudioController.pause();
    const audio = new Audio(SILENCE);
    audioRef.current = audio;
    play(audio, false);
  }, [play]);

  const stop = useCallback(() => {
    ++attemptRef.current;
    audioRef.current?.pause();
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!source || paused) {
      stop();
      setBlocked(false);
      return;
    }

    if (source !== sourceRef.current) {
      audio.src = source;
      audio.loop = true;
      sourceRef.current = source;
      play(audio);
    } else if (audio.paused) {
      play(audio);
    }
  }, [source, paused, play, stop]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = AudioController.musicGain() * (ducked ? 0.25 : 1);
    }
  }, [source, ducked]);

  useEffect(() => () => {
    stop();
    audioRef.current?.removeAttribute("src");
    audioRef.current?.load();
    audioRef.current = null;
    sourceRef.current = undefined;
  }, [stop]);

  const enable = () => {
    const audio = audioRef.current;
    if (audio && source && !paused) play(audio);
  };

  return { prime, stop, blocked, enable };
}
