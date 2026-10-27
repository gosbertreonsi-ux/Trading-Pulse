"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

type AppShellProps = { children: ReactNode };

const navigation = [
  { href: "/", label: "Dashboard", glyph: "◫", description: "Market overview" },
  { href: "/analytics", label: "Analytics", glyph: "▥", description: "Historical market analytics" },
  { href: "/liquidity", label: "Liquidity", glyph: "≋", description: "Educational modeled order book" },
  { href: "/paper", label: "Paper Book", glyph: "⇄", description: "Simulated limit-order matching sandbox" },
  { href: "/alerts", label: "Alerts", glyph: "♧", description: "Price alerts" },
  { href: "/studio", label: "AI Studio", glyph: "✳", description: "Build workspace" },
];


type Theme = "dark" | "light";
const THEME_KEY = "trading-pulse-color-mode";
const THEME_EVENT = "trading-pulse-theme-change";

function subscribeTheme(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  window.addEventListener(THEME_EVENT, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(THEME_EVENT, notify);
  };
}

function savedTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function serverTheme(): Theme {
  return "dark";
}

export default function AppShell({ children }: AppShellProps) {
  const theme = useSyncExternalStore(subscribeTheme, savedTheme, serverTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private browsing may block persistence; this tab can still switch.
    }
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const pathname = usePathname();

  const isStudio = pathname.startsWith("/studio");
  const isAnalytics = pathname.startsWith("/analytics");
  const isAlerts = pathname.startsWith("/alerts");
  const isLiquidity = pathname.startsWith("/liquidity");
  const isPaper = pathname.startsWith("/paper");

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
            <strong>{isStudio ? "AI Studio" : isAnalytics ? "Historical Analytics" : isLiquidity ? "Liquidity Model" : isPaper ? "Paper Order Book" : isAlerts ? "Price Alerts" : "Market Overview"}</strong>
          </div>
          <div className="tp-topbar-actions">
            <button type="button" className="tp-theme-switch" onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={theme === "light"}>
              <span className="tp-theme-symbol" aria-hidden="true">{theme === "dark" ? "☼" : "☾"}</span>
              <span className="tp-theme-name">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
            </button>
            <span className="tp-topbar-label"><span className="tp-dot" /> DEVELOPMENT BUILD</span>
            <span className="tp-avatar" title="Local workspace">TP</span>
          </div>
        </header>
        <main className="tp-content">{children}</main>
      </div>
    </div>
  );
}
