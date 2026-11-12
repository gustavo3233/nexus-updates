import { useMemo, useState } from "react";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import { installmentStatus, type Financing } from "../domain/financing";
import { balanceAmount, currentLedgerStatus, paidAmount, type LedgerEntry, type LedgerKind, type LedgerStatus, type PaymentMethod } from "../domain/ledger";
import type { Settings } from "../domain/settings";
import type { Work } from "../domain/work";
import { calculatePricing } from "../services/pricing";

type CashItem = LedgerEntry & { financingId?: string };
type Draft = { description: string; amount: string; receivedAmount: string; dueDate: string; scheduledTime: string; clientId: string; budgetId: string; category: LedgerEntry["category"]; supplierName: string };
type Props = { entries: LedgerEntry[]; clients: Client[]; works: Work[]; budgets: Budget[]; financings: Financing[]; settings: Settings; initialKindFilter?: "all" | LedgerKind; initialStatusFilter?: "all" | LedgerStatus; onSave: (entry: LedgerEntry) => void; onDelete: (entryId: string) => Promise<void>; onOpenFinancing: (financingId: string) => void };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const methods: PaymentMethod[] = ["Pix", "Transferência", "Dinheiro", "Cartão", "Outros"];
const categories: LedgerEntry["category"][] = ["Fornecedor", "Funcionário", "Materiais", "Ferramentas", "Combustível", "Logística", "Publicidade", "Impostos", "Administrativo", "Outros"];
const emptyDraft = (): Draft => ({ description: "", amount: "", receivedAmount: "", dueDate: "", scheduledTime: "", clientId: "", budgetId: "", category: "Outros", supplierName: "" });

