export type RetentionConfig = {
  issRate: number | null;
  irrfRate: number | null;
  pisRate: number | null;
  cofinsRate: number | null;
  csllRate: number | null;
  inssRate: number | null;
  confirmed: boolean;
  notes: string;
};

export type FiscalSettings = {
  id: "singleton";
  legalName: string;
  cnpj: string;
  municipalRegistration: string;
  taxRegime: string;
  municipalityName: string;
  municipalityIbgeCode: string;
  defaultServiceCode: string;
  defaultServiceDescription: string;
  issRate: number | null;
  retentions: RetentionConfig;
  dpsSeries: string;
  updatedAt: string;
};

export type ServiceCompletion = {
  id: string;
  budgetId: string;
  workId?: string;
  orderId?: string;
  completedOn: string;
  confirmedBy: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type NfseStatus = "Não emitida" | "Aguardando conferência" | "Enviando" | "Autorizada" | "Rejeitada" | "Cancelada" | "Erro de comunicação";

export type NfseRecord = {
  id: string;
  budgetId: string;
  clientId: string;
  workId?: string;
  orderId?: string;
  status: NfseStatus;
  dpsSeries: string;
  dpsNumber: number;
  competencyDate: string;
  serviceCode: string;
  serviceDescription: string;
  municipalityName: string;
  municipalityIbgeCode: string;
  serviceValue: number;
  issRate: number | null;
  fiscalSnapshot: FiscalSettings;
  createdAt: string;
  updatedAt: string;
};

export type NfseAttempt = {
  id: string;
  nfseId: string;
  status: NfseStatus;
  operation: "preparação" | "transmissão" | "consulta" | "cancelamento";
  requestSummary: string;
  responseSummary: string;
  createdAt: string;
};

export const defaultFiscalSettings = (): FiscalSettings => ({
  id: "singleton",
  legalName: "",
  cnpj: "",
  municipalRegistration: "",
  taxRegime: "",
  municipalityName: "Porto Alegre/RS",
  municipalityIbgeCode: "",
  defaultServiceCode: "",
  defaultServiceDescription: "",
  issRate: null,
  retentions: { issRate: null, irrfRate: null, pisRate: null, cofinsRate: null, csllRate: null, inssRate: null, confirmed: false, notes: "" },
  dpsSeries: "",
  updatedAt: ""
});

export function fiscalConfigurationIssues(settings: FiscalSettings | null) {
  if (!settings) return ["Preencha e salve as configurações fiscais."];
  const required: Array<[string, string]> = [
    [settings.legalName, "Razão social"], [settings.cnpj, "CNPJ"], [settings.municipalRegistration, "Inscrição municipal"],
    [settings.taxRegime, "Regime tributário"], [settings.municipalityIbgeCode, "Código IBGE do município"],
    [settings.defaultServiceCode, "Código de serviço"], [settings.defaultServiceDescription, "Descrição padrão do serviço"], [settings.dpsSeries, "Série da DPS"]
  ];
  const issues = required.filter(([value]) => !value.trim()).map(([, label]) => `${label} pendente.`);
  if (settings.issRate === null) issues.push("Alíquota de ISS pendente.");
  if (!settings.retentions.confirmed) issues.push("Confirmação das retenções pendente.");
  return issues;
}
