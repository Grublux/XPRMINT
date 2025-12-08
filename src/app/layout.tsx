import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XPRMINT.com",
  description: "XPRMINT.com – Forge and onchain experiments",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
