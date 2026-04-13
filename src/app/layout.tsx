/**
 * Root layout — wraps all pages with the custom auth provider and global styles.
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "../components/SessionProvider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Shopify Cleaner — Inventory Survey",
  description: "Multi-store inventory verification tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
