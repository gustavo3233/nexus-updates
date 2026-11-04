export type ClientType = "PF" | "PJ";

export type Client = {
  id: string;
  name: string;
  type: ClientType;
  document: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt: string;
};

export type ClientDraft = Omit<Client, "id" | "createdAt">;

export function validateClient(draft: ClientDraft): string | null {
  if (!draft.name.trim()) return "Informe o nome do cliente.";
  if (!draft.phone.trim()) return "Informe um telefone para contato.";
  if (draft.email && !/^\S+@\S+\.\S+$/.test(draft.email)) {
    return "Informe um e-mail válido ou deixe o campo vazio.";
  }

  return null;
}
