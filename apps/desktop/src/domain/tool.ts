export type ToolStatus = "No depósito" | "Em uso" | "Extraviada" | "Danificada" | "Em manutenção";
export type ToolCondition = "Nova" | "Usada" | "Necessita avaliação";

export type ToolAssignment = {
  id: string;
  /** Pode ser alguém cadastrado ou um responsável informado apenas neste lançamento. */
  professionalId?: string;
  professionalName: string;
  workId?: string;
  assignedAt: string;
  expectedReturnDate: string;
  notes: string;
  /** Registro visual da condição na retirada. */
  outboundPhotoDataUrl?: string;
  returnedAt?: string;
  returnNotes?: string;
  /** Registro visual da condição na devolução. */
  returnPhotoDataUrl?: string;
};

export type Tool = {
  id: string;
  name: string;
  value: number;
  condition: ToolCondition;
  status: ToolStatus;
  description: string;
  active: boolean;
  /** Foto de identificação da ferramenta enquanto está no depósito. */
  photoDataUrl?: string;
  assignment?: ToolAssignment;
  /** Empréstimos já encerrados, preservados para consulta do responsável. */
  assignmentHistory?: ToolAssignment[];
  createdAt: string;
  updatedAt?: string;
};

export const toolStatuses: ToolStatus[] = ["No depósito", "Em uso", "Extraviada", "Danificada", "Em manutenção"];
export const toolConditions: ToolCondition[] = ["Nova", "Usada", "Necessita avaliação"];

export function toolIsOverdue(tool: Tool, today = new Date().toISOString().slice(0, 10)) {
  return tool.status === "Em uso" && Boolean(tool.assignment?.expectedReturnDate) && tool.assignment!.expectedReturnDate < today;
}

export function emptyTool(): Omit<Tool, "id" | "createdAt"> {
  return { name: "", value: 0, condition: "Nova", status: "No depósito", description: "", active: true };
}
