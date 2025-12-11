import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "XPRMINT.com",
  description: "XPRMINT.com – Forge and onchain experiments",
  icons: {
    icon: [
      { url: "/forge_2a.png", sizes: "32x32", type: "image/png" },
      { url: "/forge_2a.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/forge_2a.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <main>{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
