"use client";

import { ThemeProvider } from "@mui/material/styles";
import { Laptop, Moon, Sun } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  THEME_STORAGE_KEY,
  type ThemeMode,
  type ThemePreference,
  themeMode,
  themePreference,
} from "./model";
import { createAppTheme } from "./theme";

const AppearanceContext = createContext<{
  preference: ThemePreference;
  mode: ThemeMode;
  setPreference: (value: ThemePreference) => void;
} | null>(null);

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (!context)
    throw new Error("Appearance controls require AppearanceProvider.");
  return context;
}

export function ThemePreferenceControl() {
  const { preference, setPreference } = useAppearance();
  return (
    <label className="hub-appearance-setting">
      <span>
        <strong>Color theme</strong>
        <small>Choose a theme or follow your device.</small>
      </span>
      <select
        aria-label="Color theme"
        value={preference}
        onChange={(event) => setPreference(themePreference(event.target.value))}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}

export function ThemeControlView({
  mode,
  preference,
  onToggle,
  onSystem,
}: {
  mode: ThemeMode;
  preference: ThemePreference;
  onToggle: () => void;
  onSystem: () => void;
}) {
  return (
    <div className="hub-appearance-control">
      <button
        type="button"
        className="hub-appearance-toggle"
        onClick={onToggle}
        aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
        aria-pressed={mode === "dark"}
        title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
      >
        {mode === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        <span>{mode === "dark" ? "Dark" : "Light"}</span>
      </button>
      <button
        type="button"
        className="hub-appearance-system"
        onClick={onSystem}
        aria-label="Follow device theme"
        aria-pressed={preference === "system"}
        title="Follow device theme"
      >
        <Laptop size={16} />
      </button>
    </div>
  );
}

export default function AppearanceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);
    try {
      setPreferenceState(
        themePreference(localStorage.getItem(THEME_STORAGE_KEY)),
      );
    } catch {
      /* Device theme remains available without browser storage. */
    }
    const update = () => setSystemDark(media.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null)
        setPreferenceState(themePreference(event.newValue));
    };
    media.addEventListener("change", update);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", update);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const mode = themeMode(preference, systemDark);
  // The bootstrap owns the initial paint; effects take over after hydration.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (ready) {
      document.documentElement.dataset.theme = mode;
      document.documentElement.style.colorScheme = mode;
    }
  }, [mode, ready]);
  function setPreference(value: ThemePreference) {
    setPreferenceState(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      /* The preference still applies for this visit. */
    }
  }
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  return (
    <AppearanceContext.Provider value={{ preference, mode, setPreference }}>
      <ThemeProvider theme={theme}>
        {children}
        <ThemeControlView
          mode={mode}
          preference={preference}
          onToggle={() => setPreference(mode === "dark" ? "light" : "dark")}
          onSystem={() => setPreference("system")}
        />
      </ThemeProvider>
    </AppearanceContext.Provider>
  );
}
