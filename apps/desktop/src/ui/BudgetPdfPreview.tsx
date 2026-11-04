import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import type { Settings } from "../domain/settings";
import { generateBudgetPdf } from "../services/budget-pdf";

type Props = { budget: Budget; client: Client; settings: Settings; onClose: () => void };

export function BudgetPdfPreview({ budget, client, settings, onClose }: Props) {
  const source = generateBudgetPdf(budget, client, settings, false);
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-6">
    <section className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b px-5 py-4"><div><h2 className="font-bold text-nexus-ink">Prévia do orçamento</h2><p className="text-sm text-nexus-muted">Visualização interna — o PDF não foi baixado.</p></div><button className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>Fechar</button></header>
      <iframe className="min-h-0 flex-1 bg-slate-100" title="Prévia do PDF do orçamento" src={source} />
    </section>
  </div>;
}
