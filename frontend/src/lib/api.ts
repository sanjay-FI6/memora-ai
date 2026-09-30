export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchWithFallback(endpoint: string, options?: RequestInit): Promise<Response> {
  const primaryUrl = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (err) {
    // If primary failed, try alternate local port
    const altPort = API_BASE_URL.includes(":8000") ? "8010" : "8000";
    const altUrl = `http://127.0.0.1:${altPort}${endpoint}`;
    try {
      const altRes = await fetch(altUrl, options);
      return altRes;
    } catch {
      throw err;
    }
  }
}
