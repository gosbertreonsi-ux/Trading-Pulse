
"use client";

import { useState } from "react";

const markets = [
  { symbol: "BTC", name: "Bitcoin", price: "67,482.30", change: "+2.84%", up: true },
  { symbol: "ETH", name: "Ethereum", price: "3,521.86", change: "+1.62%", up: true },
  { symbol: "SOL", name: "Solana", price: "182.47", change: "-0.74%", up: false },
];

const watchlist = [
  { symbol: "BTC/USDT", price: "67,482.30", change: "+2.84%", up: true },
  { symbol: "ETH/USDT", price: "3,521.86", change: "+1.62%", up: true },
  { symbol: "SOL/USDT", price: "182.47", change: "-0.74%", up: false },
  { symbol: "BNB/USDT", price: "598.24", change: "+0.91%", up: true },
  { symbol: "XRP/USDT", price: "0.6241", change: "-1.21%", up: false },
];

const chartPoints = [
  "0,168", "28,157", "55,164", "80,132", "105,145", "130,116",
  "156,128", "182,91", "207,106", "233,81", "258,95", "284,60",
  "310,76", "336,45", "362,66", "388,35", "414,53", "440,28",
  "466,42", "492,18", "518,33", "544,12", "570,27", "600,8",
].join(" ");

const navItems = [
  { icon: "◫", label: "Overview" },
  { icon: "⌁", label: "Markets" },
  { icon: "▥", label: "Charts" },
  { icon: "⇄", label: "Trade" },
  { icon: "◷", label: "History" },
];

