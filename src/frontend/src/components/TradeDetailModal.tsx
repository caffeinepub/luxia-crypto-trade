import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import type { Signal } from "../services/signalEngine";

interface Props {
  signal: Signal | null;
  open: boolean;
  onClose: () => void;
}

function formatPrice(p: number): string {
  if (p >= 1000)
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(6)}`;
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0m 00s";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatMaxHold(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.floor(hours / 24)}d ${Math.round(hours % 24)}h`;
}

function MiniChart({ signal }: { signal: Signal }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const price = signal.currentPrice;
    const momentum = signal.momentum;
    const points: number[] = [];
    let p = price * (1 - momentum / 100);
    const seed = signal.hourSeed;
    let r = seed;
    for (let i = 0; i < 24; i++) {
      r = (r * 1664525 + 1013904223) >>> 0;
      const move = (r / 4294967296 - 0.47) * 0.012 * p;
      p += move;
      points.push(p);
    }
    points.push(price);

    const W = canvas.width;
    const H = canvas.height;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    ctx.clearRect(0, 0, W, H);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    const isUp = points[points.length - 1] >= points[0];
    grad.addColorStop(0, isUp ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)");
    grad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((pt - min) / range) * H * 0.8 - H * 0.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    points.forEach((pt, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((pt - min) / range) * H * 0.8 - H * 0.1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = isUp ? "#22c55e" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [signal]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={100}
      className="w-full rounded-lg"
    />
  );
}

export default function TradeDetailModal({ signal, open, onClose }: Props) {
  const [currentPrice, setCurrentPrice] = useState(signal?.currentPrice ?? 0);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef(0);

  useEffect(() => {
    if (!signal) return;
    setCurrentPrice(signal.currentPrice);
    // Init countdown from estimated hours
    const initialSecs = Math.round(signal.estimatedHours * 3600);
    countdownRef.current = initialSecs;
    setCountdown(initialSecs);
  }, [signal]);

  // Tick countdown
  useEffect(() => {
    if (!open || !signal) return;
    const interval = setInterval(() => {
      countdownRef.current = Math.max(0, countdownRef.current - 1);
      if (countdownRef.current === 0) {
        // Fallback reset
        const fallback =
          signal.atr !== 0
            ? Math.floor(((signal.entryPrice * 0.025) / signal.atr) * 24)
            : 24;
        countdownRef.current = Math.max(1, fallback) * 3600;
      }
      setCountdown(countdownRef.current);
    }, 1000);
    return () => clearInterval(interval);
  }, [open, signal]);

  // Update price every 30s
  useEffect(() => {
    if (!open || !signal) return;
    const interval = setInterval(() => {
      const noise = (Math.random() - 0.5) * 0.002 * signal.entryPrice;
      setCurrentPrice((prev) =>
        Math.max(signal.entryPrice * 0.9, prev + noise),
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [open, signal]);

  if (!signal) return null;

  const isLong = signal.direction === "LONG";
  const safeExit = isLong
    ? signal.entryPrice + (currentPrice - signal.entryPrice) * 0.6
    : signal.entryPrice - (signal.entryPrice - currentPrice) * 0.6;

  const aiInsight =
    signal.confidence >= 95
      ? "High probability breakout detected"
      : signal.confidence >= 90
        ? "Strong momentum alignment"
        : signal.confidence >= 87
          ? "Moderate confidence — monitor closely"
          : "Low confidence — exercise caution";

  const rsiState =
    signal.rsiValue < 30
      ? "Oversold"
      : signal.rsiValue > 70
        ? "Overbought"
        : "Neutral";
  const macdState =
    signal.macdHistogram > 0 ? "Bullish crossover" : "Bearish crossover";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-y-auto max-h-[90vh] p-0">
        {/* Header */}
        <div
          className={`p-5 rounded-t-2xl ${
            isLong
              ? "bg-gradient-to-r from-green-600 to-emerald-500"
              : "bg-gradient-to-r from-red-600 to-rose-500"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-white font-bold text-xl">
              {signal.symbol}
            </span>
            <Badge
              className={`text-white font-bold ${
                isLong ? "bg-green-700" : "bg-red-700"
              }`}
            >
              {signal.direction}
            </Badge>
          </div>
          <div className="text-white/80 text-sm">
            Live:{" "}
            <span className="text-white font-semibold">
              {formatPrice(currentPrice)}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Chart */}
          <div>
            <div className="text-xs text-gray-500 mb-1 font-medium">
              24h Price Action
            </div>
            <MiniChart signal={{ ...signal, currentPrice }} />
          </div>

          {/* Entry / TP / SL */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: "Entry",
                val: signal.entryPrice,
                color: "text-[#0A1628]",
              },
              {
                label: "Take Profit",
                val: signal.takeProfit,
                color: "text-green-600",
              },
              {
                label: "Stop Loss",
                val: signal.stopLoss,
                color: "text-red-500",
              },
            ].map(({ label, val, color }) => (
              <div
                key={label}
                className="bg-gray-50 rounded-xl p-3 text-center"
              >
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">
                  {label}
                </div>
                <div className={`font-bold text-sm ${color}`}>
                  {formatPrice(val)}
                </div>
              </div>
            ))}
          </div>

          {/* Countdown */}
          <div className="bg-[#0A1628] rounded-xl p-4">
            <div className="text-white/50 text-xs uppercase tracking-wider mb-1">
              Time to TP (from entry)
            </div>
            <div className="text-[#C9A84C] font-mono text-2xl font-bold">
              {formatCountdown(countdown)}
            </div>
          </div>

          {/* Technical */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="text-xs font-semibold text-[#0A1628] uppercase tracking-wider mb-2">
              Technical Analysis
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400 text-xs">
                  RSI ({signal.rsiValue})
                </span>
                <div className="font-medium text-[#0A1628]">{rsiState}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs">MACD</span>
                <div className="font-medium text-[#0A1628]">{macdState}</div>
              </div>
              <div>
                <span className="text-gray-400 text-xs">EMA Trend</span>
                <div className="font-medium text-[#0A1628]">
                  {signal.trendDirection === "bullish"
                    ? "Uptrend"
                    : "Downtrend"}
                </div>
              </div>
              <div>
                <span className="text-gray-400 text-xs">Volume Ratio</span>
                <div className="font-medium text-[#0A1628]">
                  {signal.volumeRatio.toFixed(2)}x
                </div>
              </div>
            </div>
          </div>

          {/* Safe Exit & Max Hold */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div className="text-[10px] text-amber-600 uppercase tracking-wider mb-1">
                Safe Exit
              </div>
              <div className="font-bold text-amber-700 text-sm">
                {formatPrice(safeExit)}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="text-[10px] text-blue-600 uppercase tracking-wider mb-1">
                Max Hold
              </div>
              <div className="font-bold text-blue-700 text-sm">
                {formatMaxHold(signal.estimatedHours * 1.5)}
              </div>
            </div>
          </div>

          {/* AI Panel */}
          <div className="border border-[#C9A84C]/30 rounded-xl p-4 bg-gradient-to-br from-[#0A1628]/[0.03] to-transparent">
            <div className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider mb-3">
              AI Intelligence
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-gray-400 text-xs">Prediction</div>
                <div
                  className={`font-bold ${isLong ? "text-green-600" : "text-red-500"}`}
                >
                  {isLong ? "UP" : "DOWN"} {signal.tpProbability}%
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Confidence</div>
                <div className="font-bold text-[#0A1628]">
                  {signal.confidence}%
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">Dump Risk</div>
                <div
                  className={`font-bold ${
                    signal.dumpRisk === "Low"
                      ? "text-green-600"
                      : signal.dumpRisk === "Medium"
                        ? "text-amber-500"
                        : "text-red-500"
                  }`}
                >
                  {signal.dumpRisk}
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-xs">ML Score</div>
                <div className="font-bold text-[#0A1628]">
                  {signal.mlScore}/100
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-[#0A1628]/70 italic border-t border-gray-100 pt-3">
              💡 {aiInsight}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
