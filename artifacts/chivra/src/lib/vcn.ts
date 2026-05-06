const VCN_KEY = "chivra_vcn";
const DISPLAY_NAME_KEY = "chivra_display_name";
const STATUS_TEXT_KEY = "chivra_status_text";

export function getStoredVcn(): string | null {
  return localStorage.getItem(VCN_KEY);
}

export function setStoredVcn(vcn: string) {
  localStorage.setItem(VCN_KEY, vcn);
}

export function getDisplayName(): string {
  return localStorage.getItem(DISPLAY_NAME_KEY) || "You";
}

export function setDisplayName(name: string) {
  localStorage.setItem(DISPLAY_NAME_KEY, name);
}

export function getStatusText(): string {
  return localStorage.getItem(STATUS_TEXT_KEY) || "Available";
}

export function setStatusText(text: string) {
  localStorage.setItem(STATUS_TEXT_KEY, text);
}

export async function initUser(): Promise<string> {
  const existing = getStoredVcn();
  const displayName = getDisplayName();
  const statusText = getStatusText();

  const res = await fetch("/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vcn: existing, displayName, statusText }),
  });

  if (!res.ok) throw new Error("Failed to register user");
  const user = await res.json();
  setStoredVcn(user.vcn);
  return user.vcn;
}

export function formatVcn(vcn: string): string {
  return vcn.slice(0, 3) + "-" + vcn.slice(3);
}
