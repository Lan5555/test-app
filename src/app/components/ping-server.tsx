"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CoreService } from "../helpers/api-handler";
import PageState from "./page-state";

export default function PingServer() {
  const router = useRouter();
  const request = useRef(0);
  const [error, setError] = useState("");
  const connect = useCallback(async () => {
    const attempt = ++request.current;
    setError("");
    try {
      const response = await new CoreService().get("/users/api/ping-server");
      if (request.current !== attempt) return;
      if (response.success) router.replace("/pages/login");
      else
        setError(
          response.message ||
            "We couldn’t reach the service. Please try again in a moment.",
        );
    } catch {
      if (request.current === attempt)
        setError("We couldn’t connect. Check your connection and try again.");
    }
  }, [router]);
  useEffect(() => {
    void connect();
    return () => {
      request.current++;
    };
  }, [connect]);
  return (
    <PageState
      loading={!error}
      title={error ? "Let’s try that again." : "Getting things ready."}
      description={
        error ||
        "Connecting to your learning space. You’ll be on your way shortly."
      }
    >
      {error && (
        <button
          type="button"
          className="hub-button-primary"
          onClick={() => void connect()}
        >
          Try again
        </button>
      )}
      <Link className="hub-button-secondary" href="/pages/login">
        Go to sign in
      </Link>
    </PageState>
  );
}