export function CashFlowView({ entries, clients, works, budgets, financings, settings, initialKindFilter = "all", initialStatusFilter = "all", onSave, onDelete, onOpenFinancing }: Props) {
  const [choosingKind, setChoosingKind] = useState(false);
  const [creatingKind, setCreatingKind] = useState<LedgerKind | null>(null);
  const [editing, setEditing] = useState<LedgerEntry | null>(null);
  const [opened, setOpened] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState<LedgerEntry | null>(null);
  const [paymentFor, setPaymentFor] = useState<LedgerEntry | null>(null);
  const [paymentValue, setPaymentValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Pix");
  const [kindFilter, setKindFilter] = useState<"all" | LedgerKind>(initialKindFilter);
  const [statusFilter, setStatusFilter] = useState<"all" | LedgerStatus>(initialStatusFilter);

  const financingEntries = useMemo<CashItem[]>(() => financings.flatMap((financing) => financing.installments.map((installment) => ({
    id: `financing-${financing.id}-${installment.number}`, financingId: financing.id, kind: "receivable" as const,
    description: `Parcela ${installment.number}/${financing.installmentsCount} — financiamento`, category: "Outros" as const,
    totalAmount: installment.amount, issueDate: financing.createdAt.slice(0, 10), dueDate: installment.dueDate,
    clientId: financing.clientId, workId: financing.workId, supplierName: "", paymentMethod: "Pix" as const,
    status: installment.paidAt ? "Pago" as const : installmentStatus(installment) === "Vencida" ? "Vencido" as const : "Pendente" as const,
    notes: financing.notes || "", payments: installment.paidAt ? [{ id: `paid-${financing.id}-${installment.number}`, date: installment.paidAt, amount: installment.amount, method: "Pix" as const, discount: 0, interest: 0, notes: "Recebimento do financiamento", createdAt: installment.paidAt }] : [],
    createdAt: financing.createdAt, updatedAt: financing.updatedAt,
  }))), [financings]);
  const allEntries = useMemo<CashItem[]>(() => [...entries, ...financingEntries], [entries, financingEntries]);
  const visibleEntries = allEntries.filter((entry) => (kindFilter === "all" || entry.kind === kindFilter) && (statusFilter === "all" || currentLedgerStatus(entry) === statusFilter));
  const summary = useMemo(() => {
    const received = entries.filter((entry) => entry.kind === "receivable").reduce((sum, entry) => sum + paidAmount(entry), 0);
    const paid = entries.filter((entry) => entry.kind === "payable").reduce((sum, entry) => sum + paidAmount(entry), 0);
    return { received, paid, balance: received - paid };
  }, [entries]);

  const saveEntry = (entry: LedgerEntry) => { onSave(entry); setCreatingKind(null); setEditing(null); setOpened(entry); };
  const savePayment = () => {
    if (!paymentFor || !Number(paymentValue) || Number(paymentValue) > balanceAmount(paymentFor)) return;
    const createdAt = new Date().toISOString();
    const next = { ...paymentFor, payments: [...paymentFor.payments, { id: crypto.randomUUID(), date: createdAt.slice(0, 10), amount: Number(paymentValue), method: paymentMethod, discount: 0, interest: 0, notes: "", createdAt }], updatedAt: createdAt };
    next.status = currentLedgerStatus(next); onSave(next); setOpened(next); setPaymentFor(null); setPaymentValue("");
  };
  const remove = async () => {
    if (!deleting) return;
    await onDelete(deleting.id);
    setOpened(null); setDeleting(null);
  };

  return <><div className="flex justify-end"><button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={() => setChoosingKind(true)}>+ Novo lançamento</button></div>
    <section className="mt-4 grid grid-cols-3 gap-3"><Card label="Recebido" value={summary.received} tone="green" /><Card label="Pago" value={summary.paid} tone="red" /><Card label="Saldo realizado" value={summary.balance} tone={summary.balance >= 0 ? "green" : "red"} /></section>
    <section className="mt-6 rounded-xl border bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><b>Lançamentos</b><div className="flex gap-2"><select className="rounded-lg border px-2 py-1.5 text-sm" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | LedgerKind)}><option value="all">Todos</option><option value="receivable">A receber</option><option value="payable">A pagar</option></select><select className="rounded-lg border px-2 py-1.5 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | LedgerStatus)}><option value="all">Todas as situações</option><option value="Pendente">Pendentes</option><option value="Pago parcialmente">Parcialmente pagos</option><option value="Pago">Recebidos / pagos</option><option value="Vencido">Vencidos</option><option value="Cancelado">Cancelados</option></select></div></div>
      {visibleEntries.length === 0 ? <p className="p-6 text-sm text-nexus-muted">Nenhum lançamento para os filtros selecionados.</p> : visibleEntries.map((entry) => <EntryRow key={entry.id} entry={entry} clients={clients} onOpen={() => entry.financingId ? onOpenFinancing(entry.financingId) : setOpened(entry)} />)}
    </section>
    {choosingKind && <KindModal onCancel={() => setChoosingKind(false)} onSelect={(kind) => { setChoosingKind(false); setCreatingKind(kind); }} />}
    {creatingKind && <EntryForm kind={creatingKind} clients={clients} budgets={budgets} works={works} settings={settings} onCancel={() => setCreatingKind(null)} onSave={saveEntry} />}
    {editing && <EntryForm key={editing.id} kind={editing.kind} initial={editing} clients={clients} budgets={budgets} works={works} settings={settings} onCancel={() => setEditing(null)} onSave={saveEntry} />}
    {opened && <EntryDetail entry={opened} clients={clients} budgets={budgets} onClose={() => setOpened(null)} onEdit={() => { setOpened(null); setEditing(opened); }} onDelete={() => setDeleting(opened)} onPay={() => setPaymentFor(opened)} />}
    {deleting && <ConfirmDelete onCancel={() => setDeleting(null)} onConfirm={remove} />}
    {paymentFor && <PaymentModal entry={paymentFor} value={paymentValue} method={paymentMethod} onValue={setPaymentValue} onMethod={setPaymentMethod} onCancel={() => setPaymentFor(null)} onConfirm={savePayment} />}
  </>;
}

