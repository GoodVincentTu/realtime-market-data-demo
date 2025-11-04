import axios from "axios";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3030/api/v1";
export const REALTIME_URL =
  import.meta.env.VITE_REALTIME_URL || "http://localhost:4000/realtime/ticks";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// attach auth per request
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username") || "";
  if (token) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers["Authorization"] = `Bearer ${token}`;
    cfg.headers["X-User"] = username;
  }
  return cfg;
});

// global 401 → logout
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      if (location.pathname !== "/login") location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api;