export default function Home() {
  const [dark, setDark] = useState(true);
  const [activeNav, setActiveNav] = useState("Overview");
  const [timeframe, setTimeframe] = useState("1D");
  const [selectedMarket, setSelectedMarket] = useState("BTC/USDT");
  const [search, setSearch] = useState("");

  const theme = dark
    ? {
        page: "bg-[#090d14] text-slate-100",
        panel: "bg-[#101722] border-white/[0.07]",
        muted: "text-slate-400",
        subtle: "text-slate-500",
        hover: "hover:bg-white/[0.05]",
        line: "border-white/[0.07]",
        input: "bg-[#0b111b] border-white/10",
      }
    : {
        page: "bg-[#f4f6fa] text-slate-900",
        panel: "bg-white border-slate-200",
        muted: "text-slate-500",
        subtle: "text-slate-400",
        hover: "hover:bg-slate-100",
        line: "border-slate-200",
        input: "bg-slate-50 border-slate-200",
      };

  const filteredWatchlist = watchlist.filter((item) =>
    item.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className={`min-h-screen ${theme.page}`}>
      <div className="flex min-h-screen">
        <aside className={`hidden w-60 shrink-0 border-r ${theme.line} px-5 py-6 lg:flex lg:flex-col`}>
          <div className="mb-10 flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-xl font-black text-slate-950">T</div>
            <div>
              <div className="text-lg font-bold tracking-tight">Trading Pulse</div>
              <div className={`text-xs ${theme.muted}`}>Market intelligence</div>
            </div>
          </div>

          <div className={`mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] ${theme.subtle}`}>Workspace</div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => setActiveNav(item.label)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
                  activeNav === item.label
                    ? "bg-cyan-400/10 font-semibold text-cyan-400"
                    : `${theme.muted} ${theme.hover}`
                }`}
              >
                <span className="w-5 text-center text-lg">{item.icon}</span>
                {item.label}
                {item.label === "Trade" && (
                  <span className="ml-auto rounded-md bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-500">DEMO</span>
                )}
              </button>
            ))}
          </nav>

          <div className={`mb-3 mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.2em] ${theme.subtle}`}>Personal</div>
          <button onClick={() => setActiveNav("Alerts")} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${theme.muted} ${theme.hover}`}>
            <span className="w-5 text-center text-lg">♧</span> Alerts
          </button>
          <button onClick={() => setActiveNav("Settings")} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${theme.muted} ${theme.hover}`}>
            <span className="w-5 text-center text-lg">⚙</span> Settings
          </button>

          <div className={`mt-auto rounded-2xl border ${theme.line} p-4`}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Simulator mode
            </div>
            <p className={`text-xs leading-5 ${theme.muted}`}>Prices and analytics are illustrative. Exchange data is not connected yet.</p>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className={`sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b ${theme.line} ${dark ? "bg-[#090d14]/95" : "bg-white/95"} px-5 py-4 backdrop-blur md:px-8`}>
            <div>
              <div className={`text-xs ${theme.muted}`}>Workspace / {activeNav}</div>
              <h1 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">{activeNav === "Overview" ? "Market overview" : activeNav}</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className={`hidden items-center gap-2 rounded-xl border px-3 py-2 sm:flex ${theme.input}`}>
                <span className={theme.muted}>⌕</span>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search markets..."
                  className="w-32 bg-transparent text-sm outline-none md:w-44"
                />
                <span className={`text-[10px] ${theme.subtle}`}>⌘ K</span>
              </div>
              <button aria-label="Toggle light and dark theme" onClick={() => setDark(!dark)} className={`rounded-xl border px-3 py-2 text-sm ${theme.line} ${theme.hover}`}>
                {dark ? "☀ Light" : "☾ Dark"}
              </button>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-blue-600 text-sm font-bold text-slate-950">TP</div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] space-y-6 p-5 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Your market at a glance</h2>
                <p className={`mt-1 text-sm ${theme.muted}`}>Monitor selected assets and market movement.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-3 py-1.5 text-xs font-medium text-amber-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                DEMO DATA · NOT LIVE
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {markets.map((market) => (
                <button
                  key={market.symbol}
                  onClick={() => setSelectedMarket(`${market.symbol}/USDT`)}
                  className={`rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 ${theme.panel} ${selectedMarket === `${market.symbol}/USDT` ? "ring-1 ring-cyan-400/50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${market.symbol === "BTC" ? "bg-orange-400/15 text-orange-400" : market.symbol === "ETH" ? "bg-violet-400/15 text-violet-400" : "bg-cyan-400/15 text-cyan-400"}`}>{market.symbol.slice(0, 1)}</div>
                      <div>
                        <div className="font-semibold">{market.symbol}<span className={`ml-2 text-xs font-normal ${theme.muted}`}>/ USDT</span></div>
                        <div className={`mt-0.5 text-xs ${theme.muted}`}>{market.name}</div>
                      </div>
                    </div>
                    <span className={`text-lg ${market.up ? "text-emerald-400" : "text-rose-400"}`}>{market.up ? "↗" : "↘"}</span>
                  </div>
                  <div className="mt-6 flex items-end justify-between gap-2">
                    <div className="text-2xl font-semibold tracking-tight">${market.price}</div>
                    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${market.up ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}`}>{market.change}</span>
                  </div>
                  <div className={`mt-3 text-xs ${theme.subtle}`}>Illustrative price · 24h change</div>
                </button>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
              <section className={`min-w-0 rounded-2xl border p-5 md:p-6 ${theme.panel}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className={`text-sm ${theme.muted}`}>Price chart · {selectedMarket}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="text-3xl font-bold tracking-tight">
                        ${selectedMarket.startsWith("ETH") ? "3,521.86" : selectedMarket.startsWith("SOL") ? "182.47" : "67,482.30"}
                      </span>
                      <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-xs font-semibold text-emerald-400">+2.84%</span>
                    </div>
                    <div className={`mt-1 text-xs ${theme.muted}`}>Illustrative chart · not connected to an exchange</div>
                  </div>
                  <div className={`flex rounded-xl p-1 ${dark ? "bg-black/20" : "bg-slate-100"}`}>
                    {["1H", "4H", "1D", "1W", "1M"].map((period) => (
                      <button key={period} onClick={() => setTimeframe(period)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${timeframe === period ? "bg-cyan-400 text-slate-950" : theme.muted}`}>
                        {period}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <div className="relative h-64 w-full">
                    <div className="absolute inset-0 flex flex-col justify-between">
                      {[0, 1, 2, 3, 4].map((n) => <div key={n} className={`border-t border-dashed ${theme.line}`} />)}
                    </div>
                    <svg viewBox="0 0 610 190" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                      <defs>
                        <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity=".25" />
                          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon points={`0,190 ${chartPoints} 600,190`} fill="url(#chartFill)" />
                      <polyline points={chartPoints} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                      <circle cx="600" cy="8" r="4" fill="#22d3ee" />
                      <circle cx="600" cy="8" r="8" fill="#22d3ee" fillOpacity=".16" />
                    </svg>
                  </div>
                  <div className={`mt-3 flex justify-between text-[10px] ${theme.subtle}`}>
                    <span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>Now</span>
                  </div>
                </div>

                <div className={`mt-6 grid grid-cols-3 gap-3 border-t pt-5 ${theme.line}`}>
                  <div><div className={`text-xs ${theme.muted}`}>24h high</div><div className="mt-1 font-semibold">$68,120.00</div></div>
                  <div><div className={`text-xs ${theme.muted}`}>24h low</div><div className="mt-1 font-semibold">$65,904.20</div></div>
                  <div><div className={`text-xs ${theme.muted}`}>24h volume</div><div className="mt-1 font-semibold">$1.28B</div></div>
                </div>
              </section>

              <section className={`rounded-2xl border p-5 ${theme.panel}`}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Watchlist</h3>
                    <p className={`mt-1 text-xs ${theme.muted}`}>Your selected markets</p>
                  </div>
                  <span className={`rounded-lg px-2 py-1 text-xs ${theme.muted} ${dark ? "bg-white/5" : "bg-slate-100"}`}>{filteredWatchlist.length} assets</span>
                </div>
                <div className="mt-5 space-y-1">
                  {filteredWatchlist.map((item) => (
                    <button key={item.symbol} onClick={() => setSelectedMarket(item.symbol)} className={`flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left ${theme.hover}`}>
                      <div>
                        <div className="text-sm font-semibold">{item.symbol}</div>
                        <div className={`mt-1 text-xs ${theme.muted}`}>Demo market</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">${item.price}</div>
                        <div className={`mt-1 text-xs ${item.up ? "text-emerald-400" : "text-rose-400"}`}>{item.change}</div>
                      </div>
                    </button>
                  ))}
                  {filteredWatchlist.length === 0 && <p className={`py-6 text-center text-sm ${theme.muted}`}>No matching markets.</p>}
                </div>
                <div className={`mt-4 border-t pt-4 ${theme.line}`}>
                  <p className={`text-xs leading-5 ${theme.muted}`}>Search markets from the top bar. Select an asset to highlight it and update the chart heading.</p>
                </div>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className={`rounded-2xl border p-5 ${theme.panel}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Market signals</h3>
                  <span className={`text-xs ${theme.muted}`}>Demo indicators</span>
                </div>
                <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${theme.line}`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-400">↗</span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Positive sample momentum</div>
                    <p className={`mt-1 text-xs leading-5 ${theme.muted}`}>The sample BTC series trends upward. This is a visual demonstration, not a live signal or financial advice.</p>
                  </div>
                  <span className="ml-auto shrink-0 rounded-lg bg-amber-400/10 px-2 py-1 text-[10px] text-amber-500">DEMO</span>
                </div>
                <div className={`mt-3 flex items-start gap-3 rounded-xl border p-4 ${theme.line}`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10 text-violet-400">◎</span>
                  <div>
                    <div className="text-sm font-semibold">Data connection pending</div>
                    <p className={`mt-1 text-xs leading-5 ${theme.muted}`}>Exchange integration and authenticated backend data will be connected in a later step.</p>
                  </div>
                </div>
              </section>

              <section className={`rounded-2xl border p-5 ${theme.panel}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Recent activity</h3>
                  <span className={`text-xs ${theme.muted}`}>Local demo</span>
                </div>
                <div className={`mt-4 flex items-center gap-3 border-b py-4 ${theme.line}`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-400">⌁</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Dashboard initialized</div>
                    <div className={`mt-1 text-xs ${theme.muted}`}>Trading Pulse interface loaded</div>
                  </div>
                  <span className={`text-xs ${theme.subtle}`}>Demo</span>
                </div>
                <div className={`flex items-center gap-3 py-4`}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-500">◷</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Backend integration pending</div>
                    <div className={`mt-1 text-xs ${theme.muted}`}>No real trades or orders have been placed</div>
                  </div>
                  <span className={`text-xs ${theme.subtle}`}>Pending</span>
                </div>
              </section>
            </div>

            <footer className={`flex flex-wrap items-center justify-between gap-2 border-t py-5 text-xs ${theme.line} ${theme.muted}`}>
              <span>Trading Pulse · Development build</span>
              <span>Demo values only · No financial advice</span>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}
