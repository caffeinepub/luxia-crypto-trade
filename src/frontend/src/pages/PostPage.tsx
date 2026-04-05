import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

interface Post {
  id: string;
  heading: string;
  tagline: string;
  description: string;
  isPromo: boolean;
  date: string;
  image?: string;
  // AI-generated post fields
  isAI?: boolean;
  aiBadge?: "AI RESEARCH" | "100X CANDIDATE" | "GOING TO BOOM" | "GEM ALERT";
  timestamp?: number;
}

const SAMPLE_POSTS: Post[] = [
  {
    id: "p1",
    heading: "BTC Surges Past $70K — What's Next?",
    tagline: "Trezaria International | Market Analysis",
    description:
      "Bitcoin has broken through the $70,000 resistance level with strong volume. Our AI models indicate continued bullish momentum with a potential target of $78,000 in the near term. Key support sits at $66,500.",
    isPromo: false,
    date: "2026-03-25",
  },
  {
    id: "p2",
    heading: "New Premium Plan — 3 Months for the Price of 1",
    tagline: "Limited Time Offer",
    description:
      "For a limited time, Luxia Premium subscribers get 3 months of access at a one-month price. Unlock all signal categories, AI analysis, and live chat. Offer expires March 31, 2026.",
    isPromo: true,
    date: "2026-03-20",
  },
  {
    id: "p3",
    heading: "Ethereum Merge Anniversary — ETH Outlook",
    tagline: "Technical Analysis Report",
    description:
      "One year after the Merge, Ethereum's staking yield remains attractive at 4.2% APY. Our AI signals a consolidation phase before the next rally. Watch the $3,800 resistance level closely.",
    isPromo: false,
    date: "2026-03-15",
  },
];

const AI_BADGE_CONFIG: Record<
  string,
  { bg: string; text: string; icon: string }
> = {
  "100X CANDIDATE": {
    bg: "bg-yellow-500",
    text: "text-[#0A1628]",
    icon: "\u26a1",
  },
  "GOING TO BOOM": {
    bg: "bg-red-500",
    text: "text-white",
    icon: "\ud83d\ude80",
  },
  "AI RESEARCH": {
    bg: "bg-purple-600",
    text: "text-white",
    icon: "\ud83e\udd16",
  },
  "GEM ALERT": {
    bg: "bg-emerald-500",
    text: "text-white",
    icon: "\ud83d\udc8e",
  },
};

