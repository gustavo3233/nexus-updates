import { type ChangeEvent, useMemo, useState } from "react";
import { budgetUnitOptions } from "../domain/budget";
import type { Client } from "../domain/client";
import { emptyProduct, productCategories, type Product, type ProductStockMovement } from "../domain/product";
import type { Work } from "../domain/work";

type Props = { products: Product[]; clients: Client[]; works: Work[]; onSave: (product: Product) => void };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const stockOf = (product: Product) => Number(product.stockQuantity) || 0;
const minimumOf = (product: Product) => Math.max(0, Number(product.minimumStock) || 0);
const lowStock = (product: Product) => stockOf(product) <= minimumOf(product);

function readImage(event: ChangeEvent<HTMLInputElement>, callback: (data: string) => void) {
  const file = event.target.files?.[0];
  if (!file?.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result));
  reader.readAsDataURL(file);
}

export function ProductsView({ products, clients, works, onSave }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [editing, setEditing] = useState<Product | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [moving, setMoving] = useState<Product | null>(null);
  const shown = useMemo(() => products.filter((product) => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return (!term || [product.name, product.description, product.category].join(" ").toLocaleLowerCase("pt-BR").includes(term)) && (category === "Todos" || product.category === category);
  }), [products, search, category]);
  const save = (product: Product) => {
    onSave(product);
    setSelected((current) => current?.id === product.id ? product : current);
  };

  return <section>
    <div className="mb-5 flex justify-end">
      <button type="button" onClick={() => setEditing({ ...emptyProduct(), id: crypto.randomUUID(), createdAt: new Date().toISOString() })} className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white shadow-sm">+ Novo produto</button>
    </div>
    <div className="mb-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <label className="min-w-64 flex-1"><span className="sr-only">Buscar produto</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="⌕ Buscar produto" className="w-full rounded-lg border border-nexus-border px-3 py-2 text-sm" /></label>
      <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-nexus-border bg-white px-3 py-2 text-sm"><option>Todos</option>{productCategories.map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[64px_minmax(0,1fr)_130px_110px_130px_100px] gap-3 border-b bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-nexus-muted"><span>Foto</span><span>Produto</span><span>Categoria</span><span>Estoque</span><span>Valor padrão</span><span /></div>
      {shown.length ? shown.map((product) => <button type="button" key={product.id} onClick={() => setSelected(product)} className="grid w-full grid-cols-[64px_minmax(0,1fr)_130px_110px_130px_100px] items-center gap-3 border-b px-4 py-3 text-left transition hover:bg-slate-50 last:border-0">
        {product.photoDataUrl ? <img src={product.photoDataUrl} alt="" className="h-12 w-12 rounded-lg border object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl">📦</span>}
        <span><b className="block text-sm text-nexus-ink">{product.name}</b>{product.description && <span className="block truncate text-xs text-nexus-muted">{product.description}</span>}</span><span className="text-sm text-nexus-muted">{product.category}</span><span className={"text-sm font-semibold " + (lowStock(product) ? "text-red-700" : "text-nexus-ink")}>{stockOf(product).toLocaleString("pt-BR")} {product.unit}{lowStock(product) && <small className="mt-0.5 block text-[10px] font-medium uppercase">Reposição</small>}</span><span className="text-sm font-semibold text-nexus-ink">{money.format(product.unitPrice)}</span><span className="justify-self-end text-sm font-semibold text-nexus-primary">Ver</span>
      </button>) : <p className="px-4 py-10 text-center text-sm text-nexus-muted">Nenhum produto encontrado.</p>}
    </div>
    {editing && <ProductModal product={editing} onCancel={() => setEditing(null)} onSave={(product) => { save(product); setEditing(null); }} />}
    {selected && <ProductDetails product={selected} clients={clients} works={works} onClose={() => setSelected(null)} onEdit={() => { setSelected(null); setEditing(selected); }} onMove={() => setMoving(selected)} />}
    {moving && <StockMovementModal product={moving} clients={clients} works={works} onCancel={() => setMoving(null)} onSave={(product) => { save(product); setMoving(null); }} />}
  </section>;
}

