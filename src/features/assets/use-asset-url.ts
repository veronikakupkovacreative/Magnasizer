"use client";
import { useEffect, useState } from "react";
import type { Asset, AssetBlobs } from "@/shared/schema/project";
export function useAssetUrl(asset: Asset, blobs: AssetBlobs) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (asset.kind !== "imported-image") return;
    const blob = blobs[asset.renderKey];
    if (!blob) return;
    const next = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => setUrl(next);
    image.src = next;
    return () => {
      image.onload = null;
      URL.revokeObjectURL(next);
    };
  }, [asset, blobs]);
  return asset.kind === "bundled-image" ? asset.src : asset.kind === "imported-image" ? url : "";
}
