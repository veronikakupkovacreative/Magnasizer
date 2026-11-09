import type { SafeZone } from "@/shared/schema/project";

export type FormatPreset = {
  id: string;
  version: 1;
  platform: "meta" | "pmax" | "gdn";
  name: string;
  width: number;
  height: number;
  safeZone: SafeZone;
};

const edge = (width: number, height: number, ratio = 0.05): SafeZone => ({
  top: Math.round(height * ratio),
  right: Math.round(width * ratio),
  bottom: Math.round(height * ratio),
  left: Math.round(width * ratio),
});

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: "meta-square-1200", version: 1, platform: "meta", name: "Meta Square", width: 1200, height: 1200, safeZone: edge(1200, 1200) },
  { id: "meta-story-1080x1920", version: 1, platform: "meta", name: "Meta Story / Reel", width: 1080, height: 1920, safeZone: { top: 250, right: 60, bottom: 250, left: 60 } },
  { id: "pmax-landscape-1200x628", version: 1, platform: "pmax", name: "Performance Max Landscape", width: 1200, height: 628, safeZone: edge(1200, 628) },
  { id: "pmax-square-1200", version: 1, platform: "pmax", name: "Performance Max Square", width: 1200, height: 1200, safeZone: edge(1200, 1200) },
  { id: "pmax-portrait-960x1200", version: 1, platform: "pmax", name: "Performance Max Portrait", width: 960, height: 1200, safeZone: edge(960, 1200) },
  { id: "pmax-vertical-1080x1920", version: 1, platform: "pmax", name: "Performance Max Vertical", width: 1080, height: 1920, safeZone: edge(1080, 1920) },
  { id: "gdn-320x100", version: 1, platform: "gdn", name: "GDN 320 × 100", width: 320, height: 100, safeZone: edge(320, 100, 0.04) },
  { id: "gdn-300x600", version: 1, platform: "gdn", name: "GDN 300 × 600", width: 300, height: 600, safeZone: edge(300, 600, 0.04) },
  { id: "gdn-336x280", version: 1, platform: "gdn", name: "GDN 336 × 280", width: 336, height: 280, safeZone: edge(336, 280, 0.04) },
  { id: "gdn-300x250", version: 1, platform: "gdn", name: "GDN 300 × 250", width: 300, height: 250, safeZone: edge(300, 250, 0.04) },
  { id: "gdn-728x90", version: 1, platform: "gdn", name: "GDN 728 × 90", width: 728, height: 90, safeZone: edge(728, 90, 0.04) },
];

export const presetById = (id: string) => FORMAT_PRESETS.find((preset) => preset.id === id);
