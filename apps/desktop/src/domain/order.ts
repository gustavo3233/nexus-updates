export type OrderType = "Ordem de serviço" | "Ordem de visita";
export type Order = { id: string; clientId: string; type: OrderType; subject: string; workAddress: string; scheduledDate: string; professional: string; description: string; observations: string; createdAt: string };
export type OrderDraft = Omit<Order, "id" | "createdAt">;
export const emptyOrderDraft = (): OrderDraft => ({ clientId: "", type: "Ordem de visita", subject: "", workAddress: "", scheduledDate: "", professional: "", description: "", observations: "" });
export function validateOrder(draft: OrderDraft): string | null { if (!draft.clientId) return "Selecione um cliente."; if (!draft.subject.trim()) return "Informe o assunto do pedido."; if (!draft.workAddress.trim()) return "Informe o endereço."; if (!draft.scheduledDate) return "Informe a data da visita."; if (!draft.professional.trim()) return "Informe o profissional responsável."; if (!draft.description.trim()) return "Descreva o pedido."; return null; }
