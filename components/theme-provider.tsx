"use client";

import * as React from "react";
import { getUserThemeAction, updateUserThemeAction } from "@/app/actions/crud-actions";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setThemePreference: (newTheme: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

function getCachedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const cachedTheme = localStorage.getItem("flex_erp_user_theme");
    if (cachedTheme === "dark" || cachedTheme === "light") return cachedTheme;
  } catch {
    // Ignore localStorage error
  }
  return "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>(getCachedTheme);
  const [userId, setUserId] = React.useState<string | null>(null);

  // 1. Sync saved preference from Database per-user (localStorage was already
  // applied synchronously via the useState initializer above).
  React.useEffect(() => {
    let isMounted = true;

    getUserThemeAction().then((res) => {
      if (!isMounted) return;
      if (res.success && res.data) {
        if (res.data.userId) setUserId(res.data.userId);

        const serverTheme = res.data.theme as Theme;
        if (serverTheme === "light" || serverTheme === "dark") {
          setTheme(serverTheme);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("flex_erp_user_theme", serverTheme);
            } catch {}
          }
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Apply theme class to DOM root whenever theme changes
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // 3. Persist theme toggle to DB + localStorage
  const setThemePreference = React.useCallback((newTheme: Theme) => {
    setTheme(newTheme);

    // Instant local save
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("flex_erp_user_theme", newTheme);
        if (userId) {
          localStorage.setItem(`flex_erp_user_theme_${userId}`, newTheme);
        }
      } catch {}
    }

    // Persist per-user in Database
    updateUserThemeAction(newTheme).catch((err) => {
      console.warn("Could not save theme preference to server database:", err);
    });
  }, [userId]);

  const toggleTheme = React.useCallback(() => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setThemePreference(nextTheme);
  }, [theme, setThemePreference]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
