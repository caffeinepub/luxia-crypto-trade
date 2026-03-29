import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
}

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400));
    const ok = login(username.trim(), password);
    setLoading(false);
    if (!ok) {
      setError("Invalid username or password.");
    } else {
      setUsername("");
      setPassword("");
      onClose();
    }
  };

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#ffffff",
    WebkitTextFillColor: "#ffffff",
    caretColor: "#C9A84C",
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="login-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-[#0A1628]/40 backdrop-blur-sm"
          />
          <motion.div
            key="login-modal"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="w-full max-w-sm pointer-events-auto rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #0A1628 0%, #1a2d4a 100%)",
                border: "1px solid rgba(201,168,76,0.3)",
              }}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-[#C9A84C]" />
                  <span className="text-[#C9A84C] text-[10px] tracking-widest uppercase font-bold">
                    Member Access
                  </span>
                </div>
                <h2 className="text-white font-bold text-xl tracking-wide">
                  Sign In
                </h2>
                <p className="text-white/40 text-xs mt-0.5">
                  Enter your credentials to access Luxia
                </p>
              </div>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="px-6 py-5 flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label className="text-white/60 text-xs tracking-wider uppercase">
                    Username
                  </Label>
                  <Input
                    data-ocid="login.input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    autoComplete="username"
                    required
                    style={inputStyle}
                    className="placeholder:text-white/30 focus:border-[#C9A84C]/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-white/60 text-xs tracking-wider uppercase">
                    Password
                  </Label>
                  <Input
                    data-ocid="login.input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    required
                    style={inputStyle}
                    className="placeholder:text-white/30 focus:border-[#C9A84C]/50 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>

                {error && (
                  <p
                    data-ocid="login.error_state"
                    className="text-red-400 text-xs text-center bg-red-500/10 border border-red-500/20 rounded-lg py-2"
                  >
                    {error}
                  </p>
                )}

                <Button
                  data-ocid="login.submit_button"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] font-bold tracking-widest uppercase hover:from-[#B8902A] hover:to-[#C9A84C] border-0 mt-1"
                >
                  {loading ? "Signing In..." : "Sign In"}
                </Button>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-white/30 text-xs text-center hover:text-white/60 transition-colors"
                >
                  Continue as Guest
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
