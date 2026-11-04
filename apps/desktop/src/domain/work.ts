export type WorkStatus = "Aguardando início" | "Agendada" | "Em execução" | "Pausada" | "Aguardando material" | "Aguardando aprovação do cliente" | "Concluída" | "Cancelada";

export type WorkStatusHistory = { id: string; status: WorkStatus; reason: string; happenedAt: string };
export type WorkDailyLog = { id: string; date: string; activities: string; pendingServices: string; problems: string; materialsNeeded: string; professionalsPresent: string; notes: string; photos: string[]; createdAt: string };

export type Work = {
  id: string;
  number: string;
  clientId: string;
  budgetId: string;
  address: string;
  contractedServices: string;
  contractedValue: number;
  startDate: string;
  expectedCompletionDate: string;
  completedAt: string;
  responsible: string;
  team: string[];
  notes: string;
  status: WorkStatus;
  statusHistory: WorkStatusHistory[];
  dailyLogs: WorkDailyLog[];
  createdAt: string;
  updatedAt: string;
};

export const workStatuses: WorkStatus[] = ["Aguardando início", "Agendada", "Em execução", "Pausada", "Aguardando material", "Aguardando aprovação do cliente", "Concluída", "Cancelada"];

export function createWorkFromBudget(budget: { id: string; clientId: string; title: string; description: string; workAddress: string; totalValue: number; createdAt: string }): Work {
  const createdAt = new Date().toISOString();
  const status: WorkStatus = "Aguardando início";
  return { id: crypto.randomUUID(), number: "OB-" + createdAt.slice(0, 10).replace(/-/g, "") + "-" + crypto.randomUUID().slice(0, 5).toUpperCase(), clientId: budget.clientId, budgetId: budget.id, address: budget.workAddress, contractedServices: budget.description || budget.title, contractedValue: budget.totalValue, startDate: "", expectedCompletionDate: "", completedAt: "", responsible: "", team: [], notes: "", status, statusHistory: [{ id: crypto.randomUUID(), status, reason: "Obra criada a partir do orçamento.", happenedAt: createdAt }], dailyLogs: [], createdAt, updatedAt: createdAt };
}
