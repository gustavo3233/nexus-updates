import { FormEvent, useMemo, useState } from "react";
import { budgetUnitOptions, calculateBudgetTotal, emptyBudgetDraft, emptyBudgetItem, type Budget, type BudgetDraft, type BudgetItem, type EstimatedExpense, validateBudget } from "../domain/budget";
import type { Client, ClientAddress } from "../domain/client";
import type { Order } from "../domain/order";
import type { Settings } from "../domain/settings";
import type { Professional } from "../domain/professional";
import type { Purchase } from "../domain/supplier";
import { expenseCategoryLabels, type ExpenseCategory } from "../domain/financial-sheet";
import { ClientForm } from "./ClientForm";
import { BudgetPdfPreview } from "./BudgetPdfPreview";
import { calculatePricing } from "../services/pricing";

type Props = { clients: Client[]; professionals: Professional[]; purchases: Purchase[]; settings: Settings; initialClientId?: string; initialOrder?: Order; initialBudget?: Budget; onCancel: () => void; onSave: (budget: Budget) => void; onClientCreated: (client: Client) => void; onClientUpdated: (client: Client) => void };
const input = "mt-1 w-full rounded-lg border border-nexus-border px-3 py-2 text-sm";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const addressesFor = (client?: Client): ClientAddress[] => !client ? [] : client.addresses?.length ? client.addresses : client.address ? [{ id: `principal-${client.id}`, label: "Endereço principal", address: client.address }] : [];

