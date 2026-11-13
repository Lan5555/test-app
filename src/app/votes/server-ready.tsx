"use client";

import { Vote } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import PageState from "@/app/components/page-state";

export default function VotingServerReady({
  children,
}: {
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  // The attempt counter deliberately restarts the connection after a manual retry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry must create a fresh abort controller and timeout
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    let active = true;

    async function connect() {
      try {
        const base = (process.env.NEXT_PUBLIC_DATABASE_LINK || "").replace(
          /\/+$/,
          "",
        );
        const response = await fetch(`${base}/users/api/ping-server`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok || body?.success !== true) {
          throw new Error("Unable to connect");
        }
        if (active) setReady(true);
      } catch {
        if (active) {
          setError(
            "We couldn't reach the voting service. Check your connection and try again.",
          );
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    void connect();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  if (ready) return children;

  return (
    <PageState
      icon={Vote}
      loading={!error}
      title={error ? "Let's try that again." : "Getting voting ready."}
      description={error || "Connecting to the server. This may take a moment."}
    >
      {error && (
        <button
          type="button"
          className="hub-button-primary"
          onClick={() => {
            setError("");
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
      )}
    </PageState>
  );
}
