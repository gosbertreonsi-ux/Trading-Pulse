
"use client";

import { useMemo, useState } from "react";
import MarketChart from "@/components/MarketChart";

const markets = [
  { symbol: "BTC", name: "Bitcoin", price: "67,482.30", change: "+2.84%", up: true },
  { symbol: "ETH", name: "Ethereum", price: "3,521.86", change: "+1.62%", up: true },
  { symbol: "SOL", name: "Solana", price: "182.47", change: "-0.74%", up: false },
  { symbol: "BNB", name: "BNB", price: "598.24", change: "+0.91%", up: true },
  { symbol: "XRP", name: "XRP", price: "0.6241", change: "-1.21%", up: false },
];

const timeframes = ["1m", "5m", "15m", "1H", "4H", "1D", "1W", "1M"];

export default function Home() {
  const [dark, setDark] = useState(true);
  const [timeframe, setTimeframe] = useState("1D");
  const [selectedMarket, setSelectedMarket] = useState("BTC");
  const [search, setSearch] = useState("");
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  const selected = markets.find((market) => market.symbol === selectedMarket) ?? markets[0];

  const filteredMarkets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return markets.filter((market) =>
      `${market.symbol} ${market.name} ${market.symbol}/USDT`
        .toLowerCase()
        .includes(query)
    );
  }, [search]);

  const theme = dark
    ? {
        page: "bg-[#080b12] text-slate-100",
        panel: "bg-[#0d121c] border-white/[0.08]",
        muted: "text-slate-400",
        subtle: "text-slate-500",
        hover: "hover:bg-white/[0.06]",
        input: "bg-[#080d15] border-white/10",
      }
    : {
        page: "bg-[#f3f6fa] text-slate-900",
        panel: "bg-white border-slate-200",
        muted: "text-slate-500",
        subtle: "text-slate-400",
        hover: "hover:bg-slate-100",
        input: "bg-slate-50 border-slate-200",
      };

  return (
    <main className={`flex h-dvh min-h-[500px] flex-col overflow-hidden ${theme.page}`}>
      <header className={`flex min-h-[60px] shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-5 ${theme.panel}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-lg font-black text-slate-950">
            T
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-bold sm:text-base">
              Trading Pulse
            </div>
            <div className={`text-[10px] ${theme.muted}`}>
              Market intelligence · Simulator
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${theme.input}`}>
            <span className={theme.muted}>⌕</span>
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setWatchlistOpen(true);
              }}
              onFocus={() => setWatchlistOpen(true)}
              placeholder="Search markets"
              aria-label="Search markets"
              className="w-24 min-w-0 bg-transparent text-xs outline-none sm:w-36"
            />
          </label>

          <button
            onClick={() => setDark((value) => !value)}
            className={`rounded-lg border px-3 py-2 text-xs ${theme.input}`}
            aria-label="Toggle theme"
          >
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-1 pb-3">
          <div className="flex items-center gap-3 sm:gap-5">
            <div>
              <div className={`text-[11px] ${theme.muted}`}>Selected market</div>
              <h1 className="mt-0.5 text-lg font-bold sm:text-xl">
                {selected.symbol}/USDT
              </h1>
              <div className={`text-[10px] ${theme.muted}`}>{selected.name}</div>
            </div>

            <div className="border-l border-white/10 pl-3 sm:pl-5">
              <div className="text-base font-semibold sm:text-xl">
                ${selected.price}
              </div>
              <div className={`mt-1 text-xs ${selected.up ? "text-emerald-400" : "text-rose-400"}`}>
                {selected.change} <span className={theme.muted}>24h</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[10px] text-amber-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              SIMULATED DATA
            </span>

            <button
              onClick={() => setWatchlistOpen((value) => !value)}
              aria-expanded={watchlistOpen}
              className={`rounded-lg border px-3 py-2 text-xs ${theme.input}`}
            >
              {watchlistOpen ? "Close markets ×" : "Markets ☰"}
            </button>
          </div>
        </div>

        <section className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border ${theme.panel}`}>
          <div className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-b px-2 py-2 sm:px-3 ${theme.panel}`}>
            <div className="flex max-w-full items-center gap-1 overflow-x-auto">
              {timeframes.map((period) => (
                <button
                  key={period}
                  onClick={() => setTimeframe(period)}
                  aria-pressed={timeframe === period}
                  className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium transition ${
                    timeframe === period
                      ? "bg-cyan-400 text-slate-950"
                      : `${theme.muted} ${theme.hover}`
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            <span className={`px-2 text-[10px] ${theme.subtle}`}>
              OHLC · Candlesticks
            </span>
          </div>

          <div className="relative min-h-0 flex-1">
            <MarketChart
              symbol={`${selected.symbol}USDT`}
              timeframe={timeframe}
            />

            {watchlistOpen && (
              <div className={`absolute right-2 top-2 z-20 w-72 max-w-[calc(100%-1rem)] overflow-hidden rounded-xl border shadow-2xl ${theme.panel}`}>
                <div className={`flex items-center justify-between border-b p-3 ${theme.panel}`}>
                  <div>
                    <div className="text-sm font-semibold">Markets</div>
                    <div className={`mt-1 text-[10px] ${theme.muted}`}>
                      Select an asset to update the chart
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setWatchlistOpen(false);
                      setSearch("");
                    }}
                    className={`rounded-md px-2 py-1 ${theme.muted}`}
                    aria-label="Close markets"
                  >
                    ✕
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                  {filteredMarkets.map((market) => (
                    <button
                      key={market.symbol}
                      onClick={() => {
                        setSelectedMarket(market.symbol);
                        setWatchlistOpen(false);
                        setSearch("");
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left ${
                        selectedMarket === market.symbol
                          ? "bg-cyan-400/10"
                          : theme.hover
                      }`}
                    >
                      <div>
                        <div className="text-sm font-semibold">
                          {market.symbol}/USDT
                        </div>
                        <div className={`mt-1 text-[11px] ${theme.muted}`}>
                          {market.name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-medium">${market.price}</div>
                        <div className={`mt-1 text-xs ${market.up ? "text-emerald-400" : "text-rose-400"}`}>
                          {market.change}
                        </div>
                      </div>
                    </button>
                  ))}

                  {filteredMarkets.length === 0 && (
                    <p className={`p-5 text-center text-xs ${theme.muted}`}>
                      No matching markets.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <footer className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-[10px] ${theme.muted}`}>
            <span>Mouse wheel: zoom · Drag: pan</span>
            <span>Development mode · No live trades</span>
          </footer>
        </section>
      </section>
    </main>
  );
}
