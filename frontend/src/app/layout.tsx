
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
    <html lang="en" data-theme="dark" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: "(function(){try{var value=localStorage.getItem(\"trading-pulse-color-mode\");var theme=value===\"light\"?\"light\":\"dark\";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(_error){}})();" }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
