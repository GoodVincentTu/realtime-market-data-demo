import api from "./client";

export async function fetchReadiness() {
  const { data } = await api.get("/health/readiness");
  return data;
}