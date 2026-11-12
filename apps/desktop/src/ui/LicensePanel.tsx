import { useState } from "react";
import packageMetadata from "../../package.json";
import { UpdateStatusIndicator } from "./UpdatePanel";

export type LicenseStatus = { state: string; active: boolean; message: string; expiresAt?: string; remainingDays?: number; planCode?: string | null };

const plans = [
  ["Mensal", "35 dias de acesso"],
  ["Trimestral", "95 dias de acesso"],
  ["Semestral", "185 dias de acesso"],
  ["Anual", "370 dias de acesso"]
];

export function LicensePanel({ license, onActivate }: { license: LicenseStatus; onActivate: (key: string) => Promise<LicenseStatus> }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const activate = async () => {
    try {
      setBusy(true);
      setNotice("");
      const result = await onActivate(key);
      setKey("");
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível ativar a chave.");
    } finally { setBusy(false); }
  };
  const validUntil = license.expiresAt ? new Date(license.expiresAt).toLocaleDateString("pt-BR") : null;
  return <div>
    <div className={(license.active ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50") + " rounded-xl border p-5"}>
      <p className="text-xs font-bold uppercase tracking-wide text-nexus-muted">Status da assinatura</p>
      <h2 className="mt-1 text-xl font-bold text-nexus-ink">{license.active ? license.state === "trial_active" ? "Teste gratuito ativo" : "Licença ativa" : "Acesso bloqueado"}</h2>
      <p className="mt-2 text-sm text-nexus-muted">{license.message}</p>
      {validUntil && <p className="mt-3 text-sm font-semibold text-nexus-ink">Validade: {validUntil}</p>}
    </div>
    <section className="mt-6 rounded-xl border p-5"><h3 className="font-semibold">Ativar ou renovar chave</h3><p className="mt-1 text-sm text-nexus-muted">Cole a chave recebida após a confirmação do pagamento. A chave é validada pelo serviço de licenças e não fica gravada em texto aberto no computador.</p><div className="mt-4 flex max-w-2xl gap-3"><input className="min-w-0 flex-1 rounded-lg border border-nexus-border px-3 py-2 text-sm" value={key} onChange={(event) => setKey(event.target.value)} placeholder="NXS-XXXX-XXXX-XXXX" autoComplete="off"/><button type="button" disabled={busy || !key.trim()} onClick={() => void activate()} className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Validando..." : "Ativar chave"}</button></div>{notice && <p className={(notice === "Licença ativa." ? "text-emerald-700" : "text-nexus-muted") + " mt-3 text-sm"} role="status">{notice}</p>}</section>
    <section className="mt-6"><h3 className="font-semibold">Planos disponíveis</h3><p className="mt-1 text-sm text-nexus-muted">A cobrança online será liberada quando o provedor de pagamentos estiver configurado. Todos os planos incluem cinco dias adicionais após o período contratado.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{plans.map(([name, duration]) => <div key={name} className="rounded-xl border bg-slate-50 p-4"><b className="text-sm text-nexus-ink">{name}</b><p className="mt-1 text-xs text-nexus-muted">{duration}</p></div>)}</div></section>
    <div className="mt-8 flex justify-end"><div className="w-60 rounded-lg border border-nexus-border bg-slate-50 px-3 py-2 text-right"><p className="text-xs font-medium uppercase text-nexus-muted">Versão do sistema</p><b className="text-sm text-nexus-ink">v{packageMetadata.version}</b><UpdateStatusIndicator /></div></div>
  </div>;
}
