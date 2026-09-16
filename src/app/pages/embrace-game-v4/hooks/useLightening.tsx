"use client";

import { useCallback, useState } from "react";
import { LightningKind } from "../components/lightning";

interface LightningState {
  trigger: number;
  kind: LightningKind;
}

export function useLightning() {
  const [state, setState] = useState<LightningState | null>(null);

  const strike = useCallback((kind: LightningKind = "heavy") => {
    setState({ trigger: Date.now(), kind });
  }, []);

  const clear = useCallback(() => {
    setState(null);
  }, []);

  return { state, strike, clear };
}