function EntryRow({ entry, clients, onOpen }: { entry: CashItem; clients: Client[]; onOpen: () => void }) {
  const status = currentLedgerStatus(entry);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"><div><div className="flex items-center gap-2"><b>{entry.description}</b><Badge value={entry.kind === "receivable" ? "A receber" : "A pagar"} /><Badge value={status} /></div><p className="mt-1 text-sm text-nexus-muted">{clients.find((client) => client.id === entry.clientId)?.name || entry.supplierName || (entry.kind === "receivable" ? "Cliente não informado" : entry.category)} · {new Date(entry.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}{entry.scheduledTime ? ` às ${entry.scheduledTime}` : ""}</p></div><div className="flex items-center gap-4"><div className="text-right text-sm"><p>Total: <b>{money.format(entry.totalAmount)}</b></p><p className="text-nexus-muted">Saldo: {money.format(balanceAmount(entry))}</p></div><button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={onOpen}>{entry.financingId ? "Abrir financiamento" : "Abrir lançamento"}</button></div></div>;
}

function LegacyEntryForm({ kind, initial, clients, budgets, works, settings, onCancel, onSave }: { kind: LedgerKind; initial?: LedgerEntry; clients: Client[]; budgets: Budget[]; works: Work[]; settings: Settings; onCancel: () => void; onSave: (entry: LedgerEntry) => void }) {
  const [draft, setDraft] = useState<Draft>(() => initial ? { description: initial.description, amount: String(initial.totalAmount), receivedAmount: "", dueDate: initial.dueDate, scheduledTime: initial.scheduledTime || "", clientId: initial.clientId || "", budgetId: initial.budgetId || "", category: initial.category, supplierName: initial.supplierName } : emptyDraft());
  const [clientOpen, setClientOpen] = useState(false); const [clientSearch, setClientSearch] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false); const [budgetSearch, setBudgetSearch] = useState("");
  const selectedBudgets = budgets.filter((budget) => budget.status === "Faturado" && (!draft.clientId || budget.clientId === draft.clientId));
  const title = (budget: Budget) => { const work = works.find((item) => item.budgetId === budget.id); const text = [budget.title, budget.description, work?.contractedServices].find((value) => value?.trim() && !/^PR\s*\d/i.test(value.trim())) || budget.title || "Obra sem nome"; const number = String(budget.number || "").replace(/\D/g, "").slice(-2); return `${text}${number ? ` · ${number.padStart(2, "0")}` : ""}`; };
  const save = () => {
    const amount = Number(draft.amount); if (!draft.clientId || !draft.budgetId || !draft.description.trim() || amount <= 0 || !draft.dueDate) return;
    const now = new Date().toISOString(); const initialPaid = initial ? 0 : Math.min(amount, Math.max(0, Number(draft.receivedAmount) || 0)); const work = works.find((item) => item.budgetId === draft.budgetId);
    const entry: LedgerEntry = { id: initial?.id || crypto.randomUUID(), kind, description: draft.description.trim(), category: draft.category, totalAmount: amount, issueDate: initial?.issueDate || now.slice(0, 10), dueDate: draft.dueDate, scheduledTime: draft.scheduledTime || undefined, clientId: draft.clientId, budgetId: draft.budgetId, workId: work?.id, supplierName: draft.supplierName, paymentMethod: initial?.paymentMethod || "Pix", status: initial?.status || "Pendente", notes: initial?.notes || "", payments: initial?.payments || (initialPaid ? [{ id: crypto.randomUUID(), date: now.slice(0, 10), amount: initialPaid, method: "Pix", discount: 0, interest: 0, notes: "Valor registrado no lançamento", createdAt: now }] : []), createdAt: initial?.createdAt || now, updatedAt: now };
    entry.status = currentLedgerStatus(entry); onSave(entry);
  };
  const clientItems = clients.filter((client) => client.name.toLocaleLowerCase("pt-BR").includes(clientSearch.toLocaleLowerCase("pt-BR"))).map((client) => ({ id: client.id, label: client.name }));
  const budgetItems = selectedBudgets.filter((budget) => title(budget).toLocaleLowerCase("pt-BR").includes(budgetSearch.toLocaleLowerCase("pt-BR"))).map((budget) => ({ id: budget.id, label: title(budget) }));
  const selectedClient = clients.find((client) => client.id === draft.clientId)?.name || "Selecione o cliente";
  const selectedBudget = selectedBudgets.find((budget) => budget.id === draft.budgetId);
  return <Modal title={initial ? "Editar lançamento" : kind === "receivable" ? "Nova conta a receber" : "Nova conta a pagar"}><div className="space-y-3"><SearchPicker label="Cliente" value={selectedClient} open={clientOpen} query={clientSearch} onOpen={() => { setBudgetOpen(false); setClientOpen(true); setClientSearch(""); }} onQuery={setClientSearch} items={clientItems} onSelect={(id) => { setDraft({ ...draft, clientId: id, budgetId: "" }); setClientOpen(false); }} /><SearchPicker label="Obra faturada" value={selectedBudget ? title(selectedBudget) : "Selecione a obra"} open={budgetOpen} query={budgetSearch} onOpen={() => { setClientOpen(false); setBudgetOpen(true); setBudgetSearch(""); }} onQuery={setBudgetSearch} items={budgetItems} onSelect={(id) => { const budget = budgets.find((item) => item.id === id); const amount = budget ? calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue : Number(draft.amount) || 0; setDraft({ ...draft, budgetId: id, amount: String(amount) }); setBudgetOpen(false); }} /><div className="grid grid-cols-2 gap-3"><label className="text-sm">Data<input className="mt-1 w-full rounded border px-3 py-2" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label><label className="text-sm">Horário <span className="text-nexus-muted">(opcional)</span><input className="mt-1 w-full rounded border px-3 py-2" type="time" value={draft.scheduledTime} onChange={(event) => setDraft({ ...draft, scheduledTime: event.target.value })} /></label></div><label className="block text-sm">Descrição<input className="mt-1 w-full rounded border px-3 py-2" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><label className="block text-sm">Valor <span className="text-nexus-muted">(preenchido pela obra; editável)</span><input className="mt-1 w-full rounded border px-3 py-2" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>{!initial && <label className="block text-sm">Valor já {kind === "receivable" ? "recebido" : "pago"} <span className="text-nexus-muted">(opcional)</span><input className="mt-1 w-full rounded border px-3 py-2" type="number" min="0" step="0.01" value={draft.receivedAmount} onChange={(event) => setDraft({ ...draft, receivedAmount: event.target.value })} /></label>}<div className="grid grid-cols-2 gap-3"><label className="text-sm">Categoria<select className="mt-1 w-full rounded border px-3 py-2" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as LedgerEntry["category"] })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-sm">Beneficiário <span className="text-nexus-muted">(opcional)</span><input className="mt-1 w-full rounded border px-3 py-2" value={draft.supplierName} onChange={(event) => setDraft({ ...draft, supplierName: event.target.value })} /></label></div></div><Actions onCancel={onCancel} onConfirm={save} label={initial ? "Salvar alterações" : "Salvar lançamento"} /></Modal>;
}

