import { createTheme } from "@mui/material/styles";
import type { ThemeMode } from "./model";

export function createAppTheme(mode: ThemeMode) {
  const dark = mode === "dark";
  const border = dark ? "#35323e" : "#e5eaf2";
  return createTheme({
    palette: {
      mode,
      primary: {
        main: dark ? "#c4b0ee" : "#526d96",
        dark: dark ? "#d4c4f5" : "#405a80",
        contrastText: dark ? "#111014" : "#ffffff",
      },
      secondary: { main: dark ? "#c5c4ce" : "#475569" },
      background: {
        default: dark ? "#111014" : "#f7f8fa",
        paper: dark ? "#1c1b21" : "#ffffff",
      },
      text: {
        primary: dark ? "#eeeef3" : "#17243b",
        secondary: dark ? "#a5a4b2" : "#64748b",
      },
      divider: border,
    },
    shape: { borderRadius: 12 },
    typography: {
      fontFamily: "var(--font-geist-sans), Arial, sans-serif",
      button: { textTransform: "none", fontWeight: 600 },
      h6: { fontWeight: 700, letterSpacing: "-0.025em" },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 10, padding: "10px 18px" } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 20,
            boxShadow: "0 24px 80px #17243b24",
            backgroundImage: "none",
            border: `1px solid ${border}`,
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { padding: "24px 24px 16px", fontWeight: 700 },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: { padding: "16px 24px", borderTop: `1px solid ${border}` },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 10 },
          notchedOutline: { borderColor: border },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          input: dark
            ? {
                "&.Mui-disabled": {
                  WebkitTextFillColor: "#a5a4b2",
                  opacity: 1,
                },
              }
            : {},
        },
      },
      MuiFormHelperText: {
        styleOverrides: { root: dark ? { color: "#a5a4b2" } : {} },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: border },
          head: {
            backgroundColor: dark ? "#16151b" : "#f7f8fa",
            fontWeight: 600,
            color: dark ? "#a5a4b2" : "#64748b",
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600, borderRadius: 7 } },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${border}`,
            borderRadius: 12,
            boxShadow: "0 12px 40px #17243b14",
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            background: dark ? "#eeeef3" : "#17243b",
            color: dark ? "#1c1b21" : "#ffffff",
            borderRadius: 7,
            padding: "7px 11px",
          },
        },
      },
    },
  });
}
