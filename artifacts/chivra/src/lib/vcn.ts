const VCN_KEY = "chivra_vcn";
const DISPLAY_NAME_KEY = "chivra_display_name";
const STATUS_TEXT_KEY = "chivra_status_text";
const PHONE_KEY = "chivra_phone";
const ACCOUNT_CREATED_KEY = "chivra_account_created_at";

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

export function getStoredPhone(): string | null {
  return localStorage.getItem(PHONE_KEY);
}

export function setStoredPhone(phone: string) {
  localStorage.setItem(PHONE_KEY, phone);
}

export function getAccountCreatedAt(): number | null {
  const raw = localStorage.getItem(ACCOUNT_CREATED_KEY);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}

export function markAccountCreated() {
  if (!localStorage.getItem(ACCOUNT_CREATED_KEY)) {
    localStorage.setItem(ACCOUNT_CREATED_KEY, String(Date.now()));
  }
}

export async function initUser(phone?: string): Promise<string> {
  const existing = getStoredVcn();
  const displayName = getDisplayName();
  const statusText = getStatusText();

  const res = await fetch("/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vcn: existing, displayName, statusText, phone }),
  });

  if (!res.ok) throw new Error("Failed to register user");
  const user = await res.json();
  setStoredVcn(user.vcn);
  if (phone) setStoredPhone(phone);
  markAccountCreated();
  return user.vcn;
}

export function formatVcn(vcn: string): string {
  return vcn.slice(0, 3) + "-" + vcn.slice(3);
}
