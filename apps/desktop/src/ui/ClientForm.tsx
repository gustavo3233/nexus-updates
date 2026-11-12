import { FormEvent, useState } from "react";

import { emptyClientDraft, type Client, type ClientAddress, type ClientDraft, type ClientType, validateClient } from "../domain/client";

type ClientFormProps = {
  onCancel: () => void;
  onSave: (client: Client) => void;
  initialClient?: Client;
};

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  multiline?: boolean;
};

function Field({ label, value, placeholder, onChange, type = "text", multiline = false }: FieldProps) {
  const className = "mt-1 w-full rounded-lg border border-nexus-border bg-white px-3 py-2.5 text-sm text-nexus-ink outline-none transition focus:border-nexus-primary focus:ring-2 focus:ring-orange-100";

  return <label className="block text-sm font-medium text-nexus-ink">{label}{multiline ? <textarea className={`${className} min-h-24 resize-y`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /> : <input className={className} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} />}</label>;
}

export function ClientForm({ onCancel, onSave, initialClient }: ClientFormProps) {
  const [draft, setDraft] = useState<ClientDraft>(initialClient ? { ...initialClient } : emptyClientDraft);
  const [error, setError] = useState<string | null>(null);

  function updateDraft<Field extends keyof ClientDraft>(field: Field, value: ClientDraft[Field]) {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateClient(draft);
    if (validationError) return setError(validationError);

    const primaryAddress = draft.address.trim();
    const extraAddresses = (draft.addresses ?? []).filter((item) => item.label.trim() && item.address.trim());
    const addresses: ClientAddress[] = [
      ...(primaryAddress ? [{ id: crypto.randomUUID(), label: "Endereço principal", address: primaryAddress }] : []),
      ...extraAddresses.filter((item) => item.address !== primaryAddress)
    ];
    onSave({ ...draft, address: primaryAddress || addresses[0]?.address || "", addresses, id: initialClient?.id ?? crypto.randomUUID(), createdAt: initialClient?.createdAt ?? new Date().toISOString() });
  }

  function updateAddress(index: number, field: keyof ClientAddress, value: string) {
    updateDraft("addresses", (draft.addresses ?? []).map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-8"><form className="max-h-full w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl" onSubmit={submit}>
    <div className="flex items-start justify-between border-b border-nexus-border pb-4"><div><h2 className="text-xl font-bold text-nexus-ink">{initialClient ? "Dados avançados do cliente" : "Novo cliente"}</h2><p className="mt-1 text-sm text-nexus-muted">Os campos com asterisco são obrigatórios.</p></div><button className="text-sm font-semibold text-nexus-muted hover:text-nexus-ink" type="button" onClick={onCancel}>Cancelar</button></div>
    <div className="mt-5 grid grid-cols-2 gap-4">
      <label className="block text-sm font-medium text-nexus-ink">Tipo de cliente<select className="mt-1 w-full rounded-lg border border-nexus-border bg-white px-3 py-2.5 text-sm outline-none focus:border-nexus-primary focus:ring-2 focus:ring-orange-100" value={draft.type} onChange={(event) => updateDraft("type", event.target.value as ClientType)}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select></label>
      <Field label="Nome ou razão social *" value={draft.name} onChange={(value) => updateDraft("name", value)} placeholder="Digite o nome" />
      <Field label={draft.type === "PF" ? "CPF" : "CNPJ"} value={draft.document} onChange={(value) => updateDraft("document", value)} placeholder={draft.type === "PF" ? "000.000.000-00" : "00.000.000/0000-00"} />
      <Field label="Telefone *" value={draft.phone} onChange={(value) => updateDraft("phone", value)} placeholder="(00) 00000-0000" type="tel" />
      <Field label="E-mail" value={draft.email} onChange={(value) => updateDraft("email", value)} placeholder="cliente@email.com" type="email" />
      <div className="col-span-2"><Field label="Endereço" value={draft.address} onChange={(value) => updateDraft("address", value)} placeholder="Rua, número, bairro e cidade" /></div>
      <div className="col-span-2 rounded-xl border border-nexus-border bg-slate-50 p-4">
        <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-nexus-ink">Outros endereços</h3><p className="text-xs text-nexus-muted">Cadastre casa, trabalho, obras ou outros locais deste cliente.</p></div><button className="rounded-lg border border-nexus-primary px-3 py-1.5 text-xs font-semibold text-nexus-primary" type="button" onClick={() => updateDraft("addresses", [...(draft.addresses ?? []), { id: crypto.randomUUID(), label: "", address: "" }])}>+ Adicionar endereço</button></div>
        {(draft.addresses ?? []).map((item, index) => <div className="mt-3 grid grid-cols-[150px_1fr_28px] gap-2" key={item.id}><input className="rounded-lg border border-nexus-border px-3 py-2 text-sm" placeholder="Ex.: Trabalho" value={item.label} onChange={(event) => updateAddress(index, "label", event.target.value)} /><input className="rounded-lg border border-nexus-border px-3 py-2 text-sm" placeholder="Rua, número, bairro e cidade" value={item.address} onChange={(event) => updateAddress(index, "address", event.target.value)} /><button className="text-lg text-nexus-error" type="button" title="Remover endereço" onClick={() => updateDraft("addresses", (draft.addresses ?? []).filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}
      </div>
      <div className="col-span-2"><Field label="Observações" value={draft.notes} onChange={(value) => updateDraft("notes", value)} placeholder="Informações importantes do cliente" multiline /></div>
    </div>
    {error ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-nexus-error">{error}</p> : null}
    <div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-nexus-border px-4 py-2.5 text-sm font-semibold text-nexus-ink" type="button" onClick={onCancel}>Cancelar</button><button className="rounded-lg bg-nexus-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-nexus-dark" type="submit">{initialClient ? "Salvar alterações" : "Salvar cliente"}</button></div>
  </form></div>;
}
