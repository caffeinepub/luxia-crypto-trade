import { createContext, useContext, useEffect, useState } from "react";

export type UserRole = "admin" | "premium" | "guest";
export type UserStatus = "Active" | "Expired" | "Guest";

export interface LuxiaUser {
  uid: string;
  username: string;
  role: UserRole;
  expiryDate: string | null;
  status: UserStatus;
  fullName?: string;
  email?: string;
  phone?: string;
  country?: string;
  bio?: string;
}

interface StoredUser extends LuxiaUser {
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
  },
  {
    uid: "LXU-00291",
    username: "demo",
    password: "demo123",
    role: "premium",
    expiryDate: "2026-12-31",
    status: "Active",
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
  login: (username: string, password: string) => boolean;
  logout: () => void;
  addUser: (user: StoredUser) => void;
  updateUser: (updates: Partial<LuxiaUser>) => void;
  isAdmin: boolean;
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

  useEffect(() => {
    if (user.expiryDate && user.role !== "admin") {
      const expired = new Date(user.expiryDate) < new Date();
      if (expired && user.status !== "Expired") {
        const updated = { ...user, status: "Expired" as UserStatus };
        setUser(updated);
        localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      }
    }
  }, [user]);

  const login = (username: string, password: string): boolean => {
    const users = getUsers();
    const found = users.find(
      (u) => u.username === username && u.password === password,
    );
    if (!found) return false;
    const { password: _pw, ...userData } = found;
    if (userData.expiryDate && userData.role !== "admin") {
      const expired = new Date(userData.expiryDate) < new Date();
      if (expired) userData.status = "Expired";
    }
    setUser(userData);
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    return true;
  };

  const logout = () => {
    localStorage.removeItem(SESSION_KEY);
    setUser(GUEST_USER);
  };

  const addUser = (newUser: StoredUser) => {
    const users = getUsers();
    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const updateUser = (updates: Partial<LuxiaUser>) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    // Also update in users store if logged in
    if (user.role !== "guest") {
      const users = getUsers();
      const idx = users.findIndex((u) => u.uid === user.uid);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...updates };
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
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
        isAdmin: user.role === "admin",
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
