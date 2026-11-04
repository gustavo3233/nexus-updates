export type ClientFileCategory = "nota_fiscal" | "documento" | "planilha";

export type ClientFile = {
  id: string;
  clientId: string;
  category: ClientFileCategory;
  name: string;
  localPath: string;
  createdAt: string;
};

export const fileCategoryLabels: Record<ClientFileCategory, string> = {
  nota_fiscal: "Notas fiscais",
  documento: "Documentos",
  planilha: "Planilhas"
};
