"use client";

import LegacyForgeRoot from "./legacy/LegacyForgeRoot";

export default function ForgeApp() {
  // Thin shell so app/page.tsx can import a stable ForgeApp entrypoint.
  return <LegacyForgeRoot />;
}
