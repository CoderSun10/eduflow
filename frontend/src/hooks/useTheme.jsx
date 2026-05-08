import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const PREFS_KEY = "eduflow.preferences";

export const loadStoredPreferences = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveStoredPreferences = (patch) => {
  const current = loadStoredPreferences();
  const next = { ...current, ...patch };
  localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  return next;
};

const ThemeContext = createContext(null);

const getSystemTheme = () => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";
  const stored = loadStoredPreferences();
  return stored.uiTheme ?? getSystemTheme();
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    saveStoredPreferences({ uiTheme: theme });
  }, [theme]);

  const setTheme = (nextTheme) => {
    setThemeState(nextTheme === "dark" ? "dark" : "light");
  };

  const toggleTheme = () => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  };

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
