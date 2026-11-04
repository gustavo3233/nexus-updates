import type { PricingSnapshot } from "../domain/budget";
import type { Settings } from "../domain/settings";

export function calculatePricing(baseValue: number, settings: Settings, snapshot?: PricingSnapshot) {
  const taxRate = snapshot?.applyTaxes === false ? 0 : settings.icmsRate + settings.stateRate + settings.federalRate;
  const taxes = baseValue * taxRate / 100;
  const companyProfit = snapshot?.applyProfit === false ? 0 : baseValue * settings.companyProfitRate / 100;
  return { baseValue, taxRate, taxes, companyProfit, chargedValue: baseValue + taxes + companyProfit };
}
