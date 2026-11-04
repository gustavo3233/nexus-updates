import type { ReactNode } from "react";
type IconName = "dashboard" | "clients" | "budgets" | "works" | "professionals" | "suppliers" | "documents" | "finance" | "cashflow" | "financing" | "settings";

export function SystemIcon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    clients: <><circle cx="12" cy="8" r="3.2"/><path d="M5 21c.7-4 3-6 7-6s6.3 2 7 6"/></>,
    budgets: <><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h5M9 12h6M9 16h6"/></>,
    works: <><path d="M3 20h18M5 20V9l7-5 7 5v11M9 20v-6h6v6"/></>,
    professionals: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3 21c.6-4 2.6-6 6-6s5.4 2 6 6M15 16c3 .1 4.8 1.8 5.5 5"/></>,
    suppliers: <><path d="M3 7h11v10H3zM14 11h4l3 3v3h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></>,
    documents: <><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v5h5M8 12h8M8 16h8"/></>,
    finance: <><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.7-1.5-3-1.5-1.7 0-3 1-3 2.5 0 3.5 6 1.5 6 5 0 1.4-1.3 2.5-3 2.5-1.4 0-2.6-.5-3.2-1.6M12 6v12"/></>,
    cashflow: <><path d="M4 18l5-5 4 3 7-8"/><path d="M16 8h4v4M4 4v16h16"/></>,
    financing: <><path d="M5 3h12l3 3v15H5z"/><path d="M17 3v4h4M8 11h8M8 15h5M8 19h7"/><circle cx="17" cy="18" r="3"/><path d="M17 16.5v3M16.2 17.2h1.3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.2 2.2-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3.2v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L6.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-3.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.2-2.2.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h3.2v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.2 2.2-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2V14h-.2a1.7 1.7 0 0 0-1.4 1z"/></>
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} {...common}>{paths[name]}</svg>;
}
