"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { Layer } from "@/shared/schema/project";
import { usePreferences } from "@/components/preferences";

type TextLayer = Extract<Layer, { type: "text" }>;
export function TextEditor({
  layer,
  zoom,
  origin,
  commit,
  cancel,
  onDirty,
}: {
  layer: TextLayer;
  zoom: number;
  origin: { x: number; y: number };
  commit: (layer: TextLayer) => void;
  cancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { t } = usePreferences();
  const [text, setText] = useState(layer.text);
  const [height, setHeight] = useState(layer.geometry.height);
  const field = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    field.current?.focus();
    field.current?.select();
    return () => onDirty(false);
  }, [onDirty]);
  useLayoutEffect(() => {
    const el = field.current;
    if (el) {
      el.style.height = `${layer.geometry.height}px`;
      const measuredHeight = Math.min(
        8192,
        Math.max(layer.geometry.height, el.scrollHeight),
      );
      // Restore the measured height even when it is unchanged in React state.
      el.style.height = `${measuredHeight}px`;
      setHeight(measuredHeight);
    }
  }, [text, layer.geometry.height]);
  const finish = (abort = false) => {
    if (done.current) return;
    done.current = true;
    onDirty(false);
    if (abort) cancel();
    else commit({ ...layer, text, geometry: { ...layer.geometry, height } });
  };
  return (
    <textarea
      ref={field}
      className="canvas-text-editor"
      data-testid="canvas-text-editor"
      aria-label={t("editTextCanvas")}
      value={text}
      maxLength={4000}
      spellCheck={false}
      style={{
        left: origin.x + layer.geometry.x * zoom,
        top: origin.y + layer.geometry.y * zoom,
        width: layer.geometry.width,
        height,
        color: layer.style.fill,
        fontFamily: layer.style.fontFamily,
        fontWeight: layer.style.fontWeight,
        fontSize: layer.style.fontSize,
        textAlign: layer.style.align,
        transform: `scale(${zoom}) rotate(${layer.geometry.rotation}deg)`,
        lineHeight: 1.1,
        outlineWidth: `${1 / zoom}px`,
      }}
      onChange={(e) => {
        setText(e.target.value);
        onDirty(e.target.value !== layer.text);
      }}
      onBlur={() => finish()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(true);
        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          finish();
        }
      }}
    />
  );
}
