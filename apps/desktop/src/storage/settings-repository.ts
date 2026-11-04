import { defaultSettings, type Settings } from "../domain/settings";
const key = "@nexus/desktop/settings";
export function loadSettings(): Settings { try { const old = JSON.parse(window.localStorage.getItem(key) ?? "{}"); return { ...defaultSettings, ...old, appLogoDataUrl: old.appLogoDataUrl ?? old.logoDataUrl ?? "", pdfLogoDataUrl: old.pdfLogoDataUrl ?? old.logoDataUrl ?? "" }; } catch { return defaultSettings; } }
export function saveSettings(settings: Settings) { const next = { ...settings, logoDataUrl: settings.appLogoDataUrl }; window.localStorage.setItem(key, JSON.stringify(next)); return next; }
