import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import type { Client } from "../domain/client";
import type { Professional, WorkDay } from "../domain/professional";
import { workDayAmount } from "../domain/professional";
import type { Work } from "../domain/work";

type Props = {
  professionals: Professional[];
  workDays: WorkDay[];
  works: Work[];
  clients: Client[];
  onSaveProfessional: (professional: Professional) => void;
  onSaveWorkDay: (day: WorkDay) => Promise<void>;
};

type ProfessionalForm = Pick<Professional, "name" | "role" | "specialty" | "phone" | "document" | "notes"> & { dailyRate: string };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const input = "mt-1 w-full rounded-lg border border-nexus-border px-3 py-2 text-sm";
const today = () => new Date().toISOString().slice(0, 10);
const emptyProfessionalForm: ProfessionalForm = { name: "", role: "", specialty: "", phone: "", document: "", dailyRate: "", notes: "" };

function toForm(professional: Professional): ProfessionalForm {
  return {
    name: professional.name,
    role: professional.role,
    specialty: professional.specialty,
    phone: professional.phone,
    document: professional.document,
    dailyRate: String(professional.dailyRate || ""),
    notes: professional.notes
  };
}

function datePlusOne(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`));
}

function Avatar({ professional, size = "h-11 w-11" }: { professional: Professional; size?: string }) {
  if (professional.photoDataUrl) {
    return <img src={professional.photoDataUrl} alt={`Foto de ${professional.name}`} className={`${size} shrink-0 rounded-full border border-nexus-border object-cover`} />;
  }
  return <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-orange-100 text-base font-bold text-nexus-primary`} aria-label={`Sem foto: ${professional.name}`}>👤</div>;
}

