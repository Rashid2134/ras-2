import { apiRequest } from "./queryClient";

export interface DecryptionResult {
  success: boolean;
  decoded?: string;
  detectedType?: string;
  originalLength?: number;
  decodedLength?: number;
  sessionId?: string;
  fileName?: string;
  error?: string;
}

export interface DecryptionSession {
  id: string;
  originalText: string;
  decodedText: string;
  encryptionType: string;
  originalLength: number;
  decodedLength: number;
  createdAt: string;
}

export async function decryptText(
  text: string,
  encryptionType: string = "auto",
  caesarShift?: number
): Promise<DecryptionResult> {
  const response = await apiRequest("POST", "/api/decrypt", {
    text,
    encryptionType,
    caesarShift,
  });
  return await response.json();
}

export async function decryptFile(
  file: File,
  encryptionType: string = "auto",
  caesarShift?: number
): Promise<DecryptionResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("encryptionType", encryptionType);
  if (caesarShift) {
    formData.append("caesarShift", caesarShift.toString());
  }

  const response = await fetch("/api/decrypt-file", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "حدث خطأ في رفع الملف");
  }

  return await response.json();
}

export async function getSessionHistory(): Promise<DecryptionSession[]> {
  const response = await apiRequest("GET", "/api/sessions");
  const data = await response.json();
  return data.sessions || [];
}

export function downloadText(text: string, filename: string = "decoded_text.txt") {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffInMinutes = Math.floor((now.getTime() - then.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "منذ لحظات";
  if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  return `منذ ${diffInDays} يوم`;
}

export function getEncryptionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    decimal: "تشفير عشري",
    hex: "تشفير سادس عشر",
    base64: "Base64",
    caesar: "تشفير قيصر",
    rot13: "ROT13",
    url: "تشفير URL",
  };
  return labels[type] || type;
}
