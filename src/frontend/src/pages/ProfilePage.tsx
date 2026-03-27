import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    fullName: (user as unknown as Record<string, string>).fullName || "",
    email: (user as unknown as Record<string, string>).email || "",
    phone: (user as unknown as Record<string, string>).phone || "",
    country: (user as unknown as Record<string, string>).country || "",
    bio: (user as unknown as Record<string, string>).bio || "",
  });
  const [saving, setSaving] = useState(false);

  if (user.role === "guest") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-5xl mb-4">👤</div>
          <h2 className="text-[#0A1628] font-bold text-xl mb-2">
            Please sign in
          </h2>
          <p className="text-[#0A1628]/50">
            Sign in to view and edit your profile.
          </p>
        </div>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 400));
    updateUser(form);
    toast.success("Profile updated successfully");
    setSaving(false);
  }

  const avatarLetter = user.username.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-white py-10 px-6">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="text-[#B8902A] text-xs tracking-widest uppercase font-semibold mb-2">
            Account
          </div>
          <h1 className="font-display text-3xl font-bold text-[#0A1628] uppercase tracking-tight">
            Profile
          </h1>
          <div className="mt-3 h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#E8C97A] to-transparent" />
        </motion.div>

        {/* Avatar + read-only info */}
        <div className="luxury-card rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center text-[#0A1628] font-bold text-3xl font-display">
              {avatarLetter}
            </div>
            <div>
              <div className="text-[#0A1628] font-bold text-xl">
                {user.username}
              </div>
              <div className="text-[#0A1628]/40 text-sm">UID: {user.uid}</div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                    user.status === "Active"
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {user.status}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#C9A84C]/15 text-[#B8902A] font-semibold capitalize">
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0A1628]/4 rounded-xl p-3">
              <div className="text-[9px] text-[#0A1628]/40 uppercase tracking-wider mb-0.5">
                Username
              </div>
              <div className="text-[#0A1628] text-sm font-semibold">
                {user.username}
              </div>
              <div className="text-[#0A1628]/30 text-[9px] mt-0.5">
                Cannot be changed
              </div>
            </div>
            <div className="bg-[#0A1628]/4 rounded-xl p-3">
              <div className="text-[9px] text-[#0A1628]/40 uppercase tracking-wider mb-0.5">
                Expiry
              </div>
              <div className="text-[#0A1628] text-sm font-semibold">
                {user.role === "admin"
                  ? "Lifetime"
                  : user.expiryDate
                    ? new Date(user.expiryDate).toLocaleDateString()
                    : "N/A"}
              </div>
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="luxury-card rounded-2xl p-6 space-y-5">
          <h2 className="text-[#0A1628] font-bold uppercase tracking-wider text-sm mb-2">
            Edit Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label
                data-ocid="profile.fullname.input"
                className="text-[#0A1628]/60 text-xs uppercase tracking-wider"
              >
                Full Name
              </Label>
              <Input
                data-ocid="profile.fullname_input"
                value={form.fullName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fullName: e.target.value }))
                }
                placeholder="Your full name"
                className="border-[#0A1628]/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#0A1628]/60 text-xs uppercase tracking-wider">
                Email
              </Label>
              <Input
                data-ocid="profile.email_input"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="your@email.com"
                className="border-[#0A1628]/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#0A1628]/60 text-xs uppercase tracking-wider">
                Phone
              </Label>
              <Input
                data-ocid="profile.phone_input"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                placeholder="+1 234 567 8900"
                className="border-[#0A1628]/20"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#0A1628]/60 text-xs uppercase tracking-wider">
                Country
              </Label>
              <Input
                data-ocid="profile.country_input"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                placeholder="United States"
                className="border-[#0A1628]/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[#0A1628]/60 text-xs uppercase tracking-wider">
              Bio
            </Label>
            <Textarea
              data-ocid="profile.bio_textarea"
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="Tell us about yourself and your trading goals..."
              rows={3}
              className="border-[#0A1628]/20 resize-none"
            />
          </div>

          <Button
            data-ocid="profile.save_button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-11 text-sm font-bold tracking-wider"
            style={{
              background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
              color: "#0A1628",
            }}
          >
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
