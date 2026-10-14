export function apiClient(token: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return {
    get: async (url: string) => {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      return res.json();
    },
    post: async (url: string, body: unknown) => {
      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      return res.json();
    },
    patch: async (url: string, body: unknown) => {
      const res = await fetch(url, { method: "PATCH", headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      return res.json();
    },
    delete: async (url: string) => {
      const res = await fetch(url, { method: "DELETE", headers });
      if (!res.ok) throw new Error((await res.json()).error || "Request failed");
      return res.json();
    },
  };
}