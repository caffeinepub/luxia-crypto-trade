import { createContext, useContext, useState } from "react";
import { useAuth } from "./AuthContext";

interface CreditContextValue {
  credits: number;
  spendCredit: () => boolean;
  isLocked: boolean;
}

const CreditContext = createContext<CreditContextValue | null>(null);

const SESSION_KEY = "luxia_guest_credits";

function getStoredCredits(): number {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored === null) {
    sessionStorage.setItem(SESSION_KEY, "10");
    return 10;
  }
  return Math.max(0, Number.parseInt(stored, 10) || 0);
}

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isUnlimited = user.role === "admin" || user.role === "premium";

  const [credits, setCredits] = useState<number>(() =>
    isUnlimited ? Number.POSITIVE_INFINITY : getStoredCredits(),
  );

  const spendCredit = (): boolean => {
    if (isUnlimited) return true;
    if (credits <= 0) return false;
    const newCredits = credits - 1;
    setCredits(newCredits);
    sessionStorage.setItem(SESSION_KEY, String(newCredits));
    return true;
  };

  const isLocked = !isUnlimited && credits <= 0;

  return (
    <CreditContext.Provider value={{ credits, spendCredit, isLocked }}>
      {children}
    </CreditContext.Provider>
  );
}

export function useCredits() {
  const ctx = useContext(CreditContext);
  if (!ctx) throw new Error("useCredits must be inside CreditProvider");
  return ctx;
}

export function CreditLockout() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-6">
      <div className="bg-white rounded-2xl border border-[#C9A84C]/30 shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center text-3xl">
          🔒
        </div>
        <h2 className="text-[#0A1628] font-bold text-xl mb-2">
          Signal Credits Used
        </h2>
        <p className="text-[#0A1628]/60 text-sm mb-6">
          You've used your 10 free signals. Activate your account on Instagram
          to get unlimited access.
        </p>
        <a
          href="https://www.instagram.com/malverin_stonehart?igsh=emUwMWVkOHY3bWMz&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          data-ocid="credit_lockout.button"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] font-bold text-sm tracking-wider hover:from-[#B8902A] hover:to-[#C9A84C] transition-all"
        >
          Activate on Instagram
        </a>
      </div>
    </div>
  );
}
