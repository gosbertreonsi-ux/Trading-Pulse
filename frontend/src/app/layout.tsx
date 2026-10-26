
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Pulse",
  description: "Real-time market monitoring and trading analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
