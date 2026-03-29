import { Toaster } from "@/components/ui/sonner";
import {
  Activity,
  BarChart3,
  BookOpen,
  Cpu,
  Home,
  LogIn,
  LogOut,
  Menu,
  RefreshCw,
  Rocket,
  Search,
  Settings,
  Shield,
  TrendingUp,
  User,
  UserCircle,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import LoginModal from "./components/LoginModal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import {
  CreditLockout,
  CreditProvider,
  useCredits,
} from "./context/CreditContext";
import { ScanProvider, useScan } from "./context/ScanContext";
import AISkillsPage from "./pages/AISkillsPage";
import ActiveSignalsPage from "./pages/ActiveSignalsPage";
import AdminPage from "./pages/AdminPage";
import DashboardPage from "./pages/DashboardPage";
import FastTradePage from "./pages/FastTradePage";
import FounderPage from "./pages/FounderPage";
import HighProfitPage from "./pages/HighProfitPage";
import HomePage from "./pages/HomePage";
import NewsPage from "./pages/NewsPage";
import PostPage from "./pages/PostPage";
import ProfilePage from "./pages/ProfilePage";
import SearchPage from "./pages/SearchPage";
import SignalsPage from "./pages/SignalsPage";
import SuperHighProfitPage from "./pages/SuperHighProfitPage";
import TrackingPage from "./pages/TrackingPage";
import TradeNowPage from "./pages/TradeNowPage";

export type Page =
  | "home"
  | "fast"
  | "tradeNow"
  | "active"
  | "highProfit"
  | "superHighProfit"
  | "search"
  | "tracking"
  | "founder"
  | "profile"
  | "post"
  | "news"
  | "dashboard"
  | "signals"
  | "admin"
  | "aiSkills";

const TOP_TABS = [
  { id: "home" as Page, label: "HOME", Icon: Home },
  { id: "fast" as Page, label: "FAST TRADE", Icon: Zap },
  { id: "tradeNow" as Page, label: "TRADE NOW", Icon: TrendingUp },
  { id: "active" as Page, label: "ACTIVE SIGNALS", Icon: Activity },
  { id: "highProfit" as Page, label: "HIGH PROFIT", Icon: BarChart3 },
  { id: "superHighProfit" as Page, label: "SUPER HIGH", Icon: Rocket },
  { id: "search" as Page, label: "SEARCH", Icon: Search },
  { id: "tracking" as Page, label: "TRACKING", Icon: BookOpen },
  { id: "founder" as Page, label: "FOUNDER", Icon: User },
  { id: "aiSkills" as Page, label: "AI SKILLS", Icon: Cpu },
];

const SIDEBAR_TABS = [
  { id: "profile" as Page, label: "Profile", Icon: User },
  { id: "home" as Page, label: "Home", Icon: Home },
  { id: "post" as Page, label: "Post", Icon: BookOpen },
  { id: "news" as Page, label: "News", Icon: Activity },
  { id: "tracking" as Page, label: "Tracking", Icon: TrendingUp },
  { id: "dashboard" as Page, label: "AI Dashboard", Icon: Settings },
  { id: "founder" as Page, label: "Founder", Icon: UserCircle },
  { id: "aiSkills" as Page, label: "AI Skills", Icon: Cpu },
];

