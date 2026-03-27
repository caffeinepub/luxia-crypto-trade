import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Page } from "../App";
import HeroChart from "../components/HeroChart";
import LiveSignalCard from "../components/LiveSignalCard";
import { useScan } from "../context/ScanContext";
import type { Signal } from "../services/signalEngine";

interface Props {
  onNavigate: (page: Page) => void;
}

const alerts = [
  { msg: "BTC/USD BUY signal triggered", id: "a1" },
  { msg: "ETH target reached +12%", id: "a2" },
  { msg: "SOL SL adjusted to $172", id: "a3" },
  { msg: "BTC/USD BUY signal triggered", id: "b1" },
  { msg: "ETH target reached +12%", id: "b2" },
  { msg: "SOL SL adjusted to $172", id: "b3" },
];

const footerLinks = ["Signals", "News", "About", "Terms", "Privacy"];

const WIN_RATE = 87;
const TOTAL_SIGNALS = 1200;
const MONTHLY_RETURNS = 23;

export default function HomePage({ onNavigate }: Props) {
  const { signals, scanning, progress } = useScan();
  const liveSignals = signals.slice(0, 3);
  const statsRef = useRef({ coinsScanned: 0, activeSignals: 0 });
  const [scanStats, setScanStats] = useState(statsRef.current);

  useEffect(() => {
    const raw = localStorage.getItem("luxia_scan_stats");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setScanStats({
          coinsScanned: parsed.coinsScanned || 0,
          activeSignals: parsed.activeSignals || 0,
        });
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div className="relative bg-white">
      {/* Ticker Bar */}
      <div className="bg-[#0A1628] py-1.5 overflow-hidden">
        <div className="flex gap-8 whitespace-nowrap">
          {alerts.map((a) => (
            <span key={a.id} className="text-[10px] text-white/60 px-4">
              {a.msg}
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="min-h-[90vh] flex items-center pt-8 pb-20 px-6">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col gap-6"
            >
              <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold">
                Elevate Your Trading with Luxia
              </div>
              <h1 className="font-display text-5xl lg:text-6xl font-extrabold text-[#0A1628] leading-[1.05] tracking-tight uppercase">
                Luxury Crypto <span className="text-[#B8902A]">Trading</span>{" "}
                Signals
              </h1>
              <p className="text-[#0A1628]/60 text-lg leading-relaxed max-w-md">
                AI-powered trade signals with 87%+ win rate. Institutional-grade
                insights crafted by Trezaria International's quantitative
                analysts.
              </p>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  data-ocid="home.primary_button"
                  onClick={() => onNavigate("active")}
                  className="bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] px-8 py-3.5 text-sm font-bold tracking-widest uppercase rounded-full hover:from-[#B8902A] hover:to-[#C9A84C] transition-all"
                >
                  View Signals
                </button>
                <button
                  type="button"
                  data-ocid="home.secondary_button"
                  onClick={() => onNavigate("dashboard")}
                  className="px-8 py-3.5 text-sm font-semibold tracking-widest uppercase text-[#0A1628] border border-[#0A1628]/20 rounded-full hover:border-[#B8902A]/50 hover:text-[#B8902A] transition-all"
                >
                  Dashboard
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <div className="border border-[#0A1628]/10 rounded-xl px-4 py-2 text-sm">
                  <span className="text-[#16A34A] font-bold">{WIN_RATE}%</span>
                  <span className="text-[#0A1628]/50 ml-2">Win Rate</span>
                </div>
                <div className="border border-[#0A1628]/10 rounded-xl px-4 py-2 text-sm">
                  <span className="text-[#B8902A] font-bold">
                    {TOTAL_SIGNALS}+
                  </span>
                  <span className="text-[#0A1628]/50 ml-2">Signals</span>
                </div>
                <div className="border border-[#0A1628]/10 rounded-xl px-4 py-2 text-sm">
                  <span className="text-[#0A1628] font-bold">
                    +{MONTHLY_RETURNS}%
                  </span>
                  <span className="text-[#0A1628]/50 ml-2">Monthly</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="hidden lg:block"
            >
              <HeroChart />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Scan Report */}
      <section className="py-12 px-6 bg-[#0A1628]/[0.02] border-y border-[#0A1628]/[0.06]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <h2 className="text-[#0A1628] font-bold text-xl">
              📡 Market Scan Report
            </h2>
            {scanning && (
              <span className="text-xs bg-amber-50 text-amber-600 px-3 py-1 rounded-full animate-pulse">
                Scanning {progress.scanned}/{progress.total} coins...
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Coins Scanned",
                value: scanning
                  ? progress.scanned
                  : scanStats.coinsScanned || progress.scanned,
                icon: "🔍",
              },
              { label: "Active Signals", value: signals.length, icon: "📊" },
              { label: "Win Rate", value: `${WIN_RATE}%`, icon: "🎯" },
              {
                label: "Total Signals",
                value: `${TOTAL_SIGNALS}+`,
                icon: "⚡",
              },
            ].map(({ label, value, icon }) => (
              <div
                key={label}
                className="bg-white rounded-2xl border border-[#0A1628]/8 p-5 text-center shadow-sm"
              >
                <div className="text-2xl mb-2">{icon}</div>
                <div className="text-[#0A1628] font-bold text-2xl">{value}</div>
                <div className="text-[#0A1628]/40 text-xs mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Signals Preview */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[#0A1628] font-bold text-xl">
              🔥 Live Signals
            </h2>
            <button
              type="button"
              data-ocid="home.view_all_button"
              onClick={() => onNavigate("active")}
              className="text-xs text-[#B8902A] font-semibold hover:underline"
            >
              View All →
            </button>
          </div>

          {scanning && liveSignals.length === 0 ? (
            <div className="text-center py-10 text-[#0A1628]/40">
              <div className="text-4xl mb-3 animate-pulse">📡</div>
              <div className="text-sm">
                Scanning {progress.scanned}/{progress.total} coins...
              </div>
            </div>
          ) : liveSignals.length > 0 ? (
            <div
              className="flex gap-4 overflow-x-auto pb-4"
              style={{ scrollbarWidth: "none" }}
            >
              {liveSignals.map((sig: Signal, i: number) => (
                <div key={sig.id} className="flex-shrink-0">
                  <LiveSignalCard signal={sig} index={i} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-[#0A1628]/40">
              <div className="text-4xl mb-3">📊</div>
              <div className="text-sm">No signals yet. Try rescanning.</div>
            </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-6 bg-[#0A1628]">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-white font-bold text-3xl mb-12 text-center">
            Institutional-Grade{" "}
            <span className="text-[#C9A84C]">AI Engine</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "🤖",
                title: "ML Signal Engine",
                desc: "Random Forest model with 7 technical indicators per candle",
              },
              {
                icon: "📈",
                title: "500+ Coins Scanned",
                desc: "Full market scan every 30 seconds with live CoinGecko data",
              },
              {
                icon: "🎯",
                title: "85%+ Confidence Gate",
                desc: "Only high-confidence signals with TP probability ≥72% shown",
              },
            ].map(({ icon, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl border border-white/10 p-6 bg-white/[0.04]"
              >
                <div className="text-3xl mb-3">{icon}</div>
                <div className="text-white font-bold text-lg mb-2">{title}</div>
                <div className="text-white/50 text-sm">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-[#0A1628]/10 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-[#B8902A] font-bold text-sm tracking-widest uppercase">
            Luxia Crypto Trade
          </div>
          <nav className="flex items-center gap-4">
            {footerLinks.map((l) => (
              <span
                key={l}
                className="text-[#0A1628]/40 text-xs hover:text-[#B8902A] cursor-pointer transition-colors"
              >
                {l}
              </span>
            ))}
          </nav>
          <p className="text-[10px] text-[#0A1628]/30">
            © {new Date().getFullYear()}. Built with ❤️ using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[#C9A84C] transition-colors"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
