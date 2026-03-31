import { createContext, useContext, useEffect, useState } from "react";
import {
  loadUsersFromBackend,
  saveUsersToBackend,
} from "../services/backendStorage";

export type UserRole = "admin" | "premium" | "guest";
export type UserStatus = "Active" | "Expired" | "Guest";

export interface LuxiaUser {
  uid: string;
  username: string;
  role: UserRole;
  expiryDate: string | null;
  status: UserStatus;
  credits?: number;
  fullName?: string;
  email?: string;
  phone?: string;
  country?: string;
  bio?: string;
}

export interface StoredUser extends LuxiaUser {
  password: string;
}

const USERS_KEY = "luxia_users";
const SESSION_KEY = "luxia_user";

const DEFAULT_USERS: StoredUser[] = [
  {
    uid: "LXU-00001",
    username: "malverin",
    password: "hexermac",
    role: "admin",
    expiryDate: null,
    status: "Active",
    credits: undefined,
  },
  {
    uid: "LXU-00291",
    username: "demo",
    password: "demo123",
    role: "premium",
    expiryDate: null,
    status: "Active",
    credits: 100,
  },
];

const GUEST_USER: LuxiaUser = {
  uid: "LXU-GUEST",
  username: "Guest",
  role: "guest",
  expiryDate: null,
  status: "Guest",
};

function seedUsers() {
  if (!localStorage.getItem(USERS_KEY)) {
    localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
  }
}

function getUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return DEFAULT_USERS;
  }
}

interface AuthContextValue {
  user: LuxiaUser;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: StoredUser) => void;
  updateUser: (updates: Partial<LuxiaUser>) => void;
  updateUserCredits: (uid: string, credits: number) => void;
  isAdmin: boolean;
  usersLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LuxiaUser>(() => {
    seedUsers();
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return GUEST_USER;
  });

  const [usersLoading, setUsersLoading] = useState(true);

  // On mount: sync users from backend (backend is authoritative)
  useEffect(() => {
    loadUsersFromBackend()
      .then((backendRaw) => {
        if (!backendRaw) return;
        try {
          const backendUsers: StoredUser[] = JSON.parse(backendRaw);
          if (!Array.isArray(backendUsers) || backendUsers.length === 0) return;
          // Merge: backend users take priority, preserve any locally added users not in backend
          const localUsers = getUsers();
          const merged = [...backendUsers];
          for (const lu of localUsers) {
            if (!merged.find((bu) => bu.uid === lu.uid)) {
              merged.push(lu);
            }
          }
          localStorage.setItem(USERS_KEY, JSON.stringify(merged));
        } catch {}
      })
      .finally(() => {
        setUsersLoading(false);
      });
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<boolean> => {
    // First attempt with whatever is in localStorage
    const tryLogin = (users: StoredUser[]): boolean => {
      const found = users.find(
        (u) => u.username === username && u.password === password,
      );
      if (!found) return false;
      const { password: _pw, ...userData } = found;
      if (userData.role === "premium" && userData.credits === undefined) {
        userData.credits = 100;
      }
      setUser(userData);
      localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
      return true;
    };

    const localUsers = getUsers();
    if (tryLogin(localUsers)) return true;

    // Not found locally — this may be a new device. Force a fresh sync from backend.
    try {
      const backendRaw = await loadUsersFromBackend();
      if (backendRaw) {
        const backendUsers: StoredUser[] = JSON.parse(backendRaw);
        if (Array.isArray(backendUsers) && backendUsers.length > 0) {
          // Merge backend users into localStorage
          const merged = [...backendUsers];
          for (const lu of localUsers) {
            if (!merged.find((bu) => bu.uid === lu.uid)) {
              merged.push(lu);
            }
          }
          localStorage.setItem(USERS_KEY, JSON.stringify(merged));
          // Retry login with freshly merged list
          if (tryLogin(merged)) return true;
        }
      }
    } catch {
      // backend unavailable — fall through
    }

    return false;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(GUEST_USER);
  };

  const addUser = (newUser: StoredUser) => {
    const users = getUsers();
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    // Sync to backend (fire-and-forget)
    saveUsersToBackend(JSON.stringify(users));
  };

  const updateUser = (updates: Partial<LuxiaUser>) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    if (user.role !== "guest") {
      const users = getUsers();
      const idx = users.findIndex((u) => u.uid === user.uid);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        // Sync to backend (fire-and-forget)
        saveUsersToBackend(JSON.stringify(users));
      }
    }
  };

  const updateUserCredits = (uid: string, credits: number) => {
    const users = getUsers();
    const idx = users.findIndex((u) => u.uid === uid);
    if (idx === -1) return;
    users[idx] = { ...users[idx], credits };
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    // Sync to backend (fire-and-forget)
    saveUsersToBackend(JSON.stringify(users));
    if (user.uid === uid) {
      const updated = { ...user, credits };
      setUser(updated);
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        addUser,
        updateUser,
        updateUserCredits,
        isAdmin: user.role === "admin",
        usersLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
