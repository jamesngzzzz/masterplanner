import axios, { type AxiosInstance } from "axios";

/** Đồng bộ với AuthContext.logout: xóa phiên và chuyển sang /login */
export const clearSessionAndRedirectToLogin = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("phone");
  localStorage.removeItem("user_id");
  localStorage.removeItem("profile_id");
  localStorage.removeItem("profile_name");
  window.location.href = "/login";
};

const createApiClient = (
  baseURL: string,
  timeoutMs: number = 300000
): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: timeoutMs,
    headers: {
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use(
    (config) => {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      if (status === 401 || status === 449) {
        clearSessionAndRedirectToLogin();
      }

      return Promise.reject(error);
    }
  );

  return client;
};

export const robotApi = createApiClient(
  process.env.NEXT_PUBLIC_ROBOT_API_URL || ""
);

export default createApiClient;
