declare global {
  interface Window {
    __APP_CONFIG__?: {
      VITE_API_URL?: string;
      VITE_GOOGLE_CLIENT_ID?: string;
    };
  }
}

const API_BASE = window.__APP_CONFIG__?.VITE_API_URL || import.meta.env.VITE_API_URL || "";

async function handleResponse(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

export async function apiGet(path: string) {
  const res = await fetch(API_BASE + path, {
    headers: { Accept: "application/json" },
  });
  return handleResponse(res);
}

export async function apiPost(path: string, body: any) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function apiPatch(path: string, body: any) {
  const res = await fetch(API_BASE + path, {
    method: "PATCH",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function apiDelete(path: string) {
  const res = await fetch(API_BASE + path, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  return handleResponse(res);
}