export default function PostPage() {
  const { isAdmin } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [aiPosts, setAiPosts] = useState<Post[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    heading: "",
    tagline: "",
    description: "",
    isPromo: false,
    image: "",
  });
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Load admin posts
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("luxia_posts") || "[]");
      setPosts(stored.length > 0 ? stored : SAMPLE_POSTS);
    } catch {
      setPosts(SAMPLE_POSTS);
    }
  }, []);

  // Load AI-generated posts and poll every 15s
  useEffect(() => {
    const load = () => {
      try {
        const raw: {
          id: string;
          heading: string;
          tagline: string;
          description: string;
          badge: string;
          date: string;
          timestamp: number;
        }[] = JSON.parse(localStorage.getItem("luxia_ai_posts") || "[]");
        const mapped: Post[] = raw.slice(0, 20).map((p) => ({
          id: p.id,
          heading: p.heading,
          tagline: p.tagline,
          description: p.description,
          isPromo: false,
          date: p.date,
          isAI: true,
          aiBadge: p.badge as Post["aiBadge"],
          timestamp: p.timestamp,
        }));
        setAiPosts(mapped);
      } catch {
        // ignore
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((f) => ({ ...f, image: ev.target?.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function savePost() {
    if (!form.heading.trim()) {
      toast.error("Heading is required");
      return;
    }
    const newPost: Post = {
      id: `p-${Date.now()}`,
      heading: form.heading,
      tagline: form.tagline,
      description: form.description,
      isPromo: form.isPromo,
      date: new Date().toISOString().split("T")[0],
      image: form.image || undefined,
    };
    const updated = [newPost, ...posts];
    setPosts(updated);
    localStorage.setItem("luxia_posts", JSON.stringify(updated));
    toast.success("Post published");
    setDialogOpen(false);
    setForm({
      heading: "",
      tagline: "",
      description: "",
      isPromo: false,
      image: "",
    });
  }

  // Merge: AI posts first, then admin posts
  const allPosts: Post[] = [...aiPosts, ...posts];

  return (
    <div className="min-h-screen bg-white py-10 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold mb-2">
                Updates
              </div>
              <h1 className="font-display text-3xl font-bold text-[#0A1628] uppercase tracking-tight">
                Posts
              </h1>
              {aiPosts.length > 0 && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-purple-600 animate-pulse">
                    {aiPosts.length} AI RESEARCH POSTS
                  </span>
                  <span className="text-[#0A1628]/40 text-[10px]">
                    Auto-posted by research bots
                  </span>
                </div>
              )}
            </div>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    data-ocid="post.open_modal_button"
                    style={{ background: "#C9A84C", color: "#0A1628" }}
                  >
                    + Create Post
                  </Button>
                </DialogTrigger>
                <DialogContent data-ocid="post.dialog" className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Post</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60">
                        Heading
                      </Label>
                      <Input
                        data-ocid="post.heading_input"
                        value={form.heading}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, heading: e.target.value }))
                        }
                        placeholder="Post headline..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60">
                        Tagline
                      </Label>
                      <Input
                        data-ocid="post.tagline_input"
                        value={form.tagline}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, tagline: e.target.value }))
                        }
                        placeholder="Short tagline..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60">
                        Description
                      </Label>
                      <Textarea
                        data-ocid="post.description_textarea"
                        value={form.description}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Full post content..."
                        rows={4}
                        className="resize-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-[#0A1628]/60">
                        Image (optional)
                      </Label>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        data-ocid="post.upload_button"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full text-xs border-[#C9A84C]/50 text-[#B8902A] hover:bg-[#C9A84C]/10"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        Upload Image
                      </Button>
                      {form.image && (
                        <div className="mt-2">
                          <img
                            src={form.image}
                            alt="Preview"
                            className="h-24 w-full rounded-lg object-cover"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        data-ocid="post.promo_switch"
                        checked={form.isPromo}
                        onCheckedChange={(v) =>
                          setForm((f) => ({ ...f, isPromo: v }))
                        }
                      />
                      <Label className="text-sm">Mark as Promotional</Label>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button
                        data-ocid="post.submit_button"
                        onClick={savePost}
                        className="flex-1"
                        style={{ background: "#C9A84C", color: "#0A1628" }}
                      >
                        Publish
                      </Button>
                      <Button
                        data-ocid="post.cancel_button"
                        variant="outline"
                        onClick={() => setDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="mt-3 h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-transparent" />
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allPosts.map((post, i) => {
            const aiBadgeCfg = post.aiBadge
              ? AI_BADGE_CONFIG[post.aiBadge]
              : null;

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                data-ocid={`post.item.${i + 1}`}
                className={`luxury-card rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 group ${
                  post.isAI ? "ring-1 ring-purple-300/50" : ""
                }`}
              >
                {/* Post header */}
                {post.image ? (
                  <div className="h-28 overflow-hidden relative">
                    <img
                      src={post.image}
                      alt={post.heading}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    {post.isPromo && (
                      <Badge className="absolute top-3 right-3 bg-[#C9A84C] text-[#0A1628] text-[10px] font-bold">
                        PROMO
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div
                    className={`h-28 flex items-center justify-center text-4xl relative overflow-hidden ${
                      post.isAI
                        ? post.aiBadge === "100X CANDIDATE"
                          ? "bg-gradient-to-br from-yellow-900 to-yellow-600"
                          : post.aiBadge === "GOING TO BOOM"
                            ? "bg-gradient-to-br from-red-900 to-red-600"
                            : post.aiBadge === "GEM ALERT"
                              ? "bg-gradient-to-br from-emerald-900 to-emerald-600"
                              : "bg-gradient-to-br from-purple-900 to-purple-600"
                        : "bg-gradient-to-br from-[#0A1628] to-[#1a3558]"
                    }`}
                  >
                    <div
                      className="absolute inset-0 opacity-10"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 30% 50%, #C9A84C 0%, transparent 60%)",
                      }}
                    />
                    <span className="relative z-10">
                      {post.isAI
                        ? post.aiBadge === "100X CANDIDATE"
                          ? "\u26a1"
                          : post.aiBadge === "GOING TO BOOM"
                            ? "\ud83d\ude80"
                            : post.aiBadge === "GEM ALERT"
                              ? "\ud83d\udc8e"
                              : "\ud83e\udd16"
                        : post.isPromo
                          ? "\ud83d\udce3"
                          : "\ud83d\udcdd"}
                    </span>
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      {post.isAI && aiBadgeCfg && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            aiBadgeCfg.bg
                          } ${aiBadgeCfg.text}`}
                        >
                          {aiBadgeCfg.icon} {post.aiBadge}
                        </span>
                      )}
                      {post.isPromo && !post.isAI && (
                        <Badge className="bg-[#C9A84C] text-[#0A1628] text-[10px] font-bold">
                          PROMO
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#0A1628]/40 text-[10px]">
                      {post.date}
                    </span>
                    {post.isAI && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                        AI BOT
                      </span>
                    )}
                  </div>
                  <h3 className="text-[#0A1628] font-bold text-base mb-1 group-hover:text-[#B8902A] transition-colors leading-snug">
                    {post.heading}
                  </h3>
                  {post.tagline && (
                    <p className="text-[#B8902A] text-xs font-semibold mb-2">
                      {post.tagline}
                    </p>
                  )}
                  <p className="text-[#0A1628]/60 text-xs leading-relaxed">
                    {post.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
