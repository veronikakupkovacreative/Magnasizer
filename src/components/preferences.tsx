"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { z } from "zod";
import { en, cs, type MessageKey } from "@/lib/i18n/messages";
const schema = z.object({
  theme: z.enum(["dark", "light"]).default("dark"),
  locale: z.enum(["en", "cs"]).default("en"),
  leftOpen: z.boolean().default(true),
  rightOpen: z.boolean().default(true),
  leftWidth: z.number().min(208).max(360).default(256),
  rightWidth: z.number().min(260).max(420).default(304),
  snapping: z.boolean().default(true),
  zoom: z.number().min(0.04).max(2).nullable().default(null),
});
type Preferences = z.infer<typeof schema>;
const defaults = schema.parse({});
const KEY = "srs-preferences-v1";
let fallback: string | null = null;
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener("srs-prefs", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("srs-prefs", callback);
  };
};
const snapshot = () => {
  try {
    return localStorage.getItem(KEY) ?? fallback;
  } catch {
    return fallback;
  }
};
const Context = createContext<{
  prefs: Preferences;
  setPrefs: (patch: Partial<Preferences>) => void;
  t: (key: MessageKey) => string;
} | null>(null);
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const prefs = useMemo(() => {
    try {
      return schema.parse(raw ? JSON.parse(raw) : {});
    } catch {
      return defaults;
    }
  }, [raw]);
  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.lang = prefs.locale;
  }, [prefs.theme, prefs.locale]);
  const value = useMemo(
    () => ({
      prefs,
      setPrefs: (patch: Partial<Preferences>) => {
        fallback = JSON.stringify(schema.parse({ ...prefs, ...patch }));
        try {
          localStorage.setItem(KEY, fallback);
        } catch {
          /* Preferences remain in memory when browser storage is disabled. */
        }
        window.dispatchEvent(new Event("srs-prefs"));
      },
      t: (key: MessageKey) => (prefs.locale === "cs" ? cs : en)[key],
    }),
    [prefs],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function usePreferences() {
  const context = useContext(Context);
  if (!context) throw new Error("Missing PreferencesProvider");
  return context;
}
