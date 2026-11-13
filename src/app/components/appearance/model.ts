export type ThemePreference = "light" | "dark" | "system";
export type ThemeMode = "light" | "dark";
export const THEME_STORAGE_KEY = "hub-theme";

export function themePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function themeMode(
  preference: ThemePreference,
  systemDark: boolean,
): ThemeMode {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

// Runs before page content is painted. Only a validated preference reaches the DOM.
export const themeBootstrap = `(function(){var preference='system';try{var saved=localStorage.getItem('${THEME_STORAGE_KEY}');if(saved==='light'||saved==='dark')preference=saved;}catch(_){}var dark=preference==='dark'||(preference==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';})();`;
