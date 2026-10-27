"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

type AppShellProps = { children: ReactNode };

const navigation = [
  { href: "/", label: "Dashboard", glyph: "◫", description: "Market overview" },
  { href: "/studio", label: "AI Studio", glyph: "✳", description: "Build workspace" },
];

function readTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("trading-pulse-theme") === "light" ? "light" : "dark";
}

function subscribeToTheme(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("trading-pulse-theme-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("trading-pulse-theme-change", onChange);
  };
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, []);

  function toggleTheme() {
    window.localStorage.setItem("trading-pulse-theme", theme === "dark" ? "light" : "dark");
    window.dispatchEvent(new Event("trading-pulse-theme-change"));
  }

  const isStudio = pathname.startsWith("/studio");

  return (
    <div className="tp-app">
      <aside className="tp-sidebar" aria-label="Primary navigation">
        <Link className="tp-brand" href="/" aria-label="Trading Pulse home">
          <span className="tp-brand-mark" aria-hidden="true"><span /></span>
          <span className="tp-brand-copy">
            <strong>TRADING<span>PULSE</span></strong>
            <small>MARKET INTELLIGENCE</small>
          </span>
        </Link>

        <div className="tp-sidebar-section">WORKSPACE</div>
        <nav className="tp-nav">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={"tp-nav-link" + (pathname === item.href ? " active" : "")}
              aria-current={pathname === item.href ? "page" : undefined}
              title={item.description}
            >
              <span className="tp-nav-icon" aria-hidden="true">{item.glyph}</span>
              <span>{item.label}</span>
              {item.href === "/studio" && <span className="tp-nav-new">NEW</span>}
            </Link>
          ))}
        </nav>
        <div className="tp-sidebar-bottom">
          <div className="tp-sim-note"><span className="tp-dot" /> SIMULATION ENVIRONMENT</div>
          <p>Research and analysis only. No real orders are executed.</p>
          <small>TRADING PULSE · BUILD 0.2</small>
        </div>
      </aside>

      <div className="tp-app-main">
        <header className="tp-topbar">
          <div className="tp-breadcrumb">
            <span>WORKSPACE</span><span className="tp-breadcrumb-divider">/</span>
            <strong>{isStudio ? "AI Studio" : "Market Overview"}</strong>
          </div>
          <div className="tp-topbar-actions">
            <span className="tp-topbar-label"><span className="tp-dot" /> DEVELOPMENT BUILD</span>
            <button className="tp-icon-button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title="Toggle theme">
              {theme === "dark" ? "☼" : "☾"}
            </button>
            <span className="tp-avatar" title="Local workspace">TP</span>
          </div>
        </header>
        <main className="tp-content">{children}</main>
      </div>
    </div>
  );
}
