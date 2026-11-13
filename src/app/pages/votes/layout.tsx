import type { ReactNode } from "react";
import VotingServerReady from "@/app/votes/server-ready";

export default function VotesLayout({ children }: { children: ReactNode }) {
  return <VotingServerReady>{children}</VotingServerReady>;
}
