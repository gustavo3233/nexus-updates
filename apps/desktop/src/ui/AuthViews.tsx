import { FormEvent, useEffect, useState, type CSSProperties } from "react";
import { defaultSettings, type Settings } from "../domain/settings";

type UserRole = "super_admin" | "admin" | "financeiro" | "operacional" | "visualizador";
type User = { id: string; username: string; displayName: string; role: UserRole; permissions: string[]; active: boolean };
type LicenseStatus = { state: string; active: boolean; message: string; expiresAt?: string; remainingDays?: number; planCode?: string | null };
const input = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-nexus-primary";

type LogoTone = "light" | "dark" | "mixed";

function LoginLogo({ source, alt, size, sidebarColor }: { source: string; alt: string; size: number; sidebarColor: string }) {
  const [tone, setTone] = useState<LogoTone>("light");
  useEffect(() => {
    let disposed = false;
    const image = new Image();
    image.src = source;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maximum = 96;
      const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let brightness = 0;
      let opacity = 0;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3] / 255;
        if (alpha < 0.08) continue;
        brightness += ((data[index] * 0.2126) + (data[index + 1] * 0.7152) + (data[index + 2] * 0.0722)) * alpha;
        opacity += alpha;
      }
      if (!disposed && opacity) {
        const average = brightness / opacity;
        setTone(average >= 185 ? "light" : average <= 95 ? "dark" : "mixed");
      }
    };
    return () => { disposed = true; };
  }, [source]);

  const sidebarIsLight = /^#[0-9a-f]{6}$/i.test(sidebarColor) && Number.parseInt(sidebarColor.slice(1, 3), 16) * 0.2126 + Number.parseInt(sidebarColor.slice(3, 5), 16) * 0.7152 + Number.parseInt(sidebarColor.slice(5, 7), 16) * 0.0722 > 150;
  const surface = tone === "light" ? (sidebarIsLight ? "#111827" : sidebarColor) : "#FFFFFF";
  return <div style={{ width: size + 24, height: size + 24, backgroundColor: surface }} className="flex items-center justify-center rounded-xl p-2 shadow-sm"><img src={source} alt={alt} style={{ width: size, height: size }} className="object-contain" /></div>;
}

