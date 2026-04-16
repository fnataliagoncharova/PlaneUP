const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

if (!rawBaseUrl) {
  throw new Error("Missing VITE_API_BASE_URL. Configure it in frontend/.env");
}

export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");

export const apiUrl = (path) => {
  if (!path) return API_BASE_URL;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};
