import type { AccountUser, ConversationDto, MessageDto, PublicUser } from "@secure-chat/shared";

const base = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? "Request failed");
  return body;
}

function uploadMedia(
  conversationId: string,
  file: File,
  caption?: string,
  onProgress?: (percent: number) => void
): Promise<{ message: MessageDto }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/api/conversations/${conversationId}/media`);
    xhr.withCredentials = true;

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const percent = Math.round((evt.loaded / evt.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      let data: any;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.error ?? `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during file upload. Please check your connection."));
    };

    const formData = new FormData();
    formData.append("file", file);
    if (caption) {
      formData.append("caption", caption);
    }
    xhr.send(formData);
  });
}

function getMediaUrl(mediaId: string, conversationId?: string): string {
  if (conversationId) {
    return `${base}/api/conversations/${conversationId}/media/${mediaId}`;
  }
  return `${base}/api/media/${mediaId}`;
}

export const api = {
  base,
  register: (data: object) => request<{ user: AccountUser }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: object) => request<{ user: AccountUser }>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: AccountUser }>("/me"),
  search: (q: string) => request<{ users: PublicUser[] }>(`/users?q=${encodeURIComponent(q)}`),
  conversations: () => request<{ conversations: ConversationDto[] }>("/conversations"),
  createConversation: (userId: string) => request<{ conversation: ConversationDto }>("/conversations", { method: "POST", body: JSON.stringify({ userId }) }),
  messages: (id: string) => request<{ messages: MessageDto[] }>(`/conversations/${id}/messages`),
  uploadMedia,
  getMediaUrl
};
