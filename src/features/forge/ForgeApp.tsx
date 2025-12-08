"use client";

import LegacyForgeRoot from "@/features/forge/legacy/LegacyForgeRoot";

export default function ForgeApp() {
  // This shell exists so we can later insert layout, providers, and global Forge UI framing.
  // For now it just renders the legacy Forge root.
  return (
    <div style={{ padding: 0, margin: 0 }}>
      <LegacyForgeRoot />
    </div>
  );
}