export function ProfessionalsView({ professionals, workDays, works, clients, onSaveProfessional, onSaveWorkDay }: Props) {
  const [creating, setCreating] = useState(false);
  const [daily, setDaily] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<ProfessionalForm>(emptyProfessionalForm);
  const [profileForm, setProfileForm] = useState<ProfessionalForm>(emptyProfessionalForm);
  const [dayForm, setDayForm] = useState({ professionalId: "", workId: "", date: today(), dailyRate: "", overtimeAmount: "", notes: "" });

  const active = professionals.filter((professional) => professional.active !== false);
  const selectedProfessional = professionals.find((professional) => professional.id === dayForm.professionalId);
  const selectedWork = works.find((work) => work.id === dayForm.workId);
  const profile = professionals.find((professional) => professional.id === profileId) ?? null;
  const total = useMemo(() => workDays.reduce((sum, day) => sum + workDayAmount(day), 0), [workDays]);
  const profileDays = useMemo(
    () => profile ? workDays.filter((day) => day.professionalId === profile.id).sort((a, b) => b.date.localeCompare(a.date)) : [],
    [profile, workDays]
  );
  const paymentCycles = useMemo(() => {
    const ascending = [...profileDays].sort((a, b) => a.date.localeCompare(b.date));
    return Array.from({ length: Math.ceil(ascending.length / 5) }, (_, index) => {
      const days = ascending.slice(index * 5, index * 5 + 5);
      const complete = days.length === 5;
      return { days, complete, dueDate: complete ? datePlusOne(days[4].date) : null, amount: days.reduce((sum, day) => sum + workDayAmount(day), 0) };
    });
  }, [profileDays]);

  const openProfile = (professional: Professional) => {
    setProfileId(professional.id);
    setProfileForm(toForm(professional));
    setEditingProfile(false);
    setError("");
  };

  const saveProfessional = () => {
    if (!form.name.trim() || Number(form.dailyRate) < 0) return;
    const createdAt = new Date().toISOString();
    onSaveProfessional({
      id: crypto.randomUUID(), name: form.name.trim(), role: form.role.trim(), specialty: form.specialty.trim(), phone: form.phone.trim(), document: form.document.trim(),
      dailyRate: Number(form.dailyRate) || 0, notes: form.notes.trim(), active: true, createdAt, updatedAt: createdAt
    });
    setForm(emptyProfessionalForm);
    setCreating(false);
  };

  const saveProfile = () => {
    if (!profile || !profileForm.name.trim() || Number(profileForm.dailyRate) < 0) return;
    onSaveProfessional({
      ...profile, name: profileForm.name.trim(), role: profileForm.role.trim(), specialty: profileForm.specialty.trim(), phone: profileForm.phone.trim(),
      document: profileForm.document.trim(), dailyRate: Number(profileForm.dailyRate) || 0, notes: profileForm.notes.trim(), updatedAt: new Date().toISOString()
    });
    setEditingProfile(false);
  };

  const savePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    const reader = new FileReader();
    reader.onload = () => onSaveProfessional({ ...profile, photoDataUrl: String(reader.result), updatedAt: new Date().toISOString() });
    reader.readAsDataURL(file);
  };

  const saveDay = async () => {
    setError("");
    if (!dayForm.professionalId || !dayForm.workId || !dayForm.date || Number(dayForm.dailyRate) < 0) {
      setError("Preencha profissional, obra, data e valor da diária.");
      return;
    }
    if (workDays.some((day) => day.professionalId === dayForm.professionalId && day.workId === dayForm.workId && day.date === dayForm.date)) {
      setError("Já existe uma diária para este profissional nesta obra e data.");
      return;
    }
    try {
      const createdAt = new Date().toISOString();
      await onSaveWorkDay({ id: crypto.randomUUID(), professionalId: dayForm.professionalId, workId: dayForm.workId, date: dayForm.date, dailyRate: Number(dayForm.dailyRate) || 0, overtimeAmount: Number(dayForm.overtimeAmount) || 0, notes: dayForm.notes.trim(), createdAt, updatedAt: createdAt });
      setDayForm({ professionalId: "", workId: "", date: today(), dailyRate: "", overtimeAmount: "", notes: "" });
      setDaily(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a diária.");
    }
  };

  return <>
    <header className="flex items-start justify-between border-b border-nexus-border pb-6">
      <div><p className="text-sm text-nexus-muted">Gestão de equipe</p><h1 className="mt-1 text-3xl font-bold text-nexus-ink">Profissionais e diárias</h1><p className="mt-2 text-sm text-nexus-muted">Cada diária entra automaticamente como gasto de funcionário na planilha financeira da obra.</p></div>
      <div className="flex gap-2"><button className="rounded-lg border border-nexus-border bg-white px-4 py-3 text-sm font-semibold" onClick={() => { setError(""); setDaily(true); }}>+ Lançar diária</button><button className="rounded-lg bg-nexus-primary px-4 py-3 text-sm font-semibold text-white" onClick={() => setCreating(true)}>+ Novo profissional</button></div>
    </header>
    <section className="mt-6 grid grid-cols-3 gap-4"><Card label="Profissionais ativos" value={String(active.length)} /><Card label="Diárias registradas" value={String(workDays.length)} /><Card label="Custo de mão de obra" value={money.format(total)} /></section>
    <section className="mt-6 overflow-hidden rounded-xl border border-nexus-border bg-white">
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_105px_115px_115px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-nexus-muted"><span>Profissional</span><span>Função / especialidade</span><span>Diária</span><span>Situação</span><span className="text-right">Ações</span></div>
      {professionals.length === 0 ? <p className="p-8 text-center text-sm text-nexus-muted">Cadastre o primeiro profissional para começar a registrar diárias.</p> : professionals.map((professional) => <div key={professional.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_105px_115px_115px] items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0">
        <div className="flex min-w-0 items-center gap-3"><Avatar professional={professional} /><div className="min-w-0"><b className="block truncate">{professional.name}</b><span className="block truncate text-xs text-nexus-muted">{professional.phone || professional.document || "Sem contato cadastrado"}</span></div></div>
        <div className="truncate text-nexus-muted">{[professional.role, professional.specialty].filter(Boolean).join(" · ") || "Não informado"}</div><b>{money.format(professional.dailyRate)}</b>
        <button className={"w-fit rounded-full px-2 py-1 text-xs font-semibold " + (professional.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")} onClick={() => onSaveProfessional({ ...professional, active: professional.active === false, updatedAt: new Date().toISOString() })}>{professional.active !== false ? "Ativo" : "Inativo"}</button>
        <button className="justify-self-end rounded-lg border border-nexus-primary px-3 py-2 text-xs font-semibold text-nexus-primary hover:bg-orange-50" onClick={() => openProfile(professional)}>Abrir perfil</button>
      </div>)}
    </section>

    {creating && <Modal title="Novo profissional" onClose={() => setCreating(false)}><ProfessionalFields form={form} setForm={setForm} /><Actions cancel={() => setCreating(false)} confirm={saveProfessional} label="Salvar profissional" /></Modal>}
    {daily && <Modal title="Lançar diária" onClose={() => setDaily(false)}><p className="-mt-3 text-sm text-nexus-muted">O custo será registrado automaticamente na planilha financeira da obra.</p><Field label="Profissional *"><select className={input} value={dayForm.professionalId} onChange={(event) => { const professional = professionals.find((item) => item.id === event.target.value); setDayForm({ ...dayForm, professionalId: event.target.value, dailyRate: professional ? String(professional.dailyRate) : "" }); }}><option value="">Selecione</option>{active.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></Field><Field label="Obra *"><select className={input} value={dayForm.workId} onChange={(event) => setDayForm({ ...dayForm, workId: event.target.value })}><option value="">Selecione</option>{works.filter((work) => work.status !== "Cancelada").map((work) => <option key={work.id} value={work.id}>{work.number} · {clients.find((client) => client.id === work.clientId)?.name || "Cliente"}</option>)}</select></Field><div className="mt-4 grid grid-cols-3 gap-3"><Field label="Data *"><input className={input} type="date" value={dayForm.date} onChange={(event) => setDayForm({ ...dayForm, date: event.target.value })} /></Field><Field label="Diária (R$) *"><input className={input} type="number" min="0" value={dayForm.dailyRate} onChange={(event) => setDayForm({ ...dayForm, dailyRate: event.target.value })} /></Field><Field label="Hora extra (R$)"><input className={input} type="number" min="0" value={dayForm.overtimeAmount} onChange={(event) => setDayForm({ ...dayForm, overtimeAmount: event.target.value })} /></Field></div><Field label="Observações"><textarea className={input + " min-h-16"} value={dayForm.notes} onChange={(event) => setDayForm({ ...dayForm, notes: event.target.value })} /></Field>{selectedProfessional && selectedWork && <p className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-nexus-dark"><b>{selectedProfessional.name}</b> · {selectedWork.number} · custo total: <b>{money.format((Number(dayForm.dailyRate) || 0) + (Number(dayForm.overtimeAmount) || 0))}</b></p>}{error && <p className="mt-3 text-sm text-red-700">{error}</p>}<Actions cancel={() => setDaily(false)} confirm={saveDay} label="Registrar diária" /></Modal>}

    {profile && <Modal title="Perfil do profissional" wide onClose={() => { setProfileId(null); setEditingProfile(false); }}>
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-nexus-border pb-5"><div className="flex items-center gap-4"><Avatar professional={profile} size="h-20 w-20" /><div><h3 className="text-xl font-bold text-nexus-ink">{profile.name}</h3><p className="text-sm text-nexus-muted">{[profile.role, profile.specialty].filter(Boolean).join(" · ") || "Profissional"}</p><label className="mt-2 inline-block cursor-pointer text-xs font-semibold text-nexus-primary underline">Alterar foto<input className="sr-only" type="file" accept="image/*" onChange={savePhoto} /></label></div></div><button className="rounded-lg border border-nexus-primary px-4 py-2 text-sm font-semibold text-nexus-primary" onClick={() => { setProfileForm(toForm(profile)); setEditingProfile((value) => !value); }}>{editingProfile ? "Cancelar edição" : "Editar dados"}</button></div>
      {editingProfile ? <><ProfessionalFields form={profileForm} setForm={setProfileForm} /><Actions cancel={() => { setProfileForm(toForm(profile)); setEditingProfile(false); }} confirm={saveProfile} label="Salvar alterações" /></> : <><section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm"><Info label="Telefone" value={profile.phone} /><Info label="CPF/CNPJ" value={profile.document} /><Info label="Diária base" value={money.format(profile.dailyRate)} /><Info label="Situação" value={profile.active !== false ? "Ativo" : "Inativo"} /><div className="col-span-2"><Info label="Observações" value={profile.notes} /></div></section><section className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4"><h3 className="font-bold text-nexus-ink">Diárias a pagar</h3><p className="mt-1 text-xs text-nexus-muted">Cada ciclo reúne 5 diárias; o vencimento é no dia seguinte à 5ª diária registrada.</p><div className="mt-3 space-y-2">{paymentCycles.length === 0 ? <p className="text-sm text-nexus-muted">Nenhuma diária registrada para este profissional.</p> : paymentCycles.map((cycle, index) => <div key={index} className="flex items-center justify-between rounded-lg bg-white px-3 py-3 text-sm"><div><b>Ciclo {index + 1} · {cycle.days.length}/5 diárias</b><p className="text-xs text-nexus-muted">{cycle.complete && cycle.dueDate ? `Vencimento: ${displayDate(cycle.dueDate)}` : `Faltam ${5 - cycle.days.length} diária(s) para fechar o ciclo`}</p></div><div className="text-right"><b>{money.format(cycle.amount)}</b>{cycle.complete && cycle.dueDate && <p className={"text-xs font-semibold " + (cycle.dueDate < today() ? "text-red-600" : "text-emerald-700")}>{cycle.dueDate < today() ? "Vencido" : "A vencer"}</p>}</div></div>)}</div></section><section className="mt-6"><h3 className="font-bold text-nexus-ink">Histórico de diárias</h3><div className="mt-3 overflow-hidden rounded-xl border border-nexus-border">{profileDays.length === 0 ? <p className="p-4 text-sm text-nexus-muted">Sem diárias lançadas.</p> : profileDays.map((day) => <div key={day.id} className="flex items-center justify-between gap-4 border-b px-4 py-3 text-sm last:border-b-0"><div><b>{displayDate(day.date)}</b><p className="text-xs text-nexus-muted">{works.find((work) => work.id === day.workId)?.number || "Obra não encontrada"}{day.notes ? ` · ${day.notes}` : ""}</p></div><b>{money.format(workDayAmount(day))}</b></div>)}</div></section></>}
    </Modal>}
  </>;
}

function ProfessionalFields({ form, setForm }: { form: ProfessionalForm; setForm: (form: ProfessionalForm) => void }) {
  return <><div className="mt-5 grid grid-cols-2 gap-4"><Field label="Nome completo *"><input className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Função"><input className={input} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="Ex.: pedreiro" /></Field><Field label="Especialidade"><input className={input} value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} /></Field><Field label="Diária (R$) *"><input className={input} type="number" min="0" value={form.dailyRate} onChange={(event) => setForm({ ...form, dailyRate: event.target.value })} /></Field><Field label="Telefone"><input className={input} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field><Field label="CPF/CNPJ"><input className={input} value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} /></Field></div><Field label="Observações"><textarea className={input + " min-h-20"} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></>;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-6"><section className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white p-6 ${wide ? "max-w-3xl" : "max-w-2xl"}`}><div className="mb-1 flex items-center justify-between gap-4"><h2 className="text-xl font-bold">{title}</h2><button className="text-sm text-nexus-muted" onClick={onClose}>Fechar</button></div>{children}</section></div>; }
function Card({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-nexus-border bg-white p-4"><p className="text-xs uppercase text-nexus-muted">{label}</p><b className="mt-1 block text-xl text-nexus-ink">{value}</b></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="mt-4 block text-sm">{label}{children}</label>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase text-nexus-muted">{label}</p><p className="mt-1 text-sm text-nexus-ink">{value || "Não informado"}</p></div>; }
function Actions({ cancel, confirm, label }: { cancel: () => void; confirm: () => void; label: string }) { return <div className="mt-6 flex justify-end gap-3"><button className="px-3 py-2 text-sm" onClick={cancel}>Cancelar</button><button className="rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white" onClick={confirm}>{label}</button></div>; }
