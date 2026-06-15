export type FontSizeOption = "small" | "default" | "large" | "xlarge";

const LS_KEY = "chivra_font_size";

const FONT_PX: Record<FontSizeOption, string> = {
  small:   "13px",
  default: "15px",
  large:   "17px",
  xlarge:  "20px",
};

export function getSavedFontSize(): FontSizeOption {
  return (localStorage.getItem(LS_KEY) as FontSizeOption) ?? "default";
}

export function applyFontSize(size?: FontSizeOption): void {
  const s = size ?? getSavedFontSize();
  document.documentElement.setAttribute("data-font-size", s);
  document.documentElement.style.setProperty("--app-chat-font-size", FONT_PX[s]);
}

export function saveFontSize(size: FontSizeOption): void {
  localStorage.setItem(LS_KEY, size);
  applyFontSize(size);
}
