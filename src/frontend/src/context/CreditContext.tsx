import { createContext, useContext, useEffect, useState } from "react";
import { saveUsersToBackend } from "../services/backendStorage";
import { useAuth } from "./AuthContext";

interface CreditContextValue {
  credits: number;
  spendCredit: () => boolean;
  isLocked: boolean;
}

const CreditContext = createContext<CreditContextValue | null>(null);

const GUEST_SESSION_KEY = "luxia_guest_credits";
const USERS_KEY = "luxia_users";
const SESSION_KEY = "luxia_user";

function getGuestCredits(): number {
  const stored = sessionStorage.getItem(GUEST_SESSION_KEY);
  if (stored === null) {
    sessionStorage.setItem(GUEST_SESSION_KEY, "10");
    return 10;
  }
  return Math.max(0, Number.parseInt(stored, 10) || 0);
}

function getUserCreditsFromStorage(uid: string): number {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const found = users.find(
      (u: { uid: string; credits?: number }) => u.uid === uid,
    );
    if (found && found.credits !== undefined) return Math.max(0, found.credits);
    return 100; // default
  } catch {
    return 100;
  }
}

function setUserCreditsInStorage(uid: string, credits: number) {
  try {
    const users = JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
    const idx = users.findIndex((u: { uid: string }) => u.uid === uid);
    if (idx !== -1) {
      users[idx] = { ...users[idx], credits };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
      // Sync to backend so credit balance is accurate on all devices
      saveUsersToBackend(JSON.stringify(users));
    }
    // Also update session
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session && session.uid === uid) {
      session.credits = credits;
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch {}
}

export function CreditProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";
  const isGuest = user.role === "guest";

  const [credits, setCredits] = useState<number>(() => {
    if (isAdmin) return Number.POSITIVE_INFINITY;
    if (isGuest) return getGuestCredits();
    // premium: load from storage
    return getUserCreditsFromStorage(user.uid);
  });

  // Re-sync when user changes (e.g. after login)
  useEffect(() => {
    if (isAdmin) {
      setCredits(Number.POSITIVE_INFINITY);
    } else if (isGuest) {
      setCredits(getGuestCredits());
    } else {
      setCredits(getUserCreditsFromStorage(user.uid));
    }
  }, [user.uid, isAdmin, isGuest]);

  const spendCredit = (): boolean => {
    if (isAdmin) return true;
    if (credits <= 0) return false;
    const newCredits = credits - 1;
    setCredits(newCredits);
    if (isGuest) {
      sessionStorage.setItem(GUEST_SESSION_KEY, String(newCredits));
    } else {
      setUserCreditsInStorage(user.uid, newCredits);
    }
    return true;
  };

  const isLocked = !isAdmin && credits <= 0;

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
          Signal Credits Used Up
        </h2>
        <p className="text-[#0A1628]/60 text-sm mb-6">
          Your signal credits are used up. Contact the founder on Instagram to
          purchase more credits.
        </p>
        <a
          href="https://www.instagram.com/malverin_stonehart?igsh=emUwMWVkOHY3bWMz&utm_source=qr"
          target="_blank"
          rel="noopener noreferrer"
          data-ocid="credit_lockout.button"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#0A1628] font-bold text-sm tracking-wider hover:from-[#B8902A] hover:to-[#C9A84C] transition-all"
        >
          Contact Founder on Instagram
        </a>
      </div>
    </div>
  );
}
