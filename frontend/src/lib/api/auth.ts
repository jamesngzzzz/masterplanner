import { robotApi } from "@/lib/axios";

interface LoginPayload {
  phone: string;
  password: string;
}

interface LoginResponse {
  status: number;
  message: string;
  data: {
    access_token: string;
    refresh_token: string;
  };
}

const generateDeviceId = () => {
  const random = Math.random().toString(36).substring(2, 15);
  return `WEB-${random}${Date.now()}`;
};

export const loginApi = async (payload: LoginPayload) => {
  const deviceId = generateDeviceId();

  const res = await robotApi.post<LoginResponse>("/api/v1/auth/login", {
    phone: payload.phone,
    password: payload.password,
    device_id: deviceId,
    device_token: deviceId,
    app_v: "web-1.0.0",
    platform: "web",
  });

  return res.data;
};
