export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    // If in production on HTTPS or on Render, prefer relative API path (handled by Next.js rewrites)
    if (window.location.protocol === "https:" || window.location.hostname.includes("onrender.com")) {
      return "";
    }
  }
  return "http://127.0.0.1:8000";
}

export const API_BASE_URL = getApiBaseUrl();

export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const primaryUrl = `${baseUrl}${endpoint}`;
  
  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (err) {
    // If local development failed on port 8000, try port 8010
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      const altUrl = `http://127.0.0.1:8010${endpoint}`;
      try {
        const altRes = await fetch(altUrl, options);
        return altRes;
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

