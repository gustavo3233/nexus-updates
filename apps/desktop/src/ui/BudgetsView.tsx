import { useMemo, useState } from "react";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import type { FiscalSettings, NfseRecord, ServiceCompletion } from "../domain/fiscal";
import { orderStatuses, type Order, type OrderStatus } from "../domain/order";
import type { Settings } from "../domain/settings";
import type { Work } from "../domain/work";
import { calculatePricing } from "../services/pricing";
import { generateOrderPdf } from "../services/order-pdf";
import { BudgetPdfPreview } from "./BudgetPdfPreview";

type FiscalDraft = { budgetId: string; title: string; serviceDescription: string; paymentDescription: string; serviceValue: number; discounts: number };
export type BudgetStatusFilter = "Todos" | "Rascunho" | "Aberto" | "Faturado" | "Aprovado" | "Não aprovado";
type OrderStatusFilter = "Todos" | OrderStatus;
type BudgetTab = "Orçamentos" | "Ordens de serviço";
type Props = { budgets: Budget[]; orders: Order[]; works: Work[]; clients: Client[]; settings: Settings; fiscalSettings: FiscalSettings | null; serviceCompletions: ServiceCompletion[]; nfseDrafts: FiscalDraft[]; nfseRecords: NfseRecord[]; initialStatusFilter?: BudgetStatusFilter; onSaveNfseDraft: (budgetId: string, draft: FiscalDraft) => Promise<void>; onConfirmService: (completion: ServiceCompletion) => Promise<void>; onPrepareNfse: (budgetId: string) => Promise<NfseRecord>; onNewBudget: () => void; onNewOrder: () => void; onEditOrder: (order: Order) => void; onDeleteOrder: (orderId: string) => Promise<void>; onEditBudget: (budget: Budget) => void; onCreateBudgetFromOrder: (order: Order) => void; onCreateWork: (budget: Budget) => void; onOpenFolder: (id: string) => void; onOpenBudgetInFolder: (budget: Budget) => void; onPdf: (budget: Budget, client: Client) => void; onOrderPdf: (order: Order, client: Client) => void };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const field = "mt-1 w-full rounded-lg border border-nexus-border px-3 py-2 text-sm";
const orderStatusTone: Record<OrderStatus, string> = { Rascunho: "bg-slate-100 text-slate-700", Aberto: "bg-amber-100 text-amber-800", Aprovado: "bg-emerald-100 text-emerald-800", "Não aprovado": "bg-red-100 text-red-800", Concluída: "bg-blue-100 text-blue-800", Cancelada: "bg-red-100 text-red-800" };