function ProductModal({ product, onCancel, onSave }: { product: Product; onCancel: () => void; onSave: (product: Product) => void }) {
  const initialStock = stockOf(product);
  const [draft, setDraft] = useState<Product>({ ...product, stockQuantity: initialStock, minimumStock: minimumOf(product), stockHistory: product.stockHistory ?? [] });
  const [error, setError] = useState("");
  const set = <K extends keyof Product>(key: K, value: Product[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = () => {
    if (!draft.name.trim()) return setError("Informe o nome do produto.");
    if (draft.unitPrice < 0 || draft.stockQuantity < 0 || draft.minimumStock < 0) return setError("Informe valores de estoque e preço válidos.");
    const now = new Date().toISOString();
    const changedStock = product.updatedAt && initialStock !== Number(draft.stockQuantity);
    const history = changedStock ? [{ id: crypto.randomUUID(), type: "Ajuste de estoque" as const, quantity: Number(draft.stockQuantity) - initialStock, previousQuantity: initialStock, resultingQuantity: Number(draft.stockQuantity), happenedAt: now, notes: "Quantidade atualizada manualmente no cadastro do produto." }, ...(draft.stockHistory ?? [])] : draft.stockHistory ?? [];
    onSave({ ...draft, name: draft.name.trim(), description: draft.description.trim(), stockQuantity: Number(draft.stockQuantity), minimumStock: Number(draft.minimumStock), stockHistory: history, updatedAt: now });
  };
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-6"><section className="max-h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-nexus-ink">{product.updatedAt ? "Editar produto" : "Novo produto"}</h2><p className="mt-1 text-sm text-nexus-muted">Cadastre o produto e mantenha a quantidade disponível sempre atualizada.</p></div><button type="button" onClick={onCancel} className="text-xl text-nexus-muted">×</button></div>
    <div className="mt-5 grid grid-cols-2 gap-4"><div className="col-span-2"><span className="text-sm font-medium">Foto do produto</span><div className="mt-1 flex items-center gap-3 rounded-lg border border-dashed p-3">{draft.photoDataUrl ? <img src={draft.photoDataUrl} alt="Prévia do produto" className="h-20 w-20 rounded-lg border object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-2xl">📦</span>}<div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold text-nexus-primary">{draft.photoDataUrl ? "Trocar foto" : "Adicionar foto"}<input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => readImage(event, (value) => set("photoDataUrl", value))} /></label>{draft.photoDataUrl && <button type="button" onClick={() => set("photoDataUrl", undefined)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Remover</button>}</div></div></div><label className="col-span-2 text-sm font-medium">Nome do produto *<input autoFocus value={draft.name} onChange={(event) => set("name", event.target.value)} className="mt-1 w-full rounded-lg border border-nexus-border px-3 py-2" placeholder="Ex.: Tinta acrílica premium" /></label><label className="text-sm font-medium">Categoria<select value={draft.category} onChange={(event) => set("category", event.target.value)} className="mt-1 w-full rounded-lg border border-nexus-border bg-white px-3 py-2">{productCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-medium">Unidade<select value={draft.unit} onChange={(event) => set("unit", event.target.value)} className="mt-1 w-full rounded-lg border border-nexus-border bg-white px-3 py-2">{budgetUnitOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="text-sm font-medium">Quantidade em estoque<input value={draft.stockQuantity ?? ""} onChange={(event) => set("stockQuantity", Number(event.target.value))} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-nexus-border px-3 py-2" /></label><label className="text-sm font-medium">Estoque mínimo / alerta<input value={draft.minimumStock ?? ""} onChange={(event) => set("minimumStock", Number(event.target.value))} type="number" min="0" step="0.01" className="mt-1 w-full rounded-lg border border-nexus-border px-3 py-2" /></label><label className="text-sm font-medium">Valor padrão<input value={draft.unitPrice || ""} onChange={(event) => set("unitPrice", Number(event.target.value))} type="number" min="0" step="0.01" placeholder="R$ 0,00" className="mt-1 w-full rounded-lg border border-nexus-border px-3 py-2" /></label><label className="flex items-end gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} /> Produto ativo</label><label className="col-span-2 text-sm font-medium">Descrição / observação<textarea value={draft.description} onChange={(event) => set("description", event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-nexus-border px-3 py-2" placeholder="Detalhes úteis para identificar o produto" /></label></div>
    {error && <p className="mt-3 text-sm text-nexus-error">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button><button type="button" onClick={submit} className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white">Salvar produto</button></div>
  </section></div>;
}

function ProductDetails({ product, clients, works, onClose, onEdit, onMove }: { product: Product; clients: Client[]; works: Work[]; onClose: () => void; onEdit: () => void; onMove: () => void }) {
  const history = product.stockHistory ?? [];
  const labelDestination = (movement: ProductStockMovement) => {
    const client = clients.find((item) => item.id === movement.clientId)?.name;
    const work = works.find((item) => item.id === movement.workId);
    return [client, work ? (work.contractedServices || work.number) : ""].filter(Boolean).join(" · ") || "Estoque interno";
  };
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-6"><section className="max-h-full w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-4">{product.photoDataUrl ? <img src={product.photoDataUrl} alt="" className="h-20 w-20 rounded-xl border object-cover" /> : <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-3xl">📦</span>}<div><h2 className="text-xl font-bold text-nexus-ink">{product.name}</h2><p className="text-sm text-nexus-muted">{product.category} · {product.unit} · {money.format(product.unitPrice)}</p></div></div><button type="button" onClick={onClose} className="text-xl text-nexus-muted">×</button></div>
    <div className="mt-5 grid grid-cols-3 gap-3"><div className={"rounded-xl border p-4 " + (lowStock(product) ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50")}><span className="text-xs font-semibold uppercase text-nexus-muted">Em estoque</span><b className={"mt-1 block text-2xl " + (lowStock(product) ? "text-red-700" : "text-nexus-ink")}>{stockOf(product).toLocaleString("pt-BR")} {product.unit}</b>{lowStock(product) && <p className="mt-1 text-xs font-medium text-red-700">Reposição necessária</p>}</div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-semibold uppercase text-nexus-muted">Estoque mínimo</span><b className="mt-1 block text-2xl text-nexus-ink">{minimumOf(product).toLocaleString("pt-BR")} {product.unit}</b></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><span className="text-xs font-semibold uppercase text-nexus-muted">Situação</span><b className="mt-1 block text-lg text-nexus-ink">{product.active ? "Ativo" : "Inativo"}</b></div></div>
    {product.description && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-nexus-muted">{product.description}</p>}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={onEdit} className="rounded-lg border border-nexus-primary px-4 py-2 text-sm font-semibold text-nexus-primary">Editar produto</button><button type="button" onClick={onMove} className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white">Registrar saída</button></div>
    <section className="mt-6"><h3 className="font-semibold text-nexus-ink">Histórico de estoque</h3><div className="mt-2 overflow-hidden rounded-xl border border-slate-200">{history.length ? history.map((movement) => <div key={movement.id} className="grid grid-cols-[minmax(0,1fr)_150px_150px] gap-4 border-b px-4 py-3 text-sm last:border-0"><div><b className="block text-nexus-ink">{movement.type}</b><span className="text-xs text-nexus-muted">{labelDestination(movement)}{movement.notes ? ` · ${movement.notes}` : ""}</span></div><span className={movement.quantity < 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>{movement.quantity > 0 ? "+" : ""}{movement.quantity.toLocaleString("pt-BR")} {product.unit}</span><span className="text-right text-xs text-nexus-muted">{dateTime.format(new Date(movement.happenedAt))}</span></div>) : <p className="px-4 py-8 text-center text-sm text-nexus-muted">Ainda não há movimentações registradas.</p>}</div></section>
  </section></div>;
}

function StockMovementModal({ product, clients, works, onCancel, onSave }: { product: Product; clients: Client[]; works: Work[]; onCancel: () => void; onSave: (product: Product) => void }) {
  const [quantity, setQuantity] = useState("");
  const [clientId, setClientId] = useState("");
  const [workId, setWorkId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const eligibleWorks = works.filter((work) => !clientId || work.clientId === clientId);
  const submit = () => {
    const amount = Number(quantity);
    if (!amount || amount <= 0) return setError("Informe uma quantidade maior que zero.");
    if (amount > stockOf(product)) return setError("A saída não pode ser maior que a quantidade disponível em estoque.");
    const now = new Date().toISOString();
    const movement: ProductStockMovement = { id: crypto.randomUUID(), type: "Saída manual", quantity: -amount, previousQuantity: stockOf(product), resultingQuantity: stockOf(product) - amount, happenedAt: now, clientId: clientId || undefined, workId: workId || undefined, notes: notes.trim() || undefined };
    onSave({ ...product, stockQuantity: movement.resultingQuantity, stockHistory: [movement, ...(product.stockHistory ?? [])], updatedAt: now });
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6"><section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">Registrar saída de produto</h2><p className="mt-1 text-sm text-nexus-muted">Disponível: {stockOf(product).toLocaleString("pt-BR")} {product.unit}. Informe o destino para manter o rastreio do estoque.</p></div><button type="button" onClick={onCancel} className="text-xl text-nexus-muted">×</button></div><div className="mt-5 grid grid-cols-2 gap-4"><label className="col-span-2 text-sm font-medium">Quantidade de saída *<input autoFocus type="number" min="0.01" max={stockOf(product)} step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1 w-full rounded-lg border border-nexus-border px-3 py-2" /></label><label className="text-sm font-medium">Cliente de destino (opcional)<select value={clientId} onChange={(event) => { setClientId(event.target.value); setWorkId(""); }} className="mt-1 w-full rounded-lg border border-nexus-border bg-white px-3 py-2"><option value="">Não vincular cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="text-sm font-medium">Obra de destino (opcional)<select value={workId} onChange={(event) => setWorkId(event.target.value)} className="mt-1 w-full rounded-lg border border-nexus-border bg-white px-3 py-2"><option value="">Não vincular obra</option>{eligibleWorks.map((work) => <option key={work.id} value={work.id}>{work.contractedServices || work.number}</option>)}</select></label><label className="col-span-2 text-sm font-medium">Observação<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: material separado para a reforma" className="mt-1 min-h-20 w-full rounded-lg border border-nexus-border px-3 py-2" /></label></div>{error && <p className="mt-3 text-sm text-nexus-error">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancelar</button><button type="button" onClick={submit} className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white">Registrar saída</button></div></section></div>;
}