function formatExpiry(expiryDate: string | null, role: string): string {
  if (role === "admin") return "Unlimited";
  if (!expiryDate) return "Guest";
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return "Guest";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusColor(status: string): string {
  if (status === "Active") return "text-green-400";
  if (status === "Expired") return "text-red-400";
  return "text-yellow-400";
}

function RescanButton() {
  const { scanning, progress, rescan, totalSessionScans } = useScan();
  return (
    <button
      type="button"
      data-ocid="nav.rescan.button"
      onClick={rescan}
      disabled={scanning}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all border ${
        scanning
          ? "bg-amber-50 border-amber-300 text-amber-700 cursor-not-allowed"
          : "bg-[#0A1628] border-[#0A1628] text-white hover:bg-[#0A1628]/80"
      }`}
    >
      <RefreshCw size={12} className={scanning ? "animate-spin" : ""} />
      {scanning
        ? `${progress.scanned}/${progress.total}`
        : `Rescan${totalSessionScans > 0 ? ` (${totalSessionScans})` : ""}`}
    </button>
  );
}

function AppInner() {
  const { user, logout, isAdmin } = useAuth();
  const { credits, isLocked } = useCredits();
  const [page, setPage] = useState<Page>("home");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const topTabs = isAdmin
    ? [...TOP_TABS, { id: "admin" as Page, label: "ADMIN", Icon: Shield }]
    : TOP_TABS;

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    setSidebarOpen(false);
    setPage("home");
  };

  const avatarLetter = user.username.charAt(0).toUpperCase();

  const renderPage = () => {
    switch (page) {
      case "home":
        return <HomePage onNavigate={navigate} />;
      case "fast":
        return <FastTradePage />;
      case "tradeNow":
        return <TradeNowPage />;
      case "active":
        return <ActiveSignalsPage />;
      case "highProfit":
        return <HighProfitPage />;
      case "superHighProfit":
        return <SuperHighProfitPage />;
      case "search":
        return <SearchPage />;
      case "tracking":
        return <TrackingPage />;
      case "founder":
        return <FounderPage />;
      case "profile":
        return <ProfilePage />;
      case "post":
        return <PostPage />;
      case "news":
        return <NewsPage />;
      case "dashboard":
        return <DashboardPage />;
      case "signals":
        return <SignalsPage />;
      case "admin":
        return isAdmin ? <AdminPage /> : <HomePage onNavigate={navigate} />;
      case "aiSkills":
        return <AISkillsPage />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {isLocked && <CreditLockout />}
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#0A1628]/10 shadow-sm">
        {/* Row 1: Hamburger + Brand + Rescan + Login */}
        <div className="flex items-center h-14 px-4 gap-3">
          <button
            type="button"
            data-ocid="sidebar.toggle"
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#0A1628]/5 text-[#0A1628] transition-colors shrink-0"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex flex-col leading-tight flex-1 min-w-0">
            <span className="text-[#B8902A] font-bold text-sm tracking-widest uppercase truncate">
              Luxia Crypto Trade
            </span>
            <span className="text-[#0A1628]/50 text-[9px] tracking-wider">
              powered by Trezaria International
            </span>
          </div>
          {/* Right side controls */}
          <div className="flex items-center gap-2 shrink-0">
            <RescanButton />
            {user.role === "guest" ? (
              <button
                type="button"
                data-ocid="nav.login.button"
                onClick={() => setLoginOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] hover:from-[#B8902A] hover:to-[#C9A84C] transition-all"
              >
                <LogIn size={12} />
                Login
              </button>
            ) : (
              <button
                type="button"
                data-ocid="nav.username.button"
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0A1628] hover:bg-[#0A1628]/5 transition-all border border-[#0A1628]/10"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center text-[#0A1628] font-bold text-[10px]">
                  {avatarLetter}
                </div>
                {user.username}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Snackbar tab navigation */}
        <div className="bg-[#0A1628]/[0.03] border-t border-[#0A1628]/[0.06]">
          <nav
            className="overflow-x-auto scrollbar-none px-3 py-1.5"
            style={{ scrollbarWidth: "none" }}
          >
            <div className="flex items-center gap-1 min-w-max">
              {topTabs.map(({ id, label, Icon }) => {
                const active = page === id;
                return (
                  <button
                    type="button"
                    key={id}
                    data-ocid={`nav.${id}.tab`}
                    onClick={() => navigate(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest uppercase transition-all whitespace-nowrap ${
                      active
                        ? "bg-[#0A1628] text-white shadow-sm"
                        : "text-[#0A1628]/70 hover:bg-[#0A1628]/5 hover:text-[#0A1628]"
                    }`}
                  >
                    <Icon size={13} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        {/* Gold accent line */}
        <div className="h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-[#A07820] opacity-60" />
      </header>

      {/* Sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-[#0A1628]/20 backdrop-blur-sm"
            />
            <motion.aside
              key="sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 bg-white border-r border-[#0A1628]/10 shadow-2xl flex flex-col"
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#0A1628]/8">
                <span className="text-[#B8902A] font-bold text-sm tracking-widest uppercase">
                  Luxia
                </span>
                <button
                  type="button"
                  data-ocid="sidebar.close_button"
                  onClick={() => setSidebarOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#0A1628]/5 text-[#0A1628]/50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* User profile card */}
              <div className="mx-4 mt-4 p-4 rounded-xl border border-[#C9A84C]/30 bg-gradient-to-br from-[#0A1628] to-[#1a2d4a]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center text-[#0A1628] font-bold text-lg shrink-0">
                    {avatarLetter}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white font-semibold text-sm truncate">
                      {user.username}
                    </div>
                    <div className="text-white/50 text-[10px] tracking-wider">
                      UID: #{user.uid}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-white/[0.06] rounded-lg p-2">
                    <div className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">
                      Expiry
                    </div>
                    <div className="text-white/80 text-xs font-medium leading-tight">
                      {formatExpiry(user.expiryDate, user.role)}
                    </div>
                  </div>
                  <div className="bg-white/[0.06] rounded-lg p-2">
                    <div className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">
                      Status
                    </div>
                    <div
                      className={`text-xs font-bold ${statusColor(user.status)}`}
                    >
                      {user.status}
                    </div>
                  </div>
                </div>
                <div className="bg-white/[0.06] rounded-lg p-2">
                  <div className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">
                    Credits
                  </div>
                  <div className="text-[#C9A84C] text-xs font-bold">
                    {isAdmin ? "∞ Unlimited" : `${credits} remaining`}
                  </div>
                </div>

                <div className="mt-3">
                  {user.role === "guest" ? (
                    <button
                      type="button"
                      data-ocid="sidebar.login.button"
                      onClick={() => {
                        setSidebarOpen(false);
                        setLoginOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] text-xs font-bold tracking-widest uppercase hover:from-[#B8902A] hover:to-[#C9A84C] transition-all"
                    >
                      <LogIn size={13} />
                      Sign In
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-ocid="sidebar.logout.button"
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/[0.08] border border-white/10 text-white/60 text-xs font-semibold tracking-widest uppercase hover:bg-white/[0.12] hover:text-white/80 transition-all"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  )}
                </div>
              </div>

              <div className="mx-4 my-3 h-px bg-[#0A1628]/8" />

              <nav className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto">
                {SIDEBAR_TABS.map(({ id, label, Icon }) => {
                  const active = page === id;
                  return (
                    <button
                      type="button"
                      key={id}
                      data-ocid={`sidebar.${id}.link`}
                      onClick={() => navigate(id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                        active
                          ? "bg-[#0A1628] text-white"
                          : "text-[#0A1628]/70 hover:bg-[#0A1628]/5 hover:text-[#0A1628]"
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  );
                })}
                {isAdmin && (
                  <button
                    type="button"
                    data-ocid="sidebar.admin.link"
                    onClick={() => navigate("admin")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                      page === "admin"
                        ? "bg-[#0A1628] text-white"
                        : "text-[#0A1628]/70 hover:bg-[#0A1628]/5 hover:text-[#0A1628]"
                    }`}
                  >
                    <Shield size={16} />
                    Admin Panel
                  </button>
                )}
              </nav>

              <div className="px-5 py-4 border-t border-[#0A1628]/8">
                <p className="text-[10px] text-[#0A1628]/30 text-center">
                  © {new Date().getFullYear()}. Built with love using{" "}
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
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="pt-[calc(3.5rem+2.5rem+2px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <Toaster />
    </div>
  );
}

function AppWithProviders() {
  return (
    <CreditProvider>
      <ScanProvider>
        <AppInner />
      </ScanProvider>
    </CreditProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppWithProviders />
    </AuthProvider>
  );
}