export function LoginView({ onLogin, settings, license, onActivateLicense }: { onLogin: (username: string, password: string) => Promise<void>; settings: Settings; license: LicenseStatus; onActivateLicense: (key: string) => Promise<LicenseStatus> }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [activationKey, setActivationKey] = useState(""); const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  const logo = settings.appLogoDataUrl || settings.logoDataUrl;
  const companyName = settings.companyName.trim() || "Nexus Construção e Reformas";
  // Mantém a mesma fonte de cores do aplicativo: configurações persistidas
  // somente entram em vigor quando o tema personalizado está ativo.
  const activeTheme = settings.customThemeEnabled ? settings : defaultSettings;
  const themeStyle = settings.customThemeEnabled ? {
    "--nexus-brand-primary": activeTheme.themeButtonColor,
    "--nexus-brand-sidebar": activeTheme.themeSidebarColor,
    "--nexus-brand-text": activeTheme.themeTextColor
  } as CSSProperties : undefined;
  const logoSize = Math.min(76, Math.max(48, settings.appLogoSize || 48));
  const submit = async (event: FormEvent) => { event.preventDefault(); try { setLoading(true); setError(""); await onLogin(username, password); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível entrar."); setLoading(false); } };
  const activate = async () => { try { setLoading(true); setError(""); const result = await onActivateLicense(activationKey); setMessage(result.message); setActivationKey(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível ativar a chave."); } finally { setLoading(false); } };
  return <main style={themeStyle} className={(settings.customThemeEnabled ? "theme-custom " : "") + "flex min-h-screen items-center justify-center bg-nexus-ink p-6"}>
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
      <div className="flex justify-center">
        {logo ? <LoginLogo source={logo} alt={"Logo de " + companyName} size={logoSize} sidebarColor={activeTheme.themeSidebarColor} /> : <div style={{ width: logoSize, height: logoSize }} className="flex items-center justify-center rounded-xl bg-nexus-primary text-xl font-bold text-white">N</div>}
      </div>
      <h1 className="mt-8 text-2xl font-bold text-nexus-ink">Entrar</h1>
      <p className="mt-2 text-sm text-nexus-muted">Informe suas credenciais para acessar os dados da empresa.</p>
      <div className={(license.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-orange-200 bg-orange-50 text-orange-800") + " mt-5 rounded-xl border p-3 text-sm"}><b>{license.active ? "Acesso liberado" : "Ativação necessária"}</b><p className="mt-1 text-xs leading-5">{license.message}</p>{license.expiresAt && <p className="mt-1 text-xs">Válida até: {new Date(license.expiresAt).toLocaleDateString("pt-BR")}</p>}</div>
      {!license.active && <section className="mt-4 rounded-xl border border-slate-200 p-4"><b className="text-sm text-nexus-ink">Ativar chave de acesso</b><p className="mt-1 text-xs leading-5 text-nexus-muted">Após a compra, cole aqui a chave recebida. Nenhuma chave é salva em texto aberto no computador.</p><div className="mt-3 flex gap-2"><input className={input + " mt-0"} value={activationKey} onChange={(event) => setActivationKey(event.target.value)} placeholder="NXS-XXXX-XXXX-XXXX" autoComplete="off"/><button type="button" disabled={loading || !activationKey.trim()} onClick={() => void activate()} className="shrink-0 rounded-lg bg-nexus-primary px-3 text-sm font-semibold text-white disabled:opacity-50">Ativar</button></div></section>}
      <label className="mt-6 block text-sm font-medium text-nexus-ink">Usuário<input autoFocus className={input} value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
      <label className="mt-4 block text-sm font-medium text-nexus-ink">Senha<input className={input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
      <button disabled={loading || !license.active} className="mt-6 w-full rounded-lg bg-nexus-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Entrando..." : license.active ? "Entrar" : "Ative uma chave para entrar"}</button>
    </form>
  </main>;
}

export function AdminSetupView({ onSave }: { onSave: (name: string, username: string, password: string) => Promise<void> }) {
  const [name, setName] = useState(""); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (password !== confirm) return setError("As senhas não coincidem."); try { setLoading(true); setError(""); await onSave(name, username, password); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível criar o administrador."); setLoading(false); } };
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6"><form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"><p className="text-sm font-semibold text-nexus-primary">Proteção da instalação</p><h1 className="mt-2 text-2xl font-bold text-nexus-ink">Crie o administrador principal</h1><p className="mt-2 text-sm leading-6 text-nexus-muted">Como esta instalação já possui uma empresa cadastrada, crie agora o usuário que terá acesso total. A senha é gravada somente como hash criptográfico.</p><label className="mt-6 block text-sm font-medium">Nome exibido<input className={input} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: João Silva" /></label><label className="mt-4 block text-sm font-medium">Nome de usuário *<input className={input} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="ex.: joao.silva" autoComplete="username" /></label><label className="mt-4 block text-sm font-medium">Senha *<input className={input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label className="mt-4 block text-sm font-medium">Confirmar senha *<input className={input} type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" /></label>{error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="mt-6 w-full rounded-lg bg-nexus-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Criando..." : "Criar administrador"}</button></form></main>;
}

export function AccountPanel({ user, onLogout, onUpdate }: { user: User; onLogout: () => Promise<void>; onUpdate: (details: { displayName: string; username: string; password?: string }) => Promise<void> }) {
  const [displayName, setDisplayName] = useState(user.displayName); const [username, setUsername] = useState(user.username); const [password, setPassword] = useState(""); const [message, setMessage] = useState("");
  const save = async () => { try { await onUpdate({ displayName, username, ...(password ? { password } : {}) }); setPassword(""); setMessage("Dados da conta atualizados."); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível atualizar a conta."); } };
  return <section className="mt-6 rounded-xl border bg-white p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Conta e acesso</h2><p className="mt-1 text-sm text-nexus-muted">Administrador principal: {user.displayName || user.username}</p></div><button onClick={() => void onLogout()} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700">Sair do sistema</button></div><div className="mt-4 grid grid-cols-3 gap-3"><label className="text-sm">Nome exibido<input className={input} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label className="text-sm">Usuário<input className={input} value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className="text-sm">Nova senha<input className={input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Deixe vazio para manter" /></label></div>{message && <p className="mt-3 text-sm text-nexus-muted">{message}</p>}<button onClick={() => void save()} className="mt-4 rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white">Salvar conta</button></section>;
}

const permissions = [
  ["dashboard.view", "Dashboard"], ["clients.manage", "Clientes"], ["budgets.manage", "Orçamentos"], ["works.manage", "Obras"], ["professionals.manage", "Profissionais"], ["suppliers.manage", "Fornecedores"], ["products.manage", "Produtos"], ["documents.manage", "Documentos"], ["finance.manage", "Financeiro"], ["cashflow.manage", "Fluxo de caixa"], ["financing.manage", "Financiamento"], ["settings.manage", "Configurações"]
] as const;
const roleNames: Record<Exclude<UserRole, "super_admin">, string> = { admin: "Administrador", financeiro: "Financeiro", operacional: "Operacional", visualizador: "Visualizador" };

export function UsersPermissionsPanel({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]); const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<User | null>(null); const [message, setMessage] = useState("");
  const [form, setForm] = useState({ displayName: "", username: "", password: "", role: "visualizador" as Exclude<UserRole, "super_admin">, permissions: [] as string[], active: true });
  const refresh = async () => { try { const records = await window.nexusAuth?.users(); setUsers(records ?? []); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível carregar usuários."); } };
  useEffect(() => { void refresh(); }, []);
  const openNew = () => { setForm({ displayName: "", username: "", password: "", role: "visualizador", permissions: [], active: true }); setEditing(null); setCreating(true); setMessage(""); };
  const edit = (user: User) => { setForm({ displayName: user.displayName, username: user.username, password: "", role: user.role === "super_admin" ? "admin" : user.role, permissions: user.permissions.filter((permission) => permission !== "*"), active: user.active }); setEditing(user); setCreating(true); setMessage(""); };
  const togglePermission = (permission: string) => setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }));
  const save = async (event: FormEvent) => { event.preventDefault(); try { setMessage(""); if (editing) await window.nexusAuth?.updateUser(editing.id, { ...form, ...(form.password ? { password: form.password } : {}) }); else await window.nexusAuth?.createUser(form); setCreating(false); setEditing(null); await refresh(); setMessage(editing ? "Usuário atualizado." : "Usuário cadastrado."); } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Não foi possível salvar o usuário."); } };
  if (currentUser.role !== "super_admin") return <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Somente o administrador principal pode cadastrar usuários e definir permissões.</div>;
  return <div className="mt-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">Usuários e permissões</h3><p className="mt-1 text-sm text-nexus-muted">Cadastre acessos desta empresa e escolha quais áreas cada pessoa pode utilizar.</p></div><button type="button" onClick={openNew} className="shrink-0 rounded-lg bg-nexus-primary px-3 py-2 text-sm font-semibold text-white">+ Novo usuário</button></div>{message && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-nexus-muted">{message}</p>}<div className="mt-4 divide-y rounded-lg border">{users.map((user) => <div key={user.id} className="flex items-center justify-between gap-3 p-3"><div><b className="block text-sm">{user.displayName || user.username}</b><span className="text-xs text-nexus-muted">@{user.username} • {user.role === "super_admin" ? "Administrador principal" : roleNames[user.role]} • {user.active ? "Ativo" : "Inativo"}</span></div>{user.role === "super_admin" ? <span className="text-xs font-semibold text-nexus-muted">Conta principal</span> : <button type="button" onClick={() => edit(user)} className="rounded border px-3 py-1.5 text-xs font-semibold">Editar</button>}</div>)}</div>{creating && <form onSubmit={save} className="mt-5 rounded-xl border bg-slate-50 p-4"><div className="flex items-center justify-between"><h4 className="font-semibold">{editing ? "Editar usuário" : "Novo usuário"}</h4><button type="button" onClick={() => setCreating(false)} className="text-sm text-nexus-muted">Cancelar</button></div><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-sm">Nome exibido<input required className={input} value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label className="text-sm">Nome de usuário<input required className={input} value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label><label className="text-sm">{editing ? "Nova senha (opcional)" : "Senha"}<input required={!editing} className={input} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label className="text-sm">Perfil<select className={input} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Exclude<UserRole, "super_admin"> })}>{Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Usuário ativo</label><fieldset className="mt-4"><legend className="text-sm font-semibold">Acessos permitidos</legend><div className="mt-2 grid grid-cols-2 gap-2">{permissions.map(([permission, label]) => <label key={permission} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />{label}</label>)}</div></fieldset><button className="mt-5 rounded-lg bg-nexus-primary px-4 py-2 text-sm font-semibold text-white">{editing ? "Salvar alterações" : "Cadastrar usuário"}</button></form>}</div>;
}
