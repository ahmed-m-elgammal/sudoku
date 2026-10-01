import type { Metadata, Viewport } from "next";
import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/fonts.css";
import "@/styles/global.css";

export const metadata: Metadata = {
  title: "ASSIZE — a sudoku duel in the plague-walled city of Novem",
  description:
    "Law is settled by solving. Race a sealed Tablet against a Shade, claim rows, columns and boxes, and cast engraved rites in a grim medieval court of nine Magistrates.",
  applicationName: "ASSIZE",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/assets/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/assets/brand/app-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/assets/brand/app-icon-192.png",
  },
  openGraph: {
    title: "ASSIZE",
    description: "A 1v1 sudoku duel. The Tablet does not forgive.",
    images: ["/assets/brand/og-image.png"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-text="m">
      <body className="assize-root">{children}</body>
    </html>
  );
}
