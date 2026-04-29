import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cocraft",
  description: "A browser-based storytelling harness for co-creation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
