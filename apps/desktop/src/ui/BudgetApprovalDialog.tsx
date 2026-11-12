import { useState } from "react";

export type ApprovalPaymentPlan = { entryAmount: number; entryReceivedOn?: string; remainingDueOn?: string };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);

export function BudgetApprovalDialog({ title, amount, onCancel, onConfirm }: { title: string; amount: number; onCancel: () => void; onConfirm: (plan: ApprovalPaymentPlan) => void }) {
  const [hadEntry, setHadEntry] = useState<boolean | null>(null);
  const [entryAmount, setEntryAmount] = useState("");
  const [entryReceivedOn, setEntryReceivedOn] = useState(today());
  const [remainingDueOn, setRemainingDueOn] = useState(today());
  const [error, setError] = useState("");
  const parsedEntry = hadEntry ? Number(entryAmount) || 0 : 0;
  const remaining = Math.max(0, amount - parsedEntry);
  const entryPercent = amount ? parsedEntry / amount * 100 : 0;
  const remainingPercent = Math.max(0, 100 - entryPercent);
  const confirm = () => {
    if (hadEntry === null) { setError("Informe se houve valor de entrada."); return; }
    if (hadEntry && (parsedEntry <= 0 || parsedEntry > amount)) { setError("Informe uma entrada maior que zero e menor ou igual ao valor do orçamento."); return; }
    if (hadEntry && !entryReceivedOn) { setError("Informe a data do recebimento da entrada."); return; }
    if (remaining > 0 && !remainingDueOn) { setError("Informe a data prevista para receber o saldo."); return; }
    onConfirm({ entryAmount: parsedEntry, entryReceivedOn: hadEntry ? entryReceivedOn : undefined, remainingDueOn: remaining > 0 ? remainingDueOn : undefined });
  };
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4"><section className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><p className="text-sm text-nexus-muted">Aprovação do orçamento</p><h2 className="mt-1 text-xl font-bold text-nexus-ink">Registrar recebimentos</h2><p className="mt-2 text-sm text-nexus-muted">Ao confirmar, os valores serão enviados para Contas a receber no Fluxo de caixa.</p><div className="mt-5 rounded-xl border bg-slate-50 p-4"><p className="text-sm text-nexus-muted">Orçamento</p><b className="mt-1 block text-nexus-ink">{title}</b><p className="mt-3 text-sm text-nexus-muted">Valor total a cobrar</p><strong className="text-2xl text-nexus-ink">{money.format(amount)}</strong></div><p className="mt-5 text-sm font-semibold">Teve algum valor de entrada?</p><div className="mt-2 grid grid-cols-2 gap-3"><button type="button" onClick={() => { setHadEntry(true); setError(""); }} className={(hadEntry === true ? "border-nexus-primary bg-orange-50 text-nexus-dark" : "border-slate-200 bg-white text-nexus-muted") + " rounded-xl border p-4 text-left font-semibold"}>Sim<p className="mt-1 text-xs font-normal">Registrar a entrada recebida agora.</p></button><button type="button" onClick={() => { setHadEntry(false); setEntryAmount(""); setError(""); }} className={(hadEntry === false ? "border-nexus-primary bg-orange-50 text-nexus-dark" : "border-slate-200 bg-white text-nexus-muted") + " rounded-xl border p-4 text-left font-semibold"}>Não<p className="mt-1 text-xs font-normal">Registrar somente o saldo a receber.</p></button></div>{hadEntry && <div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm">Valor da entrada<input autoFocus className="mt-1 w-full rounded-lg border px-3 py-2" type="number" min="0.01" max={amount} step="0.01" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} placeholder="R$ 0,00" /></label><label className="text-sm">Data do recebimento<input className="mt-1 w-full rounded-lg border px-3 py-2" type="date" value={entryReceivedOn} onChange={(event) => setEntryReceivedOn(event.target.value)} /></label></div>}{hadEntry !== null && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm"><p>{hadEntry ? <>Entrada de <b>{money.format(parsedEntry)}</b> — <b>{entryPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b> do orçamento.</> : <>Nenhuma entrada registrada.</>}</p><p className="mt-2">Saldo a receber: <b>{money.format(remaining)}</b> — <b>{remainingPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b>.</p>{remaining > 0 && <label className="mt-4 block font-medium">Previsão de recebimento do saldo<input className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal" type="date" value={remainingDueOn} onChange={(event) => setRemainingDueOn(event.target.value)} /></label>}</div>}{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={onCancel}>Cancelar</button><button type="button" className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={confirm}>Aprovar e criar recebimentos</button></div></section></div>;
}
