import { useEffect, useState } from "react";

type UpdateStatus = {
  status: "development" | "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string[];
  progress: number;
  message: string;
  enabled: boolean;
};

function updateMessage(update: UpdateStatus) {
  if (update.status === "available") return `Nova versão disponível: v${update.availableVersion}.`;
  if (update.status === "downloading") return `Baixando atualização: ${update.progress}%.`;
  if (update.status === "downloaded") return "Atualização pronta para instalar.";
  if (update.status === "checking" || update.status === "idle") return "Verificando atualizações…";
  if (update.status === "development") return "Versão de desenvolvimento em uso.";
  if (update.status === "error") return "Não foi possível verificar atualizações.";
  return "Você já está usando a versão atual do sistema.";
}

export function UpdateStatusIndicator() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const load = async () => {
    const state = await window.nexusUpdates?.status();
    if (state) setUpdate(state);
  };

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  const download = async () => {
    try {
      setWorking(true);
      const state = await window.nexusUpdates?.download();
      if (state) setUpdate(state);
    } finally {
      setWorking(false);
    }
  };

  if (!update) return null;
  const attention = update.status === "available" || update.status === "downloaded" || update.status === "downloading";
  const error = update.status === "error";

  return <div className={"mt-2 rounded-md border px-2 py-1.5 text-left " + (attention ? "border-orange-200 bg-orange-50" : error ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")} aria-live="polite">
    <p className={"text-xs font-medium " + (attention ? "text-nexus-dark" : error ? "text-red-700" : "text-emerald-800")}>{updateMessage(update)}</p>
    {update.status === "downloading" && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full bg-nexus-primary transition-all" style={{ width: `${update.progress}%` }} /></div>}
    {update.status === "available" && <button type="button" disabled={working} onClick={() => setReviewing(true)} className="mt-2 rounded-md bg-nexus-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Atualizar sistema</button>}
    {update.status === "downloaded" && <button type="button" onClick={() => void window.nexusUpdates?.install()} className="mt-2 rounded-md bg-nexus-primary px-3 py-1.5 text-xs font-semibold text-white">Reiniciar e instalar</button>}
    {reviewing && <UpdateReviewDialog update={update} busy={working} onCancel={() => setReviewing(false)} onConfirm={() => { setReviewing(false); void download(); }} />}
  </div>;
}

function UpdateReviewDialog({ update, busy, onCancel, onConfirm }: { update: UpdateStatus; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const notes = update.releaseNotes.length ? update.releaseNotes : ["Esta versão não possui notas de atualização publicadas."];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-5"><section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><p className="text-sm font-medium text-nexus-muted">Atualização disponível</p><h2 className="mt-1 text-xl font-bold text-nexus-ink">Atualizar o Nexus?</h2><p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-nexus-ink">Você está atualizando de <b>v{update.currentVersion}</b> para <b>v{update.availableVersion}</b>.</p><div className="mt-5"><h3 className="text-sm font-semibold text-nexus-ink">O que mudou nesta versão</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-nexus-muted">{notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></div><p className="mt-5 text-xs text-nexus-muted">Seus clientes, orçamentos, obras e demais dados locais serão preservados durante a atualização.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60">Cancelar</button><button type="button" onClick={onConfirm} disabled={busy} className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Baixar e atualizar</button></div></section></div>;
}
