export type ClientType = "PF" | "PJ";

export type ClientAddress = {
  id: string;
  label: string;
  address: string;
  notes?: string;
};

export type Client = {
  id: string;
  name: string;
  type: ClientType;
  document: string;
  phone: string;
  email: string;
  /** Endereço principal legado. Mantido para os registros e PDFs já existentes. */
  address: string;
  /** Endereços disponíveis para obras, visitas e orçamentos. */
  addresses?: ClientAddress[];
  notes: string;
  active: boolean;
  createdAt: string;
};

export type ClientDraft = Omit<Client, "id" | "createdAt">;

export const emptyClientDraft: ClientDraft = {
  name: "",
  type: "PF",
  document: "",
  phone: "",
  email: "",
  address: "",
  addresses: [],
  notes: "",
  active: true
};

export function validateClient(draft: ClientDraft): string | null {
  if (!draft.name.trim()) return "Informe o nome do cliente.";
  if (!draft.phone.trim()) return "Informe um telefone para contato.";
  if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) return "Informe um e-mail válido ou deixe o campo vazio.";

  return null;
}
