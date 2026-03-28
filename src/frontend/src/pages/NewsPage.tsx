import { Badge } from "@/components/ui/badge";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { curateNews } from "../services/ai";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  category: string;
  summary: string;
  aiInsight?: string;
  imageUrl?: string;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatHHMM(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Source 1: CryptoCompare
async function fetchCryptoCompare(): Promise<NewsItem[]> {
  const res = await fetch(
    "https://min-api.cryptocompare.com/data/v2/news/?lang=EN&sortOrder=latest",
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return [];
  const data = await res.json();
  if (!data?.Data) return [];
  return data.Data.slice(0, 15).map(
    (item: {
      id: string;
      title: string;
      source: string;
      url: string;
      published_on: number;
      categories: string;
      body: string;
      imageurl?: string;
    }) => ({
      id: `cc-${item.id}`,
      title: item.title,
      source: item.source,
      url: item.url,
      publishedAt: new Date(item.published_on * 1000).toISOString(),
      category: item.categories?.split("|")[0] || "Crypto",
      summary: `${item.body?.slice(0, 180) ?? item.title}...`,
      imageUrl: item.imageurl
        ? `https://www.cryptocompare.com${item.imageurl}`
        : undefined,
    }),
  );
}

// Source 2: CoinTelegraph RSS via rss2json
async function fetchCoinTelegraph(): Promise<NewsItem[]> {
  try {
    const rssUrl = encodeURIComponent("https://cointelegraph.com/rss");
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=10`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.items) return [];
    return data.items.map(
      (item: {
        guid: string;
        title: string;
        link: string;
        pubDate: string;
        description: string;
        thumbnail?: string;
        enclosure?: { link?: string };
      }) => ({
        id: `ct-${item.guid}`,
        title: item.title,
        source: "CoinTelegraph",
        url: item.link,
        publishedAt: new Date(item.pubDate).toISOString(),
        category: detectCategory(item.title),
        summary: `${stripHtml(item.description).slice(0, 180)}...`,
        imageUrl: item.thumbnail || item.enclosure?.link || undefined,
      }),
    );
  } catch {
    return [];
  }
}

// Source 3: CoinDesk RSS via rss2json
async function fetchCoinDesk(): Promise<NewsItem[]> {
  try {
    const rssUrl = encodeURIComponent("https://feeds.feedburner.com/CoinDesk");
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=10`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.items) return [];
    return data.items.map(
      (item: {
        guid: string;
        title: string;
        link: string;
        pubDate: string;
        description: string;
        thumbnail?: string;
        enclosure?: { link?: string };
      }) => ({
        id: `cd-${item.guid}`,
        title: item.title,
        source: "CoinDesk",
        url: item.link,
        publishedAt: new Date(item.pubDate).toISOString(),
        category: detectCategory(item.title),
        summary: `${stripHtml(item.description).slice(0, 180)}...`,
        imageUrl: item.thumbnail || item.enclosure?.link || undefined,
      }),
    );
  } catch {
    return [];
  }
}

// Source 4: Decrypt RSS via rss2json
async function fetchDecrypt(): Promise<NewsItem[]> {
  try {
    const rssUrl = encodeURIComponent("https://decrypt.co/feed");
    const res = await fetch(
      `https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=8`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!data?.items) return [];
    return data.items.map(
      (item: {
        guid: string;
        title: string;
        link: string;
        pubDate: string;
        description: string;
        thumbnail?: string;
      }) => ({
        id: `dc-${item.guid}`,
        title: item.title,
        source: "Decrypt",
        url: item.link,
        publishedAt: new Date(item.pubDate).toISOString(),
        category: detectCategory(item.title),
        summary: `${stripHtml(item.description).slice(0, 180)}...`,
        imageUrl: item.thumbnail || undefined,
      }),
    );
  } catch {
    return [];
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function detectCategory(title: string): string {
  const t = title.toUpperCase();
  if (t.includes("BITCOIN") || t.includes(" BTC")) return "BTC";
  if (t.includes("ETHEREUM") || t.includes(" ETH")) return "ETH";
  if (t.includes("SOLANA") || t.includes(" SOL")) return "SOL";
  if (t.includes("XRP") || t.includes("RIPPLE")) return "XRP";
  if (t.includes("BNB") || t.includes("BINANCE")) return "BNB";
  if (t.includes("REGULATE") || t.includes("SEC") || t.includes("LAW"))
    return "Regulation";
  if (t.includes("AI ") || t.includes(" AI ") || t.includes("ARTIFICIAL"))
    return "AI";
  if (t.includes("FED") || t.includes("MACRO") || t.includes("RATE"))
    return "Macro";
  if (t.includes("DeFi") || t.includes("DEFI")) return "DeFi";
  if (t.includes("NFT")) return "NFT";
  return "Crypto";
}

function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const categoryColors: Record<string, string> = {
  BTC: "bg-orange-100 text-orange-700",
  ETH: "bg-purple-100 text-purple-700",
  SOL: "bg-violet-100 text-violet-700",
  BNB: "bg-yellow-100 text-yellow-700",
  XRP: "bg-blue-100 text-blue-700",
  Macro: "bg-slate-100 text-slate-700",
  Regulation: "bg-red-100 text-red-700",
  AI: "bg-cyan-100 text-cyan-700",
  DeFi: "bg-teal-100 text-teal-700",
  NFT: "bg-pink-100 text-pink-700",
  Crypto: "bg-gray-100 text-gray-700",
};

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [sourceCount, setSourceCount] = useState(0);

  async function loadNews() {
    setLoading(true);
    try {
      // Fetch from all 4 sources in parallel
      const [cc, ct, cd, dc] = await Promise.allSettled([
        fetchCryptoCompare(),
        fetchCoinTelegraph(),
        fetchCoinDesk(),
        fetchDecrypt(),
      ]);

      const allItems: NewsItem[] = [
        ...(cc.status === "fulfilled" ? cc.value : []),
        ...(ct.status === "fulfilled" ? ct.value : []),
        ...(cd.status === "fulfilled" ? cd.value : []),
        ...(dc.status === "fulfilled" ? dc.value : []),
      ];

      const successCount = [cc, ct, cd, dc].filter(
        (r) =>
          r.status === "fulfilled" &&
          (r as PromiseFulfilledResult<NewsItem[]>).value.length > 0,
      ).length;
      setSourceCount(successCount);

      // Sort by newest first, deduplicate
      allItems.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
      );
      const deduped = deduplicateNews(allItems);

      if (deduped.length > 0) {
        // Enrich top 12 with Gemini AI
        const top = deduped.slice(0, 18);
        try {
          const insights = await curateNews(top.map((n) => n.title));
          const enriched = top.map((n, i) => ({
            ...n,
            aiInsight: insights[i] || n.summary,
          }));
          setNews(enriched);
        } catch {
          setNews(top);
        }
      }
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    loadNews();
    // Auto-refresh every 30 minutes
    const interval = setInterval(loadNews, 1800000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white py-10 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold mb-2">
                Multi-Source Live Feed
              </div>
              <h1 className="font-display text-4xl font-bold text-[#0A1628] uppercase tracking-tight">
                Crypto News
              </h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                {["CoinTelegraph", "CoinDesk", "CryptoCompare", "Decrypt"].map(
                  (src) => (
                    <span
                      key={src}
                      className="text-[9px] text-[#0A1628]/50 bg-[#0A1628]/4 px-2 py-0.5 rounded-full border border-[#0A1628]/8"
                    >
                      {src}
                    </span>
                  ),
                )}
              </div>
              <span className="text-[#0A1628]/40 text-xs">
                Updated {formatHHMM(lastUpdated)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#16A34A] bg-[#16A34A]/10 px-3 py-1.5 rounded-full border border-[#16A34A]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                {sourceCount} sources · 30min refresh
              </span>
              <button
                type="button"
                onClick={loadNews}
                disabled={loading}
                className="text-xs px-3 py-1.5 rounded-lg bg-[#0A1628] text-white hover:bg-[#0A1628]/80 disabled:opacity-50 transition-all"
              >
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>
          <div className="mt-3 h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-transparent" />
        </motion.div>

        {loading && news.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="luxury-card rounded-2xl h-64 animate-pulse bg-[#0A1628]/4"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((article, i) => (
              <motion.a
                key={article.id}
                href={article.url !== "#" ? article.url : undefined}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="luxury-card rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group block"
              >
                {article.imageUrl ? (
                  <div className="h-36 overflow-hidden relative">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const t = e.currentTarget as HTMLImageElement;
                        t.style.display = "none";
                        const parent = t.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="w-full h-full bg-gradient-to-br from-[#0A1628] to-[#1a3558] flex items-center justify-center text-3xl">📰</div>`;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>
                ) : (
                  <div className="h-36 bg-gradient-to-br from-[#0A1628] to-[#1a3558] flex items-center justify-center text-3xl relative overflow-hidden">
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 70% 30%, rgba(201,168,76,0.15) 0%, transparent 60%)",
                      }}
                    />
                    <span className="relative z-10">📰</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={`text-[9px] font-semibold uppercase tracking-wider ${
                          categoryColors[article.category] ||
                          categoryColors.Crypto
                        }`}
                      >
                        {article.category}
                      </Badge>
                      <span className="text-[9px] text-[#0A1628]/30 bg-[#0A1628]/4 px-1.5 py-0.5 rounded">
                        {article.source}
                      </span>
                    </div>
                    <span className="text-[#0A1628]/40 text-[10px]">
                      {timeAgo(article.publishedAt)}
                    </span>
                  </div>
                  <h3 className="text-[#0A1628] font-bold text-sm mb-2 leading-snug group-hover:text-[#B8902A] transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  {article.aiInsight && article.aiInsight !== article.title && (
                    <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg p-2 mb-2">
                      <div className="text-[#B8902A] text-[8px] uppercase font-bold mb-0.5">
                        AI Insight
                      </div>
                      <p className="text-[#0A1628]/70 text-[10px] leading-relaxed line-clamp-2">
                        {article.aiInsight}
                      </p>
                    </div>
                  )}
                  <p className="text-[#0A1628]/55 text-[11px] leading-relaxed line-clamp-2">
                    {article.summary}
                  </p>
                  <div className="mt-3 flex items-center justify-end">
                    <span className="text-[#B8902A] text-xs font-semibold">
                      Read more →
                    </span>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