export function BudgetForm({ clients, professionals, purchases, settings, initialClientId = "", initialOrder, initialBudget, onCancel, onSave, onClientCreated, onClientUpdated }: Props) {
  const [draft, setDraft] = useState<BudgetDraft>(initialBudget ? { ...initialBudget } : { ...emptyBudgetDraft(), clientId: initialOrder?.clientId || initialClientId, sourceOrderId: initialOrder?.id, title: initialOrder?.subject || "", description: initialOrder?.description || "", workAddress: initialOrder?.workAddress || "" });
  const [error, setError] = useState(""); const [newClient, setNewClient] = useState(false); const [addingAddress, setAddingAddress] = useState(false); const [addressLabel, setAddressLabel] = useState("Casa"); const [addressText, setAddressText] = useState(""); const [confirmWithoutEstimate, setConfirmWithoutEstimate] = useState(false); const [preview, setPreview] = useState(false);
  const selectedClient = useMemo(() => clients.find((client) => client.id === draft.clientId), [clients, draft.clientId]);
  const activeProfessionals = useMemo(() => professionals.filter((professional) => professional.active !== false).sort((first, second) => first.name.localeCompare(second.name)), [professionals]);
  const materialSuggestions = useMemo(() => Array.from(new Set(purchases.flatMap((purchase) => purchase.items.map((item) => item.description.trim())).filter(Boolean))).sort((first, second) => first.localeCompare(second)), [purchases]);
  const savedAddresses = addressesFor(selectedClient);
  const set = <K extends keyof BudgetDraft>(key: K, value: BudgetDraft[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const setItem = (index: number, key: keyof BudgetItem, value: string | number) => set("items", draft.items.map((item, i) => i === index ? { ...item, [key]: value } : item));
  const setEstimate = (index: number, change: Partial<EstimatedExpense>) => set("estimatedExpenses", draft.estimatedExpenses.map((item, i) => {
    if (i !== index) return item;
    const next = { ...item, ...change };
    if (next.category !== "outros" && (change.quantity !== undefined || change.unitPrice !== undefined)) next.amount = (Number(next.quantity) || 0) * (Number(next.unitPrice) || 0);
    return next;
  }));
  const total = calculateBudgetTotal(draft.items); const estimated = draft.estimatedExpenses.reduce((sum, item) => sum + item.amount, 0);
  const pricingSnapshot = draft.pricingSnapshot ?? { icmsRate: settings.icmsRate, stateRate: settings.stateRate, federalRate: settings.federalRate, companyProfitRate: settings.companyProfitRate, applyTaxes: true, applyProfit: true, capturedAt: new Date().toISOString() };
  const pricing = calculatePricing(total, settings, pricingSnapshot);
  const setPricingFlag = (key: "applyTaxes" | "applyProfit", value: boolean) => set("pricingSnapshot", { ...pricingSnapshot, [key]: value });
  const margin = estimated > 0 ? (total - estimated) / estimated : null;
  const priceWarning = margin === null ? null : margin < 0 ? { tone: "border-red-200 bg-red-50 text-red-800", text: `Atenção: você está cobrando ${money.format(estimated - total)} menos que os gastos estimados.` } : margin < 0.5 ? { tone: "border-amber-200 bg-amber-50 text-amber-900", text: `Margem estimada de ${Math.round(margin * 100)}%. Para atingir a meta, o valor cobrado precisa ser pelo menos 50% maior que o custo estimado.` } : { tone: "border-emerald-200 bg-emerald-50 text-emerald-800", text: `Boa margem: o orçamento está ${Math.round(margin * 100)}% acima dos gastos estimados.` };
  const chooseClient = (clientId: string) => { const client = clients.find((item) => item.id === clientId); setDraft((old) => ({ ...old, clientId, workAddress: clientId === old.clientId ? old.workAddress : addressesFor(client)[0]?.address ?? "" })); };
  const chooseProfessional = (index: number, professionalId: string) => {
    const professional = activeProfessionals.find((item) => item.id === professionalId);
    setEstimate(index, professional ? { professionalId, description: professional.name, quantity: draft.estimatedExpenses[index].quantity || 1, unit: "dia", unitPrice: professional.dailyRate } : { professionalId: undefined });
  };
  const saveAddress = () => { if (!selectedClient || !addressLabel.trim() || !addressText.trim()) return; const address: ClientAddress = { id: crypto.randomUUID(), label: addressLabel.trim(), address: addressText.trim() }; onClientUpdated({ ...selectedClient, address: selectedClient.address || address.address, addresses: [...addressesFor(selectedClient), address] }); set("workAddress", address.address); setAddressText(""); setAddingAddress(false); };
  const saveBudget = () => { const complete = { ...draft, totalValue: total }; onSave({ ...complete, id: initialBudget?.id ?? crypto.randomUUID(), createdAt: initialBudget?.createdAt ?? new Date().toISOString() }); };
  const previewBudget: Budget = { ...draft, totalValue: total, id: initialBudget?.id ?? "previa", createdAt: initialBudget?.createdAt ?? new Date().toISOString() };
  const submit = (event: FormEvent) => { event.preventDefault(); const complete = { ...draft, totalValue: total }; const message = validateBudget(complete); if (message) return setError(message); if (!draft.estimatedExpenses.some((expense) => expense.amount > 0)) return setConfirmWithoutEstimate(true); saveBudget(); };
  return <>
<div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-8">
<form className="max-h-full w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-xl" onSubmit={submit}>
    <div className="flex justify-between border-b pb-4">
<div>
<h2 className="text-xl font-bold">Novo orçamento</h2>
<p className="text-sm text-nexus-muted">{initialOrder ? `Criado a partir do pedido: ${initialOrder.subject}` : "Vincule o orçamento ao cliente."}</p>
</div>
<button type="button" onClick={onCancel}>Cancelar</button>
</div>
    <div className="mt-5 grid grid-cols-2 gap-4">
      <label className="col-span-2 text-sm">Cliente *<div className="mt-1 flex gap-2">
<select className="w-full rounded-lg border px-3 py-2" value={draft.clientId} onChange={(event) => chooseClient(event.target.value)}>
<option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
<button type="button" className="rounded-lg border border-nexus-primary px-3" onClick={() => setNewClient(true)}>Cadastrar cliente</button>
</div>
</label>
      <label className="text-sm">Título *<input className={input} value={draft.title} onChange={(event) => set("title", event.target.value)} />
</label>
      <div className="text-sm">
<span>Endereço da obra *</span>
<div className="mt-1 flex gap-2">
<select className="min-w-0 flex-1 rounded-lg border border-nexus-border px-3 py-2 text-sm" value={savedAddresses.some((item) => item.address === draft.workAddress) ? draft.workAddress : ""} onChange={(event) => set("workAddress", event.target.value)} disabled={!selectedClient}>
<option value="">{selectedClient ? "Selecione um endereço" : "Selecione o cliente primeiro"}</option>{savedAddresses.map((item) => <option key={item.id} value={item.address}>{item.label} — {item.address}</option>)}</select>
<button className="shrink-0 rounded-lg border border-nexus-primary px-3 text-xs font-semibold text-nexus-primary disabled:opacity-50" type="button" disabled={!selectedClient} onClick={() => setAddingAddress((value) => !value)}>+ Novo</button>
</div>
</div>
      {addingAddress ? <div className="col-span-2 rounded-xl border border-orange-200 bg-orange-50 p-3">
<div className="flex items-center justify-between">
<p className="text-sm font-semibold">Novo endereço para {selectedClient?.name}</p>
<button className="text-sm text-nexus-muted" type="button" onClick={() => setAddingAddress(false)}>Cancelar</button>
</div>
<div className="mt-2 grid grid-cols-[160px_1fr_auto] gap-2">
<select className="rounded-lg border border-nexus-border px-3 py-2 text-sm" value={addressLabel} onChange={(event) => setAddressLabel(event.target.value)}>
<option>Casa</option>
<option>Trabalho</option>
<option>Obra</option>
<option>Outro</option>
</select>
<input className="rounded-lg border border-nexus-border px-3 py-2 text-sm" placeholder="Rua, número, bairro e cidade" value={addressText} onChange={(event) => setAddressText(event.target.value)} />
<button className="rounded-lg bg-nexus-primary px-3 text-sm font-semibold text-white" type="button" onClick={saveAddress}>Salvar endereço</button>
</div>
</div> : null}
      <label className="col-span-2 text-sm">Endereço selecionado / da obra<input className={input} value={draft.workAddress} onChange={(event) => set("workAddress", event.target.value)} placeholder="Selecione um endereço salvo ou informe o local da obra" />
</label>
    </div>
    <section className="mt-6">
<div className="mb-2 flex justify-between">
<h3 className="font-semibold">Itens do orçamento</h3>
<button type="button" onClick={() => set("items", [...draft.items, emptyBudgetItem()])}>+ Adicionar item</button>
</div>
<div className="mb-1 grid grid-cols-[minmax(0,1fr)_90px_170px_140px_82px_28px] gap-2 px-1 text-xs font-semibold text-nexus-muted">
<span>Descrição</span>
<span>Quantidade</span>
<span>Unidade de medida</span>
<span>Valor unitário</span>
<span>Cortesia</span>
<span />
</div>{draft.items.map((item, index) => <div className="mb-2 grid grid-cols-[minmax(0,1fr)_90px_170px_140px_82px_28px] items-center gap-2" key={item.id}>
<input className="rounded border px-2 py-2 text-sm" placeholder="Descrição do item" value={item.description} onChange={(event) => setItem(index, "description", event.target.value)} />
<input className="rounded border px-2 py-2 text-sm" type="number" min="0.01" step="0.01" placeholder="Qtd." aria-label="Quantidade" value={item.quantity || ""} onChange={(event) => setItem(index, "quantity", Number(event.target.value))} />
<select className="rounded border px-2 py-2 text-sm" aria-label="Unidade de medida" value={item.unit} onChange={(event) => setItem(index, "unit", event.target.value)}>{budgetUnitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select>
<div className="relative">
<span className="pointer-events-none absolute left-2 top-2 text-sm text-nexus-muted">R$</span>
<input className="w-full rounded border py-2 pl-8 pr-2 text-sm disabled:bg-slate-100" type="number" min="0" step="0.01" placeholder={item.isCourtesy ? "Cortesia" : "Valor"} aria-label="Valor unitário" disabled={Boolean(item.isCourtesy)} value={item.unitPrice || ""} onChange={(event) => setItem(index, "unitPrice", Number(event.target.value))} />
</div>
<label className="flex items-center gap-1 text-xs font-medium text-nexus-primary"><input type="checkbox" checked={Boolean(item.isCourtesy)} onChange={(event) => set("items", draft.items.map((current, itemIndex) => itemIndex === index ? { ...current, isCourtesy: event.target.checked, unitPrice: event.target.checked ? 0 : current.unitPrice } : current))} />Cortesia</label>
<button type="button" className="text-nexus-error" title="Remover item" onClick={() => set("items", draft.items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
</div>)}<p className="text-right font-bold">Base dos itens: {money.format(total)}</p>
</section>
    <section className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="mr-2 text-sm font-semibold">Impostos e lucro deste orçamento</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pricingSnapshot.applyTaxes !== false} onChange={(event) => setPricingFlag("applyTaxes", event.target.checked)} />Aplicar impostos ({pricing.taxRate.toLocaleString("pt-BR")}%)</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pricingSnapshot.applyProfit !== false} onChange={(event) => setPricingFlag("applyProfit", event.target.checked)} />Aplicar lucro ({pricingSnapshot.applyProfit === false ? "0" : settings.companyProfitRate.toLocaleString("pt-BR")}%)</label>
      <p className="ml-auto text-sm font-semibold">Total a cobrar: {money.format(pricing.chargedValue)}</p>
    </section>
    {priceWarning && <section className={`mt-4 rounded-xl border p-4 ${priceWarning.tone}`}><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold">Análise de preço x custo estimado</p><p className="mt-1 text-sm">{priceWarning.text}</p></div><div className="shrink-0 text-right text-sm"><p>Custo estimado: <b>{money.format(estimated)}</b></p><p>Valor cobrado: <b>{money.format(total)}</b></p></div></div></section>}
    <section className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
<div className="flex justify-between">
<div>
<h3 className="font-semibold">Gastos estimados da obra</h3>
<p className="text-sm text-nexus-muted">Compare estes custos com os gastos reais no Financeiro.</p>
</div>
<button type="button" onClick={() => set("estimatedExpenses", [...draft.estimatedExpenses, { id: crypto.randomUUID(), category: "materiais", description: "", quantity: 1, unit: "un", unitPrice: 0, amount: 0 }])}>+ Adicionar estimativa</button>
</div>{draft.estimatedExpenses.map((item, index) => {
  const calculated = item.category !== "outros";
  return <div className="mt-3 rounded-lg border border-orange-100 bg-white p-3" key={item.id}>
    <div className="flex items-center justify-between gap-3">
      <label className="text-xs font-semibold text-nexus-muted">Tipo do gasto<select className="ml-2 rounded border px-2 py-1.5 text-sm font-normal text-nexus-ink" value={item.category} onChange={(event) => setEstimate(index, { category: event.target.value as ExpenseCategory, professionalId: undefined })}>{(Object.entries(expenseCategoryLabels) as [ExpenseCategory, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button type="button" className="text-sm font-semibold text-nexus-error" aria-label="Remover estimativa" onClick={() => set("estimatedExpenses", draft.estimatedExpenses.filter((_, itemIndex) => itemIndex !== index))}>×</button>
    </div>
    {item.category === "funcionario" ? <div className="mt-3 grid grid-cols-4 gap-2">
      <label className="text-xs text-nexus-muted">Profissional cadastrado<select className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" value={item.professionalId || ""} onChange={(event) => chooseProfessional(index, event.target.value)}><option value="">Digitar manualmente</option>{activeProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></label>
      <label className="text-xs text-nexus-muted">Nome do profissional<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" placeholder="Nome" value={item.description} onChange={(event) => setEstimate(index, { description: event.target.value, professionalId: undefined })} /></label>
      <label className="text-xs text-nexus-muted">Quantidade de diárias<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" type="number" min="0" step="1" placeholder="Dias" value={item.quantity ?? ""} onChange={(event) => setEstimate(index, { quantity: Number(event.target.value), unit: "dia" })} /></label>
      <label className="text-xs text-nexus-muted">Valor da diária<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" type="number" min="0" step="0.01" placeholder="R$" value={item.unitPrice ?? ""} onChange={(event) => setEstimate(index, { unitPrice: Number(event.target.value), unit: "dia" })} /></label>
    </div> : calculated ? <div className="mt-3 grid grid-cols-[minmax(0,1fr)_100px_130px_140px] gap-2">
      <label className="text-xs text-nexus-muted">{item.category === "materiais" ? "Material" : item.category === "ferramenta" ? "Ferramenta" : "Item de logística"}<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" list={item.category === "materiais" ? "materiais-cadastrados" : undefined} placeholder={item.category === "materiais" ? "Ex.: cimento, tinta, telha" : "Descreva o item"} value={item.description} onChange={(event) => setEstimate(index, { description: event.target.value })} /></label>
      <label className="text-xs text-nexus-muted">Quantidade<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" type="number" min="0" step="0.01" value={item.quantity ?? ""} onChange={(event) => setEstimate(index, { quantity: Number(event.target.value) })} /></label>
      <label className="text-xs text-nexus-muted">Unidade<select className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" value={item.unit || "un"} onChange={(event) => setEstimate(index, { unit: event.target.value })}>{budgetUnitOptions.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label>
      <label className="text-xs text-nexus-muted">Valor unitário<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" type="number" min="0" step="0.01" placeholder="R$" value={item.unitPrice ?? ""} onChange={(event) => setEstimate(index, { unitPrice: Number(event.target.value) })} /></label>
    </div> : <div className="mt-3 grid grid-cols-[minmax(0,1fr)_140px] gap-2">
      <label className="text-xs text-nexus-muted">Descrição<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" placeholder="Descreva o gasto" value={item.description} onChange={(event) => setEstimate(index, { description: event.target.value })} /></label>
      <label className="text-xs text-nexus-muted">Valor estimado<input className="mt-1 w-full rounded border px-2 py-2 text-sm text-nexus-ink" type="number" min="0" step="0.01" placeholder="R$" value={item.amount || ""} onChange={(event) => setEstimate(index, { amount: Number(event.target.value) })} /></label>
    </div>}
    <p className="mt-2 text-right text-sm font-semibold">Subtotal estimado: {money.format(item.amount)}</p>
  </div>;
})}<datalist id="materiais-cadastrados">{materialSuggestions.map((description) => <option key={description} value={description} />)}</datalist><p className="mt-3 text-right font-semibold">Total estimado: {money.format(estimated)}</p>
</section>
    <div className="mt-5 grid grid-cols-2 gap-4">
<label className="text-sm">Pagamento<input className={input} value={draft.paymentMethod} onChange={(event) => set("paymentMethod", event.target.value)} />
</label>
<label className="text-sm">Prazo<input className={input} value={draft.executionPeriod} onChange={(event) => set("executionPeriod", event.target.value)} />
</label>
<label className="text-sm">Validade<input className={input} type="date" value={draft.validUntil} onChange={(event) => set("validUntil", event.target.value)} />
</label>
<label className="text-sm">Emissão<input className={input} type="date" value={draft.issueDate} onChange={(event) => set("issueDate", event.target.value)} />
</label>
<label className="text-sm">Status do orçamento<select className={input} value={draft.status} onChange={(event) => set("status", event.target.value as BudgetDraft["status"])}><option value="Rascunho">Rascunho</option><option value="Aberto">Aberto</option><option value="Aprovado">Aprovado</option><option value="Não aprovado">Recusado</option><option value="Faturado">Faturado</option></select></label>
</div>
    {error ? <p className="mt-3 text-sm text-nexus-error">{error}</p> : null}<div className="mt-6 flex justify-end gap-3">
<button type="button" onClick={onCancel}>Cancelar</button>
<button className="rounded-lg border border-nexus-primary px-4 py-2 text-nexus-primary" type="button" disabled={!selectedClient} onClick={() => setPreview(true)}>Ver prévia do PDF</button>
<button className="rounded-lg bg-nexus-primary px-4 py-2 text-white">Salvar orçamento</button>
</div>
  </form>
</div>{newClient ? <ClientForm onCancel={() => setNewClient(false)} onSave={(client) => { onClientCreated(client); set("clientId", client.id); set("workAddress", addressesFor(client)[0]?.address || ""); setNewClient(false); }} /> : null}{confirmWithoutEstimate ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-6"><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold text-nexus-ink">Salvar sem gastos estimados?</h2><p className="mt-3 text-sm text-nexus-muted">Você ainda não lançou estimativas de materiais, funcionários ou outros custos. Estimar os gastos ajuda a conferir a margem antes de enviar o orçamento.</p><div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border px-4 py-2 text-sm font-semibold" type="button" onClick={() => setConfirmWithoutEstimate(false)}>Voltar e estimar</button><button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" type="button" onClick={saveBudget}>Salvar mesmo assim</button></div></section></div> : null}{preview && selectedClient ? <BudgetPdfPreview budget={previewBudget} client={selectedClient} settings={settings} onClose={() => setPreview(false)} /> : null}</>;
}
