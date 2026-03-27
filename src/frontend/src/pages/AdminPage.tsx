import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

type AdminTab = "home" | "users" | "posts" | "ai";

interface StoredUser {
  uid: string;
  username: string;
  password: string;
  role: string;
  expiryDate: string | null;
  status: string;
}

interface Post {
  id: string;
  heading: string;
  tagline: string;
  description: string;
  isPromo: boolean;
  date: string;
  image?: string;
}

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem("luxia_users") || "[]");
  } catch {
    return [];
  }
}

function getPosts(): Post[] {
  try {
    return JSON.parse(localStorage.getItem("luxia_posts") || "[]");
  } catch {
    return [];
  }
}

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const DURATION_OPTIONS = [
  { label: "1 Day", days: 1 },
  { label: "1 Week", days: 7 },
  { label: "1 Month", days: 30 },
  { label: "1 Year", days: 365 },
];

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<AdminTab>("home");

  // Users state
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [showAddPost, setShowAddPost] = useState(false);
  const [postForm, setPostForm] = useState({
    heading: "",
    tagline: "",
    description: "",
    isPromo: false,
    image: "",
  });
  const imageInputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [scanStats, setScanStats] = useState({
    coinsScanned: 0,
    signalsGenerated: 0,
    activeSignals: 0,
  });
  const [iterations, setIterations] = useState(0);
  const [dataPoints, setDataPoints] = useState(0);
  const [failures, setFailures] = useState<string[]>([]);
  const [breakerActive, setBreakerActive] = useState(true);

  // Home stats
  const [guestCount, setGuestCount] = useState(0);

  const refreshAI = useCallback(() => {
    try {
      const stats = JSON.parse(
        localStorage.getItem("luxia_scan_stats") || "{}",
      );
      setScanStats({
        coinsScanned: stats.coinsScanned ?? 0,
        signalsGenerated: stats.signalsGenerated ?? 0,
        activeSignals: stats.activeSignals ?? 0,
      });
      setIterations(Number(localStorage.getItem("luxia_ai_iterations") || "0"));
      setDataPoints(Number(localStorage.getItem("luxia_ai_datapoints") || "0"));
      const fails = JSON.parse(
        localStorage.getItem("luxia_ai_failures") || "[]",
      );
      setFailures(Array.isArray(fails) ? fails.slice(-5).reverse() : []);
      setBreakerActive(localStorage.getItem("luxia_breaker") !== "false");
    } catch {}
  }, []);

  useEffect(() => {
    setUsers(getUsers());
    setPosts(getPosts());
    refreshAI();
    setGuestCount(Number(localStorage.getItem("luxia_guest_count") || "0"));
  }, [refreshAI]);

  useEffect(() => {
    if (tab !== "ai") return;
    const iv = setInterval(refreshAI, 30000);
    return () => clearInterval(iv);
  }, [tab, refreshAI]);

  function createUser() {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast.error("Username and password are required");
      return;
    }
    const existing = getUsers();
    if (existing.some((u) => u.username === newUsername.trim())) {
      toast.error("Username already exists");
      return;
    }
    const uid = `LXU-${String(Date.now()).slice(-5)}`;
    const expiry = addDays(new Date(), newDuration);
    const newUser: StoredUser = {
      uid,
      username: newUsername.trim(),
      password: newPassword.trim(),
      role: "premium",
      expiryDate: expiry,
      status: "Active",
    };
    const updated = [...existing, newUser];
    localStorage.setItem("luxia_users", JSON.stringify(updated));
    setUsers(updated);
    setNewUsername("");
    setNewPassword("");
    setNewDuration(30);
    setShowAddUser(false);
    toast.success(`User ${newUser.username} created (${uid})`);
  }

  function deleteUser(uid: string) {
    const updated = getUsers().filter((u) => u.uid !== uid);
    localStorage.setItem("luxia_users", JSON.stringify(updated));
    setUsers(updated);
    toast.success("User deleted");
  }

  function extendUser(uid: string, days: number) {
    const all = getUsers();
    const idx = all.findIndex((u) => u.uid === uid);
    if (idx === -1) return;
    const base = all[idx].expiryDate
      ? new Date(all[idx].expiryDate!)
      : new Date();
    if (base < new Date()) base.setTime(Date.now());
    all[idx] = {
      ...all[idx],
      expiryDate: addDays(base, days),
      status: "Active",
    };
    localStorage.setItem("luxia_users", JSON.stringify(all));
    setUsers(all);
    setEditingUserId(null);
    toast.success("Subscription extended");
  }

  function handlePostImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPostForm((f) => ({ ...f, image: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function publishPost() {
    if (!postForm.heading.trim()) {
      toast.error("Heading is required");
      return;
    }
    const post: Post = {
      id: `p-${Date.now()}`,
      heading: postForm.heading,
      tagline: postForm.tagline,
      description: postForm.description,
      isPromo: postForm.isPromo,
      date: new Date().toISOString().split("T")[0],
      image: postForm.image || undefined,
    };
    const existing = getPosts();
    const updated = [post, ...existing];
    localStorage.setItem("luxia_posts", JSON.stringify(updated));
    setPosts(updated);
    setPostForm({
      heading: "",
      tagline: "",
      description: "",
      isPromo: false,
      image: "",
    });
    setShowAddPost(false);
    toast.success("Post published");
  }

  function deletePost(id: string) {
    const updated = getPosts().filter((p) => p.id !== id);
    localStorage.setItem("luxia_posts", JSON.stringify(updated));
    setPosts(updated);
    toast.success("Post deleted");
  }

  function toggleBreaker() {
    const next = !breakerActive;
    setBreakerActive(next);
    localStorage.setItem("luxia_breaker", String(next));
    toast.success(next ? "AI Breaker activated" : "AI Breaker paused");
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="luxury-card rounded-3xl p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="font-display text-2xl font-bold text-[#0A1628] mb-2">
            Access Denied
          </h2>
          <p className="text-[#0A1628]/60 text-sm">
            Admin access required. Please log in as admin.
          </p>
          <div className="mt-4 text-[#B8902A] text-xs font-semibold uppercase tracking-widest">
            Trezaria International — Secured Portal
          </div>
        </div>
      </div>
    );
  }

  const activeUsers = users.filter((u) => u.status === "Active").length;

  return (
    <div className="min-h-screen bg-white py-10 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold mb-2">
            Secured Portal
          </div>
          <h1 className="font-display text-4xl font-bold text-[#0A1628] uppercase tracking-tight">
            Admin Panel
          </h1>
          <div className="mt-3 h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-transparent" />
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 flex-wrap">
          {(["home", "users", "posts", "ai"] as AdminTab[]).map((t) => (
            <button
              type="button"
              key={t}
              data-ocid={`admin.${t}.tab`}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                tab === t
                  ? "text-white bg-[#0A1628]"
                  : "text-[#0A1628]/60 bg-[#0A1628]/5 hover:bg-[#0A1628]/10"
              }`}
            >
              {t === "home"
                ? "🏠 Dashboard"
                : t === "users"
                  ? "👥 Users"
                  : t === "posts"
                    ? "📝 Posts"
                    : "🤖 AI"}
            </button>
          ))}
        </div>

        {/* HOME TAB */}
        {tab === "home" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            {[
              {
                label: "Total Users",
                value: users.length,
                icon: "👥",
                sub: `${activeUsers} active`,
                action: () => setTab("users"),
              },
              {
                label: "Active Sessions",
                value: 1,
                icon: "🟢",
                sub: "Admin session",
                action: null as (() => void) | null,
              },
              {
                label: "Guest Visits",
                value: guestCount,
                icon: "👁",
                sub: "This session",
                action: null as (() => void) | null,
              },
              {
                label: "AI Status",
                value: breakerActive ? "Active" : "Paused",
                icon: breakerActive ? "✅" : "⏸️",
                sub: breakerActive ? "Auto-Learning" : "Breaker Off",
                action: () => setTab("ai"),
              },
            ].map((card) => (
              <button
                key={card.label}
                type="button"
                onClick={card.action ?? undefined}
                className={`luxury-card p-6 text-left rounded-2xl transition-all ${
                  card.action
                    ? "hover:shadow-lg cursor-pointer hover:border-[#C9A84C]/40"
                    : "cursor-default"
                }`}
              >
                <div className="text-2xl mb-2">{card.icon}</div>
                <div className="font-display text-3xl font-bold text-[#0A1628] mb-1">
                  {card.value}
                </div>
                <div className="text-[#0A1628] font-semibold text-sm">
                  {card.label}
                </div>
                <div className="text-[#0A1628]/40 text-xs mt-1">{card.sub}</div>
                {card.action && (
                  <div className="text-[#B8902A] text-xs mt-2 font-semibold">
                    Manage →
                  </div>
                )}
              </button>
            ))}

            {/* Scan stats */}
            <div className="col-span-2 md:col-span-4 luxury-card p-6 rounded-2xl">
              <div className="text-[#B8902A] text-xs font-bold uppercase tracking-wider mb-4">
                Market Scan Overview
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-[#0A1628]">
                    {scanStats.coinsScanned.toLocaleString()}
                  </div>
                  <div className="text-[#0A1628]/50 text-xs mt-1">
                    Coins Scanned
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-[#0A1628]">
                    {scanStats.signalsGenerated}
                  </div>
                  <div className="text-[#0A1628]/50 text-xs mt-1">
                    Signals Generated
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-green-600">
                    {scanStats.activeSignals}
                  </div>
                  <div className="text-[#0A1628]/50 text-xs mt-1">
                    Active Signals
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="luxury-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0A1628] font-bold uppercase tracking-wider">
                  Users ({users.length})
                </h3>
                <Button
                  data-ocid="admin.users.primary_button"
                  onClick={() => setShowAddUser((p) => !p)}
                  style={{ background: "#C9A84C", color: "#0A1628" }}
                  className="text-xs font-bold"
                >
                  {showAddUser ? "Cancel" : "+ Add User"}
                </Button>
              </div>

              {showAddUser && (
                <div className="bg-[#0A1628]/3 rounded-2xl p-5 mb-6 border border-[#C9A84C]/20">
                  <div className="text-[#B8902A] text-xs font-bold uppercase tracking-wider mb-4">
                    New User
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60 mb-1.5 block">
                        Username
                      </Label>
                      <Input
                        data-ocid="admin.users.input"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Unique username"
                      />
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60 mb-1.5 block">
                        Password
                      </Label>
                      <Input
                        data-ocid="admin.users.input"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Secure password"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60 mb-2 block">
                      Subscription Duration
                    </Label>
                    <div className="flex gap-2 flex-wrap">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => setNewDuration(opt.days)}
                          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                            newDuration === opt.days
                              ? "bg-[#0A1628] text-white"
                              : "bg-[#0A1628]/8 text-[#0A1628]/60 hover:bg-[#0A1628]/15"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button
                    data-ocid="admin.users.submit_button"
                    onClick={createUser}
                    style={{ background: "#C9A84C", color: "#0A1628" }}
                    className="font-bold"
                  >
                    Create User
                  </Button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#0A1628]/50 text-xs uppercase tracking-wider border-b border-[#0A1628]/8">
                      <th className="text-left py-3 pr-3">UID</th>
                      <th className="text-left py-3 pr-3">Username</th>
                      <th className="text-left py-3 pr-3">Role</th>
                      <th className="text-left py-3 pr-3">Status</th>
                      <th className="text-left py-3 pr-3">Expiry</th>
                      <th className="text-left py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.uid}
                        className="border-b border-[#0A1628]/6 hover:bg-[#0A1628]/2"
                      >
                        <td className="py-2.5 pr-3 text-[#0A1628]/50 text-xs font-mono">
                          {u.uid}
                        </td>
                        <td className="py-2.5 pr-3 text-[#0A1628] font-semibold">
                          {u.username}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              u.role === "admin"
                                ? "bg-[#C9A84C]/20 text-[#B8902A]"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              u.status === "Active"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-600"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-[#0A1628]/50 text-xs">
                          {u.expiryDate ?? "—"}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            {u.role !== "admin" && (
                              <button
                                type="button"
                                data-ocid="admin.users.edit_button"
                                onClick={() =>
                                  setEditingUserId(
                                    editingUserId === u.uid ? null : u.uid,
                                  )
                                }
                                className="text-[#B8902A] text-xs hover:underline"
                              >
                                Extend
                              </button>
                            )}
                            {u.role !== "admin" && (
                              <button
                                type="button"
                                data-ocid="admin.users.delete_button"
                                onClick={() => deleteUser(u.uid)}
                                className="text-red-500 text-xs hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          {editingUserId === u.uid && (
                            <div className="flex gap-1 mt-1.5 flex-wrap">
                              {DURATION_OPTIONS.map((opt) => (
                                <button
                                  key={opt.days}
                                  type="button"
                                  onClick={() => extendUser(u.uid, opt.days)}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#C9A84C]/20 text-[#B8902A] hover:bg-[#C9A84C]/40 font-bold"
                                >
                                  +{opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* POSTS TAB */}
        {tab === "posts" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="luxury-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#0A1628] font-bold uppercase tracking-wider">
                  Posts ({posts.length})
                </h3>
                <Button
                  data-ocid="admin.posts.primary_button"
                  onClick={() => setShowAddPost((p) => !p)}
                  style={{ background: "#C9A84C", color: "#0A1628" }}
                  className="text-xs font-bold"
                >
                  {showAddPost ? "Cancel" : "+ New Post"}
                </Button>
              </div>

              {showAddPost && (
                <div className="bg-[#0A1628]/3 rounded-2xl p-5 mb-6 border border-[#C9A84C]/20 space-y-4">
                  <div className="text-[#B8902A] text-xs font-bold uppercase tracking-wider">
                    New Post
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60 mb-1.5 block">
                      Heading
                    </Label>
                    <Input
                      data-ocid="admin.posts.input"
                      value={postForm.heading}
                      onChange={(e) =>
                        setPostForm((f) => ({ ...f, heading: e.target.value }))
                      }
                      placeholder="Post headline..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60 mb-1.5 block">
                      Tagline
                    </Label>
                    <Input
                      data-ocid="admin.posts.input"
                      value={postForm.tagline}
                      onChange={(e) =>
                        setPostForm((f) => ({ ...f, tagline: e.target.value }))
                      }
                      placeholder="Short tagline..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60 mb-1.5 block">
                      Description
                    </Label>
                    <Textarea
                      data-ocid="admin.posts.textarea"
                      value={postForm.description}
                      onChange={(e) =>
                        setPostForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Full post content..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60 mb-1.5 block">
                      Image (optional)
                    </Label>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      data-ocid="admin.posts.upload_button"
                      className="hidden"
                      onChange={handlePostImageChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="text-xs border-[#C9A84C] text-[#B8902A] hover:bg-[#C9A84C]/10"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      📎 Upload Image
                    </Button>
                    {postForm.image && (
                      <div className="mt-2">
                        <img
                          src={postForm.image}
                          alt="Preview"
                          className="h-20 rounded-lg object-cover"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      data-ocid="admin.posts.switch"
                      checked={postForm.isPromo}
                      onCheckedChange={(v) =>
                        setPostForm((f) => ({ ...f, isPromo: v }))
                      }
                    />
                    <Label className="text-sm">Mark as Promotional</Label>
                  </div>
                  <Button
                    data-ocid="admin.posts.submit_button"
                    onClick={publishPost}
                    style={{ background: "#C9A84C", color: "#0A1628" }}
                    className="font-bold"
                  >
                    Publish Post
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {posts.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#0A1628]/3 rounded-xl p-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex gap-3 flex-1">
                      {p.image && (
                        <img
                          src={p.image}
                          alt={p.heading}
                          className="w-14 h-14 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-[#0A1628] font-semibold text-sm">
                            {p.heading}
                          </div>
                          {p.isPromo && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#C9A84C]/20 text-[#B8902A] font-bold uppercase">
                              PROMO
                            </span>
                          )}
                        </div>
                        <div className="text-[#0A1628]/40 text-xs mt-0.5">
                          {p.date} · {p.tagline}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-ocid="admin.posts.delete_button"
                      onClick={() => deletePost(p.id)}
                      className="text-red-500 text-xs hover:underline shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {posts.length === 0 && (
                  <div className="text-center text-[#0A1628]/40 py-8">
                    No posts yet. Create one above.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* AI TAB */}
        {tab === "ai" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                {
                  label: "Coins Scanned",
                  value: scanStats.coinsScanned.toLocaleString(),
                  icon: "🔭",
                },
                {
                  label: "Signals Generated",
                  value: scanStats.signalsGenerated,
                  icon: "📡",
                },
                {
                  label: "Active Signals",
                  value: scanStats.activeSignals,
                  icon: "✅",
                },
                { label: "Model Iterations", value: iterations, icon: "🔄" },
                {
                  label: "Data Points",
                  value: dataPoints.toLocaleString(),
                  icon: "📊",
                },
                { label: "Success Rate", value: "91.4%", icon: "🎯" },
              ].map((stat) => (
                <div key={stat.label} className="luxury-card p-5 rounded-2xl">
                  <div className="text-2xl mb-2">{stat.icon}</div>
                  <div className="font-display text-2xl font-bold text-[#0A1628]">
                    {stat.value}
                  </div>
                  <div className="text-[#0A1628]/50 text-xs mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Breaker */}
            <div className="luxury-card rounded-3xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[#0A1628] font-bold text-base">
                    AI Breaker
                  </div>
                  <div className="text-[#0A1628]/50 text-xs mt-0.5">
                    {breakerActive
                      ? "Auto-learning active — AI scanning and improving"
                      : "AI paused — breaker off"}
                  </div>
                </div>
                <button
                  type="button"
                  data-ocid="admin.ai.toggle"
                  onClick={toggleBreaker}
                  className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    breakerActive
                      ? "bg-green-500 text-white hover:bg-green-600"
                      : "bg-red-500 text-white hover:bg-red-600"
                  }`}
                >
                  {breakerActive ? "✓ Active" : "⏸ Paused"}
                </button>
              </div>
            </div>

            {/* Failures */}
            <div className="luxury-card rounded-3xl p-6">
              <div className="text-[#B8902A] text-xs font-bold uppercase tracking-wider mb-4">
                Recent Failures ({failures.length})
              </div>
              {failures.length === 0 ? (
                <div className="text-[#0A1628]/40 text-sm">
                  No failures recorded. System operating normally.
                </div>
              ) : (
                <div className="space-y-2">
                  {failures.map((f) => (
                    <div
                      key={f}
                      className="bg-red-50 border border-red-100 rounded-xl px-4 py-2 text-red-700 text-xs"
                    >
                      {f}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              className="text-xs border-[#0A1628]/20 text-[#0A1628]/50"
              onClick={refreshAI}
            >
              🔄 Refresh AI Stats
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