function EntryForm({ kind, initial, clients, budgets, works, settings, onCancel, onSave }: { kind: LedgerKind; initial?: LedgerEntry; clients: Client[]; budgets: Budget[]; works: Work[]; settings: Settings; onCancel: () => void; onSave: (entry: LedgerEntry) => void }) {
  const [draft, setDraft] = useState<Draft>(() => initial ? { description: initial.description, amount: String(initial.totalAmount), receivedAmount: "", dueDate: initial.dueDate, scheduledTime: initial.scheduledTime || "", clientId: initial.clientId || "", budgetId: initial.budgetId || "", category: initial.category, supplierName: initial.supplierName } : emptyDraft());
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetSearch, setBudgetSearch] = useState("");
  const [error, setError] = useState("");
  const selectedBudgets = budgets.filter((budget) => budget.status === "Faturado" && (!draft.clientId || budget.clientId === draft.clientId));
  const title = (budget: Budget) => { const work = works.find((item) => item.budgetId === budget.id); const text = [budget.title, budget.description, work?.contractedServices].find((value) => value?.trim() && !/^PR\s*\d/i.test(value.trim())) || budget.title || "Obra sem nome"; const number = String(budget.number || "").replace(/\D/g, "").slice(-2); return `${text}${number ? ` · ${number.padStart(2, "0")}` : ""}`; };
  const selectedClient = clients.find((client) => client.id === draft.clientId)?.name || "Nenhum cliente vinculado";
  const selectedBudget = selectedBudgets.find((budget) => budget.id === draft.budgetId);
  const clientItems = clients.filter((client) => client.name.toLocaleLowerCase("pt-BR").includes(clientSearch.toLocaleLowerCase("pt-BR"))).map((client) => ({ id: client.id, label: client.name }));
  const budgetItems = selectedBudgets.filter((budget) => title(budget).toLocaleLowerCase("pt-BR").includes(budgetSearch.toLocaleLowerCase("pt-BR"))).map((budget) => ({ id: budget.id, label: title(budget) }));
  const save = () => {
    const amount = Number(draft.amount);
    if (!draft.description.trim() || amount <= 0 || !draft.dueDate) { setError("Preencha a descrição, o valor e a data."); return; }
    const now = new Date().toISOString();
    const initialPaid = initial ? 0 : Math.min(amount, Math.max(0, Number(draft.receivedAmount) || 0));
    const work = works.find((item) => item.budgetId === draft.budgetId);
    const entry: LedgerEntry = {
      id: initial?.id || crypto.randomUUID(), kind, description: draft.description.trim(), category: draft.category, totalAmount: amount,
      issueDate: initial?.issueDate || now.slice(0, 10), dueDate: draft.dueDate, scheduledTime: draft.scheduledTime || undefined,
      clientId: draft.clientId || undefined, budgetId: draft.budgetId || undefined, workId: work?.id, supplierName: draft.supplierName.trim(),
      paymentMethod: initial?.paymentMethod || "Pix", status: initial?.status || "Pendente", notes: initial?.notes || "",
      payments: initial?.payments || (initialPaid ? [{ id: crypto.randomUUID(), date: now.slice(0, 10), amount: initialPaid, method: "Pix", discount: 0, interest: 0, notes: "Valor registrado no lançamento", createdAt: now }] : []),
      createdAt: initial?.createdAt || now, updatedAt: now
    };
    entry.status = currentLedgerStatus(entry);
    onSave(entry);
  };
  const clearLinks = () => { setDraft({ ...draft, clientId: "", budgetId: "" }); setClientOpen(false); setBudgetOpen(false); };
  const partyLabel = kind === "receivable" ? "Nome do cliente ou responsável" : "Beneficiário ou responsável";
  return <Modal title={initial ? "Editar lançamento" : kind === "receivable" ? "Nova conta a receber" : "Nova conta a pagar"}>
    <p className="text-sm text-nexus-muted">Cliente e obra são opcionais. Use os vínculos somente quando este lançamento fizer parte do cadastro do sistema.</p>
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3"><SearchPicker label="Cliente cadastrado (opcional)" value={selectedClient} open={clientOpen} query={clientSearch} onOpen={() => { setBudgetOpen(false); setClientOpen(true); setClientSearch(""); }} onQuery={setClientSearch} items={clientItems} onSelect={(id) => { setDraft({ ...draft, clientId: id, budgetId: "" }); setClientOpen(false); }} /><SearchPicker label="Obra faturada (opcional)" value={selectedBudget ? title(selectedBudget) : "Nenhuma obra vinculada"} open={budgetOpen} query={budgetSearch} onOpen={() => { setClientOpen(false); setBudgetOpen(true); setBudgetSearch(""); }} onQuery={setBudgetSearch} items={budgetItems} onSelect={(id) => { const budget = budgets.find((item) => item.id === id); const amount = budget ? calculatePricing(budget.totalValue, settings, budget.pricingSnapshot).chargedValue : Number(draft.amount) || 0; setDraft({ ...draft, budgetId: id, amount: String(amount) }); setBudgetOpen(false); }} /></div>
      {(draft.clientId || draft.budgetId) && <button type="button" className="text-xs font-semibold text-nexus-primary" onClick={clearLinks}>Remover vínculos de cliente e obra</button>}
      <label className="block text-sm">{partyLabel} <span className="text-nexus-muted">(opcional)</span><input className="mt-1 w-full rounded border px-3 py-2" value={draft.supplierName} onChange={(event) => setDraft({ ...draft, supplierName: event.target.value })} placeholder={kind === "receivable" ? "Ex.: Cliente eventual" : "Ex.: Fornecedor ou prestador"} /></label>
      <div className="grid grid-cols-2 gap-3"><label className="text-sm">Data *<input className="mt-1 w-full rounded border px-3 py-2" type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label><label className="text-sm">Horário <span className="text-nexus-muted">(opcional)</span><input className="mt-1 w-full rounded border px-3 py-2" type="time" value={draft.scheduledTime} onChange={(event) => setDraft({ ...draft, scheduledTime: event.target.value })} /></label></div>
      <label className="block text-sm">Descrição *<input className="mt-1 w-full rounded border px-3 py-2" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label className="block text-sm">Valor * <span className="text-nexus-muted">(editável mesmo quando houver obra vinculada)</span><input className="mt-1 w-full rounded border px-3 py-2" type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} /></label>
      {!initial && <label className="block text-sm">Valor já {kind === "receivable" ? "recebido" : "pago"} <span className="text-nexus-muted">(opcional)</span><input className="mt-1 w-full rounded border px-3 py-2" type="number" min="0" step="0.01" value={draft.receivedAmount} onChange={(event) => setDraft({ ...draft, receivedAmount: event.target.value })} /></label>}
      <label className="block text-sm">Categoria<select className="mt-1 w-full rounded border px-3 py-2" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as LedgerEntry["category"] })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
    <Actions onCancel={onCancel} onConfirm={save} label={initial ? "Salvar alterações" : "Salvar lançamento"} />
  </Modal>;
}

