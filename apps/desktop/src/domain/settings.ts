export type HeaderLayout = "row" | "column";

export type Settings = {
  logoDataUrl: string; companyName: string; companySubtitle: string; showHeaderText: boolean; headerLayout: HeaderLayout;
  cnpj: string; website: string; address: string; phone: string; email: string;
  appLogoDataUrl: string; pdfLogoDataUrl: string; appLogoSize: number; pdfLogoSize: number;
  showCnpj: boolean; showWebsite: boolean; showAddress: boolean; showPhone: boolean; showEmail: boolean;
  icmsRate: number; stateRate: number; federalRate: number; companyProfitRate: number; financingInstallmentRate: number;
  financingRateNoEntry: number; financingRatePartialEntry: number; financingRateHalfEntry: number;
};

export const defaultSettings: Settings = {
  logoDataUrl: "", companyName: "Nexus Construção e Reformas", companySubtitle: "CONSTRUÇÃO E REFORMAS", showHeaderText: true, headerLayout: "row",
  cnpj: "", website: "", address: "", phone: "", email: "", appLogoDataUrl: "", pdfLogoDataUrl: "", appLogoSize: 40, pdfLogoSize: 35,
  showCnpj: true, showWebsite: true, showAddress: true, showPhone: false, showEmail: false, icmsRate: 0, stateRate: 0, federalRate: 0, companyProfitRate: 0, financingInstallmentRate: 3,
  financingRateNoEntry: 9, financingRatePartialEntry: 4, financingRateHalfEntry: 3
};
