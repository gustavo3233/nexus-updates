export type ProductStockMovementType = "Ajuste de estoque" | "Saída manual" | "Saída por orçamento aprovado";

export type ProductStockMovement = {
  id: string;
  type: ProductStockMovementType;
  /** Positivo para entrada, negativo para saída. */
  quantity: number;
  previousQuantity: number;
  resultingQuantity: number;
  happenedAt: string;
  clientId?: string;
  workId?: string;
  budgetId?: string;
  notes?: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  unit: string;
  unitPrice: number;
  /** Foto de identificação do item de estoque. */
  photoDataUrl?: string;
  stockQuantity: number;
  minimumStock: number;
  stockHistory?: ProductStockMovement[];
  active: boolean;
  createdAt: string;
  updatedAt?: string;
};

export const productCategories = ["Materiais", "Ferramentas", "Equipamentos", "Acabamentos", "Segurança", "Outros"] as const;

export const emptyProduct = (): Omit<Product, "id" | "createdAt"> => ({
  name: "",
  category: "Materiais",
  description: "",
  unit: "un",
  unitPrice: 0,
  stockQuantity: 0,
  minimumStock: 0,
  stockHistory: [],
  active: true
});
