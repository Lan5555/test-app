import type { ReactNode } from "react";
import { BlueprintAiProvider } from "@/features/blueprint/ui/ai-session";

export default function BlueprintLayout({ children }: { children: ReactNode }) {
  return <BlueprintAiProvider>{children}</BlueprintAiProvider>;
}
