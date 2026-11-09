"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { localProjects } from "@/lib/db/projects";
import type { LoadedProject } from "@/shared/schema/project";
import { ErrorNotice, LoadingState } from "@/components/studio-chrome";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/components/preferences";
import { Editor } from "./editor";
export function EditorLoader({ id }: { id: string }) {
  const { t } = usePreferences();
  const [bundle, setBundle] = useState<LoadedProject | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    localProjects
      .load(id)
      .then((data) => {
        if (active) {
          if (data) setBundle(data);
          else setError(true);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  if (error)
    return (
      <main className="page-error">
        <ErrorNotice>{t("loadError")}</ErrorNotice>
        <Button
          onClick={() => {
            setError(false);
            setAttempt((a) => a + 1);
          }}
        >
          {t("retry")}
        </Button>
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      </main>
    );
  if (!bundle) return <LoadingState />;
  return <Editor key={bundle.bundle.project.id} initial={bundle} />;
}
