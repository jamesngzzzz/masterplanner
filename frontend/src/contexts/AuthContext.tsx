"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { loginApi } from "@/lib/api/auth";
import { fetchPersonalInfo } from "@/lib/api/personal";
import posthog from "posthog-js";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  phone: string | null;
  profileId: string | null;
  login: (phone: string, password: string) => Promise<void>;
  loginWithProfileId: (profileId: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [phone, setPhone] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!phone;

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedPhone = localStorage.getItem("phone");
    const savedProfileId = localStorage.getItem("profile_id");

    if (token && savedPhone) {
      // Validate token is still alive by calling personal info
      fetchPersonalInfo()
        .then((res) => {
          const pId = res.data?.current_profile?.id || savedProfileId;
          const pName = res.data?.current_profile?.username;
          setPhone(savedPhone);
          if (pId) {
            localStorage.setItem("profile_id", pId);
            setProfileId(pId);
          }
          if (pName) localStorage.setItem("profile_name", pName);
        })
        .catch(() => {
          // Token expired or invalid — clear everything
          localStorage.removeItem("token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("phone");
          localStorage.removeItem("profile_id");
          localStorage.removeItem("profile_name");
        })
        .finally(() => setIsLoading(false));
    } else {
      if (savedProfileId) setProfileId(savedProfileId);
      setIsLoading(false);
    }
  }, []);

  const login = async (inputPhone: string, password: string) => {
    // 1. Đăng nhập lấy token
    const res = await loginApi({ phone: inputPhone, password });

    localStorage.setItem("token", res.data.access_token);
    localStorage.setItem("refresh_token", res.data.refresh_token);
    localStorage.setItem("phone", inputPhone);
    setPhone(inputPhone);

    // 2. Fetch thông tin cá nhân để lấy profile_id
    try {
      const personalRes = await fetchPersonalInfo();
      const pId = personalRes.data?.current_profile?.id;
      const pName = personalRes.data?.current_profile?.username;
      
      if (pId) {
        localStorage.setItem("profile_id", pId);
        setProfileId(pId);
        posthog.identify(pId, { phone: inputPhone, profile_name: pName });
      }
      if (pName) {
        localStorage.setItem("profile_name", pName);
      }
    } catch (e) {
      console.error("Failed to fetch personal info after login", e);
    }

    router.push("/dashboard");
  };

  const loginWithProfileId = async (pId: string) => {
    localStorage.setItem("token", "mock-token-for-testing");
    localStorage.setItem("refresh_token", "mock-refresh-token-for-testing");
    localStorage.setItem("phone", "0000000000");
    localStorage.setItem("profile_id", pId);
    setPhone("0000000000");
    setProfileId(pId);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    try {
      const res = await fetch(`${API_BASE}/api/reasoning/layers?dataset=${pId}`);
      if (res.ok) {
        const data = await res.json();
        const pName = data.child_profile?.name || "Sunny";
        localStorage.setItem("profile_name", pName);
      } else {
        localStorage.setItem("profile_name", "Sunny");
      }
    } catch (e) {
      localStorage.setItem("profile_name", "Sunny");
    }
    posthog.identify(pId);

    router.push("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("phone");
    localStorage.removeItem("profile_id");
    localStorage.removeItem("profile_name");
    setPhone(null);
    setProfileId(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, phone, profileId, login, loginWithProfileId, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
