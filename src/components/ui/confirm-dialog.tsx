"use client";
import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./button";
import { usePreferences } from "@/components/preferences";
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirm,
  onConfirm,
  errorText,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirm: string;
  onConfirm: () => void | Promise<void>;
  errorText?: string;
}) {
  const { t } = usePreferences();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState(false);
  const confirmAction = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault(); // Keep the dialog open until async storage commits.
    if (pending) return;
    setPending(true);
    setFailure(false);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      setFailure(true);
    } finally {
      setPending(false);
    }
  };
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => {
      if (pending) return;
      setFailure(false);
      onOpenChange(next);
    }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="dialog-content">
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
          {failure && <p className="dialog-error" role="alert">{errorText ?? t("storageError")}</p>}
          <div className="dialog-actions">
            <AlertDialog.Cancel asChild>
              <Button disabled={pending}>{t("cancel")}</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" disabled={pending} aria-busy={pending} onClick={confirmAction}>
                {confirm}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
