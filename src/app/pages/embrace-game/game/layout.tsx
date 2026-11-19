import type { Viewport } from "next";
import type { ReactNode } from "react";
import GameLandscape from "../components/GameLandscape";

export const viewport: Viewport = { viewportFit: "cover" };

export default function GameLayout({ children }: { children: ReactNode }) {
  return <GameLandscape>{children}</GameLandscape>;
}