function EntryDetail({ entry, clients, budgets, onClose, onEdit, onDelete, onPay }: { entry: LedgerEntry; clients: Client[]; budgets: Budget[]; onClose: () => void; onEdit: () => void; onDelete: () => void; onPay: () => void }) {
  const status = currentLedgerStatus(entry);
  const budget = budgets.find((item) => item.id === entry.budgetId);
  const party = clients.find((client) => client.id === entry.clientId)?.name || entry.supplierName || "Não informado";
  return <Modal title="Lançamento"><div className="space-y-2 text-sm"><p><b>{entry.description}</b></p><p>Tipo: {entry.kind === "receivable" ? "Conta a receber" : "Conta a pagar"} · <Badge value={status} /></p><p>Cliente / responsável: {party}</p><p>Obra: {budget?.title || "Não informada"}</p><p>Data: {new Date(entry.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}{entry.scheduledTime ? ` às ${entry.scheduledTime}` : ""}</p><p>Valor total: <b>{money.format(entry.totalAmount)}</b></p><p>Saldo pendente: <b>{money.format(balanceAmount(entry))}</b></p></div><div className="mt-6 flex flex-wrap justify-between gap-2"><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" onClick={onDelete}>Apagar</button><div className="flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm font-semibold" onClick={onEdit}>Editar</button>{status !== "Pago" && status !== "Cancelado" && <button className="rounded-lg bg-nexus-primary px-3 py-2 text-sm font-semibold text-white" onClick={onPay}>Registrar {entry.kind === "receivable" ? "recebimento" : "pagamento"}</button>}<button className="rounded-lg border px-3 py-2 text-sm" onClick={onClose}>Fechar</button></div></div></Modal>;
}
function KindModal({ onCancel, onSelect }: { onCancel: () => void; onSelect: (kind: LedgerKind) => void }) { return <Modal title="Novo lançamento"><p className="text-sm text-nexus-muted">O que você deseja lançar?</p><div className="mt-5 grid grid-cols-2 gap-3"><button className="rounded-xl border p-5 text-left hover:border-nexus-primary" onClick={() => onSelect("receivable")}><b>Conta a receber</b><p className="mt-1 text-sm text-nexus-muted">Valor que a empresa vai receber.</p></button><button className="rounded-xl border p-5 text-left hover:border-nexus-primary" onClick={() => onSelect("payable")}><b>Conta a pagar</b><p className="mt-1 text-sm text-nexus-muted">Valor que a empresa precisa pagar.</p></button></div><div className="mt-6 text-right"><button onClick={onCancel}>Cancelar</button></div></Modal>; }
function PaymentModal({ entry, value, method, onValue, onMethod, onCancel, onConfirm }: { entry: LedgerEntry; value: string; method: PaymentMethod; onValue: (value: string) => void; onMethod: (value: PaymentMethod) => void; onCancel: () => void; onConfirm: () => void }) { return <Modal title={entry.kind === "receivable" ? "Registrar recebimento" : "Registrar pagamento"}><p className="text-sm text-nexus-muted">Saldo pendente: {money.format(balanceAmount(entry))}</p><input className="mt-4 w-full rounded border px-3 py-2" type="number" min="0" step="0.01" value={value} onChange={(event) => onValue(event.target.value)} placeholder="Valor" /><select className="mt-3 w-full rounded border px-3 py-2" value={method} onChange={(event) => onMethod(event.target.value as PaymentMethod)}>{methods.map((item) => <option key={item}>{item}</option>)}</select><Actions onCancel={onCancel} onConfirm={onConfirm} label="Confirmar" /></Modal>; }
function ConfirmDelete({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) { return <Modal title="Apagar lançamento"><p className="text-sm text-nexus-muted">Tem certeza? Esta ação apagará o lançamento e seus registros de pagamento e não poderá ser desfeita.</p><div className="mt-6 flex justify-end gap-3"><button onClick={onCancel}>Cancelar</button><button className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white" onClick={onConfirm}>Apagar definitivamente</button></div></Modal>; }
function SearchPicker({ label, value, open, query, onOpen, onQuery, items, onSelect }: { label: string; value: string; open: boolean; query: string; onOpen: () => void; onQuery: (value: string) => void; items: { id: string; label: string }[]; onSelect: (id: string) => void }) { return <label className="relative block text-sm">{label}<button type="button" className="mt-1 flex w-full items-center justify-between rounded border px-3 py-2 text-left" onClick={onOpen}>{value}<span>⌕</span></button>{open && <div className="absolute z-30 mt-1 w-full rounded-lg border bg-white p-2 shadow-lg"><input autoFocus className="w-full rounded border px-2 py-2 text-sm" placeholder={`Buscar ${label.toLowerCase()}`} value={query} onChange={(event) => onQuery(event.target.value)} /><div className="mt-1 max-h-40 overflow-y-auto">{items.length ? items.map((item) => <button type="button" className="block w-full rounded px-2 py-2 text-left text-sm hover:bg-slate-100" key={item.id} onClick={() => onSelect(item.id)}>{item.label}</button>) : <p className="p-2 text-sm text-nexus-muted">Nenhum resultado encontrado.</p>}</div></div>}</label>; }
function Modal({ title, children }: { title: string; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6"><section className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-xl font-bold">{title}</h2><div className="mt-4">{children}</div></section></div>; }
function Actions({ onCancel, onConfirm, label }: { onCancel: () => void; onConfirm: () => void; label: string }) { return <div className="mt-6 flex justify-end gap-3"><button onClick={onCancel}>Cancelar</button><button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={onConfirm}>{label}</button></div>; }
function Badge({ value }: { value: string }) { const color = value === "Pago" ? "bg-emerald-100 text-emerald-800" : value === "Vencido" ? "bg-red-100 text-red-800" : value === "Pago parcialmente" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"; return <span className={`rounded-full px-2 py-1 text-xs ${color}`}>{value}</span>; }
function Card({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "red" }) { const colors = { slate: "bg-white", green: "bg-emerald-50", red: "bg-red-50" }; return <div className={`rounded-xl border p-4 ${colors[tone]}`}><p className="text-xs uppercase text-nexus-muted">{label}</p><b className="mt-1 block text-lg">{money.format(value)}</b></div>; }
