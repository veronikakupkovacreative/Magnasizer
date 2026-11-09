"use client";
import Link from "next/link";
import { usePreferences } from "@/components/preferences";
import { ErrorNotice } from "@/components/studio-chrome";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = usePreferences();
  return (
    <main className="page-error">
      <ErrorNotice>{t("loadError")}</ErrorNotice>
      <Button onClick={reset}>{t("retry")}</Button>
      <Button asChild>
        <Link href="/">{t("home")}</Link>
      </Button>
    </main>
  );
}
