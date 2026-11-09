"use client";
export function PanelDivider({
  side,
  value,
  onChange,
  label,
}: {
  side: "left" | "right";
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const min = side === "left" ? 208 : 260,
    max = side === "left" ? 360 : 420;
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div
      className="panel-divider"
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      onKeyDown={(e) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        onChange(
          e.key === "Home"
            ? min
            : e.key === "End"
              ? max
              : clamp(
                  value +
                    (e.key === "ArrowRight" ? 16 : -16) *
                      (side === "left" ? 1 : -1),
                ),
        );
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.dataset.startX = String(e.clientX);
        e.currentTarget.dataset.startWidth = String(value);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        onChange(
          clamp(
            Number(e.currentTarget.dataset.startWidth) +
              (e.clientX - Number(e.currentTarget.dataset.startX)) *
                (side === "left" ? 1 : -1),
          ),
        );
      }}
      onPointerUp={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
    />
  );
}