export function BudgetsView(props: Props) {
  const { budgets, orders, works, clients, settings, fiscalSettings, serviceCompletions, nfseDrafts, nfseRecords } = props;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BudgetStatusFilter>(props.initialStatusFilter ?? "Todos");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>("Todos");
  const [activeTab, setActiveTab] = useState<BudgetTab>("Orçamentos");
  const [confirming, setConfirming] = useState<Budget | null>(null);
  const [issuing, setIssuing] = useState<Budget | null>(null);
  const [notice, setNotice] = useState("");
  const [openedOrder, setOpenedOrder] = useState<Order | null>(null);
  const [previewingBudget, setPreviewingBudget] = useState<Budget | null>(null);
  const byId = new Map(clients.map((client) => [client.id, client]));
  const filteredBudgets = useMemo(() => budgets.filter((budget) => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return (statusFilter === "Todos" || budget.status === statusFilter) && (!term || [budget.title, budget.description, budget.id, byId.get(budget.clientId)?.name].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }), [budgets, query, statusFilter, clients]);
  const filteredOrders = useMemo(() => orders.filter((order) => {
    const term = orderQuery.trim().toLocaleLowerCase("pt-BR");
    const status = order.status ?? "Aberto";
    return (orderStatusFilter === "Todos" || status === orderStatusFilter) && (!term || [order.subject, order.description, order.id, order.type, order.professional, order.workAddress, byId.get(order.clientId)?.name].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }), [orders, orderQuery, orderStatusFilter, clients]);
  const budgetNumber = (budget: Budget) => budget.number || (budget.id.startsWith("dolibarr-budget-") ? String(budget.id.match(/(\d+)$/)?.[1] || "").slice(-2).padStart(2, "0") : String(budgets.filter((item) => !item.id.startsWith("dolibarr-budget-")).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).findIndex((item) => item.id === budget.id) + 1).padStart(2, "0"));
  const prepare = async (budget: Budget) => { try { const record = await props.onPrepareNfse(budget.id); setNotice(`DPS ${record.dpsSeries} nº ${record.dpsNumber} reservada para conferência. Transmissão permanece desabilitada.`); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível preparar a NFS-e."); } };
  return <section>
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-nexus-border bg-white p-2">
      <BudgetTabButton active={activeTab === "Orçamentos"} label="Orçamentos" onClick={() => setActiveTab("Orçamentos")} />
      <BudgetTabButton active={activeTab === "Ordens de serviço"} label="Ordens de serviço" onClick={() => setActiveTab("Ordens de serviço")} />
    </div>
    <div className="mt-3 flex justify-end gap-3">
      <button type="button" className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-nexus-dark" onClick={props.onNewBudget}>+ Novo orçamento</button>
      <button type="button" className="rounded-lg border border-nexus-border bg-white px-4 py-2 text-sm font-semibold text-nexus-ink hover:bg-slate-50" onClick={props.onNewOrder}>+ Novo pedido</button>
    </div>
    {notice && <p className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
    {activeTab === "Ordens de serviço" ? <section className="mt-6 overflow-hidden rounded-xl border bg-white">
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4"><h2 className="font-semibold">Ordens de serviço</h2><div className="flex items-center gap-2"><label className="text-sm font-semibold">Filtrar<select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value as OrderStatusFilter)} className="ml-2 rounded-lg border bg-white px-3 py-2 text-sm font-normal"><option value="Todos">Todos</option>{orderStatuses.map((status) => <option key={status} value={status}>{status === "Não aprovado" ? "Recusadas" : status}</option>)}</select></label><label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">⌕<input value={orderQuery} onChange={(event) => setOrderQuery(event.target.value)} className="w-44 outline-none" placeholder="Buscar ordem de serviço" /></label></div></div>
      {filteredOrders.length === 0 ? <p className="p-5 text-sm text-nexus-muted">Nenhuma ordem de serviço encontrada.</p> : filteredOrders.map((order) => { const client = byId.get(order.clientId); const status = order.status ?? "Aberto"; return <div className="flex items-center justify-between gap-5 border-b px-5 py-4 last:border-b-0" key={order.id}>
        <div className="min-w-0"><b className="block truncate">{order.subject}</b><p className="mt-1 text-sm text-nexus-muted">{client?.name || "Cliente não localizado"}</p><p className="mt-1 text-xs text-nexus-muted">{order.type}{order.scheduledDate ? ` · ${new Date(order.scheduledDate + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}{order.scheduledTime ? ` às ${order.scheduledTime}` : ""}</p></div>
        <div className="shrink-0 text-right"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${orderStatusTone[status]}`}>{status}</span><button className="mt-3 block text-sm font-semibold text-nexus-dark hover:text-nexus-primary" onClick={() => setOpenedOrder(order)}>Abrir</button></div>
      </div>; })}
    </section> : <section className="mt-6 overflow-hidden rounded-xl border bg-white">
<div className="flex items-center justify-between gap-4 border-b px-5 py-4">
<div>
<h2 className="font-semibold">Orçamentos cadastrados</h2>
</div>
<div className="flex items-center gap-2">
<label className="text-sm font-semibold">Filtrar<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="ml-2 rounded-lg border bg-white px-3 py-2 text-sm font-normal">
<option value="Todos">Todos</option>
<option value="Rascunho">Rascunhos</option>
<option value="Aberto">Abertos</option>
<option value="Faturado">Faturados</option>
<option value="Aprovado">Aprovados</option>
<option value="Não aprovado">Recusados</option>
</select>
</label>
<label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} className="w-44 outline-none" placeholder="Buscar cliente ou obra" />
</label>
</div>
</div>
      {filteredBudgets.length === 0 ? <p className="p-5 text-sm text-nexus-muted">Nenhum orçamento encontrado.</p> : filteredBudgets.map((budget) => { const client = byId.get(budget.clientId); const statusClass = budget.status === "Faturado" ? "bg-blue-100 text-blue-800" : budget.status === "Aprovado" ? "bg-emerald-100 text-emerald-800" : budget.status === "Não aprovado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"; return <div className="flex items-center justify-between gap-5 border-b px-5 py-4 last:border-b-0" key={budget.id}>
<div className="min-w-0">
<button type="button" className="block max-w-full truncate text-left font-semibold text-nexus-ink hover:text-nexus-primary" onClick={() => props.onOpenBudgetInFolder(budget)}>{budget.title}</button>
<p className="mt-1 text-sm text-nexus-muted">{client?.name || "Cliente não localizado"}</p>
<p className="mt-1 text-xs text-nexus-muted">Orçamento nº {budgetNumber(budget)}</p>
</div>
<div className="shrink-0 text-right">
<span className={"rounded-full px-2 py-1 text-xs font-semibold " + statusClass}>{budget.status}</span>
<div className="mt-3 flex justify-end gap-3 text-sm"><button className="font-semibold text-nexus-dark hover:text-nexus-primary" onClick={() => setPreviewingBudget(budget)}>Ver prévia do PDF</button>
<button className="font-semibold text-nexus-dark hover:text-nexus-primary" onClick={() => props.onOpenBudgetInFolder(budget)}>Abrir pasta</button>
</div>
</div>
</div>; })}
    </section>}
    {confirming && <ServiceConfirmation budget={confirming} works={works} orders={orders} onClose={() => setConfirming(null)} onSave={async (completion) => { try { await props.onConfirmService(completion); setConfirming(null); setNotice("Prestação de serviço confirmada e registrada em auditoria. A emissão continua pendente de conferência fiscal."); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível confirmar o serviço."); } }} />}
    {issuing && <NfseDraftDialog budget={issuing} client={byId.get(issuing.clientId)!} settings={fiscalSettings} draft={nfseDrafts.find((draft) => draft.budgetId === issuing.id)} onClose={() => setIssuing(null)} onSave={async (draft) => { await props.onSaveNfseDraft(issuing.id, draft); setNotice("Rascunho fiscal salvo. Revise as pendências antes de preparar a DPS localmente."); }} onPrepare={async () => { await prepare(issuing); setIssuing(null); }} />}
    {previewingBudget && byId.get(previewingBudget.clientId) && <BudgetPdfPreview budget={previewingBudget} client={byId.get(previewingBudget.clientId)!} settings={settings} onClose={() => setPreviewingBudget(null)} />}
    {openedOrder && byId.get(openedOrder.clientId) && <OrderDetailsDialog order={openedOrder} client={byId.get(openedOrder.clientId)!} onClose={() => setOpenedOrder(null)} onEdit={() => { props.onEditOrder(openedOrder); setOpenedOrder(null); }} onCreateBudget={() => { props.onCreateBudgetFromOrder(openedOrder); setOpenedOrder(null); }} onDownload={() => props.onOrderPdf(openedOrder, byId.get(openedOrder.clientId)!)} onDelete={async () => { if (!window.confirm("Excluir este pedido? Esta ação não poderá ser desfeita.")) return; try { await props.onDeleteOrder(openedOrder.id); setOpenedOrder(null); setNotice("Pedido excluído."); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível excluir o pedido."); } }} />}
  </section>;
}

function BudgetTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className={(active ? "bg-nexus-primary text-white" : "bg-slate-50 text-nexus-muted hover:bg-slate-100") + " rounded-lg px-3 py-2 text-sm font-semibold"}>{label}</button>; }

function OrderDetailsDialog({ order, client, onClose, onEdit, onCreateBudget, onDownload, onDelete }: { order: Order; client: Client; onClose: () => void; onEdit: () => void; onCreateBudget: () => void; onDownload: () => void; onDelete: () => Promise<void> }) {
  const [preview, setPreview] = useState(false);
  const previewUrl = preview ? generateOrderPdf(order, client, false).output("datauristring") : "";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6"><section className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between border-b pb-4"><div><p className="text-sm text-nexus-muted">{order.type}</p><h2 className="mt-1 text-2xl font-bold">{order.subject}</h2><p className="mt-1 text-sm text-nexus-muted">{client.name} · {order.scheduledDate ? new Date(order.scheduledDate + "T12:00:00").toLocaleDateString("pt-BR") : "Sem data"}{order.scheduledTime ? ` às ${order.scheduledTime}` : ""}</p></div><button onClick={onClose}>Fechar</button></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="space-y-4 text-sm"><div><b>Profissional responsável</b><p className="mt-1 text-nexus-muted">{order.professional}</p></div><div><b>Endereço</b><p className="mt-1 text-nexus-muted">{order.workAddress}</p></div><div><b>Descrição do pedido</b><p className="mt-1 whitespace-pre-wrap text-nexus-muted">{order.description}</p></div>{order.observations && <div><b>Observações</b><p className="mt-1 whitespace-pre-wrap text-nexus-muted">{order.observations}</p></div>}</div><div className="rounded-xl border bg-slate-50 p-4"><h3 className="font-semibold">Ações do pedido</h3><div className="mt-4 grid grid-cols-2 gap-3"><button className="rounded-lg bg-nexus-primary px-3 py-2 text-sm font-semibold text-white" onClick={onCreateBudget}>Criar orçamento</button><button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={() => setPreview((value) => !value)}>{preview ? "Ocultar prévia" : "Ver prévia"}</button><button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={onDownload}>Baixar PDF</button><button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={onEdit}>Editar pedido</button><button className="col-span-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700" onClick={() => void onDelete()}>Excluir pedido</button></div></div></div>{preview && <div className="mt-5 overflow-hidden rounded-xl border"><p className="border-b px-4 py-3 text-sm font-semibold">Prévia do documento</p><iframe title="Prévia do pedido" className="h-[62vh] w-full" src={previewUrl} /></div>}</section></div>;
}

function ServiceConfirmation({ budget, works, orders, onClose, onSave }: { budget: Budget; works: Work[]; orders: Order[]; onClose: () => void; onSave: (completion: ServiceCompletion) => Promise<void> }) {
  const relatedWorks = works.filter((work) => work.budgetId === budget.id);
  const relatedOrders = orders.filter((order) => order.id === budget.sourceOrderId);
  const [completedOn, setCompletedOn] = useState(new Date().toISOString().slice(0, 10));
  const [confirmedBy, setConfirmedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [workId, setWorkId] = useState(relatedWorks[0]?.id || "");
  const [orderId, setOrderId] = useState(relatedOrders[0]?.id || "");
  const [error, setError] = useState("");
  const save = async () => { if (!confirmedBy.trim() || (!workId && !orderId)) { setError("Informe o responsável e vincule uma obra ou ordem de serviço."); return; } await onSave({ id: crypto.randomUUID(), budgetId: budget.id, workId: workId || undefined, orderId: orderId || undefined, completedOn, confirmedBy, notes, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6">
<section className="w-full max-w-xl rounded-2xl bg-white p-6">
<h2 className="text-xl font-bold">Confirmar prestação de serviço</h2>
<p className="mt-2 text-sm text-nexus-muted">Esta confirmação é obrigatória antes da preparação fiscal e não altera o status do orçamento.</p>
<label className="mt-4 block text-sm">Data da prestação<input className={field} type="date" value={completedOn} onChange={(event) => setCompletedOn(event.target.value)} />
</label>
<label className="mt-3 block text-sm">Responsável pela confirmação *<input className={field} value={confirmedBy} onChange={(event) => setConfirmedBy(event.target.value)} placeholder="Nome do usuário responsável" />
</label>
<label className="mt-3 block text-sm">Obra vinculada<select className={field} value={workId} onChange={(event) => setWorkId(event.target.value)}>
<option value="">Não vincular obra</option>{relatedWorks.map((work) => <option key={work.id} value={work.id}>{work.number}</option>)}</select>
</label>
<label className="mt-3 block text-sm">Ordem vinculada<select className={field} value={orderId} onChange={(event) => setOrderId(event.target.value)}>
<option value="">Não vincular ordem</option>{relatedOrders.map((order) => <option key={order.id} value={order.id}>{order.type} · {order.subject}</option>)}</select>
</label>
<label className="mt-3 block text-sm">Observações<textarea className={field} value={notes} onChange={(event) => setNotes(event.target.value)} />
</label>{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-6 flex justify-end gap-3">
<button onClick={onClose}>Cancelar</button>
<button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={save}>Confirmar prestação</button>
</div>
</section>
</div>;
}

function NfseDraftDialog({ budget, client, settings, draft, onClose, onSave, onPrepare }: { budget: Budget; client: Client; settings: FiscalSettings | null; draft?: FiscalDraft; onClose: () => void; onSave: (draft: FiscalDraft) => Promise<void>; onPrepare: () => Promise<void> }) {
  const [form, setForm] = useState<FiscalDraft>(draft || { budgetId: budget.id, title: budget.title, serviceDescription: budget.description || "", paymentDescription: budget.paymentMethod || "", serviceValue: Number(budget.totalValue) || 0, discounts: 0 });
  const [notice, setNotice] = useState("");
  const retention = Object.values(settings?.retentions || {}).filter((value) => typeof value === "number").reduce((sum, value) => sum + Number(value || 0), 0);
  const iss = Number(form.serviceValue || 0) * Number(settings?.issRate || 0) / 100; const net = Number(form.serviceValue || 0) - Number(form.discounts || 0) - iss;
  const missing = [!settings ? "Configuração fiscal da empresa" : "", !client.document ? "CPF/CNPJ do tomador" : "", !client.address ? "Endereço do tomador" : "", !form.title.trim() ? "Título do serviço" : "", !form.serviceDescription.trim() ? "Descrição detalhada" : "", !(form.serviceValue > 0) ? "Valor do serviço" : ""].filter(Boolean);
  const save = async () => { try { await onSave(form); setNotice("Rascunho salvo localmente. Nenhuma comunicação externa foi realizada."); } catch (error) { setNotice(error instanceof Error ? error.message : "Falha ao salvar rascunho."); } };
  const prepare = async () => { await save(); if (missing.length) { setNotice("Corrija as pendências antes de preparar a DPS: " + missing.join(", ") + "."); return; } try { await onPrepare(); } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível preparar a DPS."); } };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-5">
<section className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6">
<div className="flex items-start justify-between gap-4">
<div>
<p className="text-xs font-semibold uppercase text-nexus-primary">Emissão fiscal</p>
<h2 className="text-2xl font-bold">Gerar Nota Fiscal</h2>
<p className="mt-1 text-sm text-nexus-muted">Preparação local — sem validade fiscal e sem transmissão.</p>
</div>
<button onClick={onClose}>×</button>
</div>
<div className="mt-5 grid gap-5 lg:grid-cols-2">
<div className="space-y-3">
<h3 className="font-semibold">Informações do serviço</h3>
<label className="block text-sm">Título do serviço *<input className={field} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
</label>
<label className="block text-sm">Descrição detalhada *<textarea className={field + " min-h-32"} value={form.serviceDescription} onChange={(event) => setForm({ ...form, serviceDescription: event.target.value })} />
</label>
<label className="block text-sm">Descrição da forma de pagamento<input className={field} value={form.paymentDescription} onChange={(event) => setForm({ ...form, paymentDescription: event.target.value })} />
</label>
<div className="grid grid-cols-2 gap-3">
<label className="text-sm">Valor bruto *<input className={field} type="number" min="0" value={form.serviceValue} onChange={(event) => setForm({ ...form, serviceValue: Number(event.target.value) })} />
</label>
<label className="text-sm">Descontos<input className={field} type="number" min="0" value={form.discounts} onChange={(event) => setForm({ ...form, discounts: Number(event.target.value) })} />
</label>
</div>
</div>
<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
<h3 className="font-semibold">Revisão da DPS</h3>
<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
<dt>Emissora</dt>
<dd>{settings?.legalName || "Pendente"}</dd>
<dt>CNPJ</dt>
<dd>{settings?.cnpj || "Pendente"}</dd>
<dt>Tomador</dt>
<dd>{client.name}</dd>
<dt>CPF/CNPJ</dt>
<dd>{client.document || "Pendente"}</dd>
<dt>Endereço</dt>
<dd>{client.address || "Pendente"}</dd>
<dt>Município emissor</dt>
<dd>{settings?.municipalityName || "Pendente"}</dd>
<dt>Código serviço</dt>
<dd>{settings?.defaultServiceCode || "Pendente"}</dd>
<dt>ISS</dt>
<dd>{settings?.issRate ?? "Pendente"}% · {money.format(iss)}</dd>
<dt>Retenções configuradas</dt>
<dd>{retention}%</dd>
<dt>Valor líquido estimado</dt>
<dd>{money.format(net)}</dd>
<dt>Série / DPS</dt>
<dd>{settings?.dpsSeries || "Pendente"} / reservada somente na preparação</dd>
</dl>
<p className="mt-4 rounded bg-amber-50 p-3 text-xs text-amber-900">A forma de pagamento fica registrada internamente no snapshot fiscal. Ela não será inserida automaticamente no XML enquanto não houver campo oficial confirmado no leiaute.</p>
</div>
</div>{missing.length > 0 && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
<b>Pendências que impedem a preparação:</b> {missing.join(", ")}.</div>}{notice && <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}<div className="mt-6 flex justify-end gap-3">
<button onClick={onClose}>Fechar</button>
<button className="rounded-lg border border-nexus-primary px-4 py-2 text-sm font-semibold text-nexus-primary" onClick={save}>Salvar rascunho</button>
<button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={prepare}>Confirmar revisão e preparar DPS</button>
</div>
</section>
</div>;
}
