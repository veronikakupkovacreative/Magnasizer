"use client";
import {
  Languages,
  Moon,
  Sun,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import { usePreferences } from "./preferences";
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`studio-logo${compact ? " studio-logo-compact" : ""}`} aria-label="MAGNASIZER">
      {/* Original client-supplied vector artwork: no font substitution or recoloring. */}
      {compact ? (
        <img className="magnasizer-mark-asset" src="/magnasizer-mark.svg" alt="" aria-hidden="true" width={26} height={28} />
      ) : (
        <img className="magnasizer-logo-asset" src="/magnasizer-logo.svg" alt="" aria-hidden="true" width={165} height={21} />
      )}
    </span>
  );
}
export function PreferencesControls() {
  const { prefs, setPrefs, t } = usePreferences();
  return (
    <div className="preferences-controls">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t(prefs.theme === "dark" ? "themeLight" : "themeDark")}
        title={t(prefs.theme === "dark" ? "themeLight" : "themeDark")}
        onClick={() =>
          setPrefs({ theme: prefs.theme === "dark" ? "light" : "dark" })
        }
      >
        {prefs.theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          setPrefs({ locale: prefs.locale === "en" ? "cs" : "en" })
        }
        aria-label={t("switchLocale")}
        title={t("switchLocale")}
      >
        <Languages size={16} />
        <span>{prefs.locale.toUpperCase()}</span>
      </Button>
    </div>
  );
}
export function LoadingState({ canvas = false }: { canvas?: boolean }) {
  const { t } = usePreferences();
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{t(canvas ? "loadingCanvas" : "loading")}</span>
    </div>
  );
}
export function ErrorNotice({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>{children}</span>
      {action}
    </div>
  );
}
