import createApiClient from "@/lib/axios";

// Client gọi API nội bộ của Next.js (same-origin) để tránh CORS.
const webApi = createApiClient("");

const DEVICE_ID_KEY = "device_id";

export const getOrCreateDeviceId = (): string => {
  if (typeof window === "undefined") return "WEB-SSR";
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const random = Math.random().toString(36).substring(2, 15);
  const id = `WEB-${random}${Date.now()}`;
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
};

export interface PersonalInfoResponse {
  status: number;
  message: string;
  data: {
    phone: string;
    user_id: string;
    is_complete_onboard: boolean;
    is_complete_onboard_v2: boolean;
    has_ever_mapped_to_robot: boolean;
    is_mapping_to_robot: boolean;
    current_profile?: {
      id: string;
      username: string;
      avatar: string;
      createdAt: string;
    };
  };
}

export const fetchPersonalInfo = async (params?: {
  device_id?: string;
  app_v?: string;
  platform?: string;
}): Promise<PersonalInfoResponse> => {
  const deviceId = params?.device_id || getOrCreateDeviceId();
  const appV = params?.app_v || "web-1.0.0";
  const platform = params?.platform || "web";

  // Gọi qua Next.js API route để tránh CORS từ domain robot-api.
  const { data } = await webApi.get<PersonalInfoResponse>(
    "/api/robot/personal-info",
    {
      params: {
        device_id: deviceId,
        app_v: appV,
        platform,
      },
    }
  );
  return data;
};
