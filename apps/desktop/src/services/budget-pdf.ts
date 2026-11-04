import { jsPDF } from "jspdf";
import type { Budget } from "../domain/budget";
import type { Client } from "../domain/client";
import type { Settings } from "../domain/settings";
import { loadSettings } from "../storage/settings-repository";
import { calculatePricing } from "./pricing";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const left = 15; const right = 195;
const date = (value: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "Não informada";
const plainText = (value: string) => value.replace(/<\s*br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").replace(/\n{3,}/g, "\n\n").trim();
function code(budget: Budget) { if (budget.number) return budget.number; if (budget.id.startsWith("dolibarr-budget-")) return String(budget.id.match(/(\d+)$/)?.[1] || "").slice(-2).padStart(2, "0"); return budget.id.slice(-4).toUpperCase(); }

export function generateBudgetPdf(budget: Budget, client: Client, settings?: Settings, download = true) {
  settings ??= loadSettings();
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pricing = calculatePricing(budget.totalValue, settings, budget.pricingSnapshot);
  const company = [settings.companyName || budget.companyName, settings.showAddress ? settings.address : "", settings.showPhone ? "Telefone: " + settings.phone : "", settings.showEmail ? "E-mail: " + settings.email : "", settings.showWebsite ? "Website: " + settings.website : ""].filter(Boolean);
  const recipient = [client.name, client.document ? "CPF/CNPJ: " + client.document : "", budget.workAddress || client.address].filter(Boolean);

  pdf.setTextColor(12, 24, 52);
  let logoBottom = 38;
  if (settings.pdfLogoDataUrl) {
    const image = pdf.getImageProperties(settings.pdfLogoDataUrl);
    const format = /^data:image\/jpe?g/i.test(settings.pdfLogoDataUrl) ? "JPEG" : /^data:image\/webp/i.test(settings.pdfLogoDataUrl) ? "WEBP" : "PNG";
    const maxWidth = Math.max(settings.pdfLogoSize, 22);
    const maxHeight = Math.max(28, Math.min(settings.pdfLogoSize, 65));
    const aspect = image.width / image.height || 1;
    let width = maxWidth;
    let height = width / aspect;
    if (height > maxHeight) { height = maxHeight; width = height * aspect; }
    const logoY = 10 + (maxHeight - height) / 2;
    pdf.addImage(settings.pdfLogoDataUrl, format, left, logoY, width, height, undefined, "FAST");
    logoBottom = logoY + height;
  }
  else { pdf.setFont("helvetica", "bold"); pdf.setFontSize(22); pdf.text((settings.companyName || "NEXUS").toUpperCase(), left, 24); }
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text("PROPOSTA Nº " + code(budget), right, 18, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text("Data: " + date(budget.issueDate), right, 25, { align: "right" }); pdf.text("Válida até: " + date(budget.validUntil), right, 31, { align: "right" }); pdf.text("Código do cliente: " + client.id.slice(-8).toUpperCase(), right, 37, { align: "right" });
  const separatorY = Math.max(47, logoBottom + 8); const labelsY = separatorY + 8; const boxesY = separatorY + 12; const tableY = boxesY + 49;
  pdf.setDrawColor(203, 213, 225); pdf.line(left, separatorY, right, separatorY); pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("DE", left + 1, labelsY); pdf.text("PARA", 103, labelsY);
  pdf.setFillColor(241, 245, 249); pdf.rect(left, boxesY, 80, 39, "F"); pdf.setDrawColor(148, 163, 184); pdf.rect(98, boxesY, 97, 39); pdf.setFontSize(10);
  company.forEach((value, index) => { pdf.setFont("helvetica", index === 0 ? "bold" : "normal"); pdf.text(value, left + 3, boxesY + 8 + index * 7, { maxWidth: 74 }); });
  recipient.forEach((value, index) => { pdf.setFont("helvetica", index === 0 ? "bold" : "normal"); pdf.text(value, 101, boxesY + 8 + index * 7, { maxWidth: 90 }); });

  const unitX = 125; const quantityX = 153; const totalX = 171;
  let y = tableY; pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text("Valores apresentados em Real (R$)", right, y - 3, { align: "right" });
  pdf.setFillColor(31, 41, 55); pdf.rect(left, y, 180, 8, "F"); pdf.setTextColor(255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.2); pdf.text("DESIGNAÇÃO", left + 2, y + 5.1); pdf.text("PREÇO UNIT.", quantityX - 2, y + 5.1, { align: "right" }); pdf.text("QUANT.", totalX - 2, y + 5.1, { align: "right" }); pdf.text("TOTAL", right - 2, y + 5.1, { align: "right" });
  y += 8; const tableStart = y; pdf.setTextColor(12, 24, 52); pdf.setFont("helvetica", "normal");
  let displayedItemsTotal = 0;
  const paidItems = budget.items.filter((item) => !item.isCourtesy);
  let paidItemIndex = 0;
  if (budget.isCourtesy) {
    const courtesyHeight = 18;
    pdf.setDrawColor(203, 213, 225); pdf.rect(left, y, 180, courtesyHeight);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("CORTESIA", left + 2, y + 7);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.text("Serviço oferecido sem cobrança.", left + 2, y + 13);
    y += courtesyHeight;
  } else budget.items.forEach((item, index) => {
    const description = pdf.splitTextToSize((index + 1) + ". " + plainText(item.description), unitX - left - 4); const height = Math.max(10, description.length * 4.5 + 3);
    const isCourtesy = Boolean(item.isCourtesy);
    const isLastPaidItem = !isCourtesy && paidItemIndex === paidItems.length - 1;
    const baseItemTotal = item.quantity * item.unitPrice;
    const commercialItemTotal = isCourtesy ? 0 : isLastPaidItem ? pricing.chargedValue - displayedItemsTotal : Math.round((pricing.baseValue > 0 ? baseItemTotal / pricing.baseValue * pricing.chargedValue : 0) * 100) / 100;
    const commercialUnitPrice = item.quantity > 0 ? commercialItemTotal / item.quantity : commercialItemTotal;
    if (!isCourtesy) { displayedItemsTotal += commercialItemTotal; paidItemIndex += 1; }
    pdf.setDrawColor(203, 213, 225); pdf.rect(left, y, 180, height); pdf.line(unitX, y, unitX, y + height); pdf.line(quantityX, y, quantityX, y + height); pdf.line(totalX, y, totalX, y + height);
    pdf.setFontSize(8.5); pdf.text(description, left + 2, y + 5, { maxWidth: unitX - left - 4 }); pdf.text(isCourtesy ? "CORTESIA" : money.format(commercialUnitPrice), quantityX - 2, y + 5, { align: "right" }); pdf.text(item.quantity + " " + item.unit, totalX - 2, y + 5, { align: "right" }); pdf.text(isCourtesy ? "CORTESIA" : money.format(commercialItemTotal), right - 2, y + 5, { align: "right" }); y += height;
  });
  if (y < tableStart + 75) { pdf.setDrawColor(203, 213, 225); pdf.rect(left, y, 180, tableStart + 75 - y); y = tableStart + 75; }
  y += 8; pdf.setFontSize(9); pdf.setFont("helvetica", "bold"); pdf.text("CONDIÇÕES", left + 1, y); pdf.setFont("helvetica", "normal"); pdf.text("Forma de pagamento: " + (budget.paymentMethod || "A combinar"), left + 1, y + 7); pdf.text("Prazo de execução: " + (budget.executionPeriod || "A combinar"), left + 1, y + 13);
  pdf.setFillColor(226, 232, 240); pdf.rect(120, y, 75, 10, "F"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text(budget.isCourtesy ? "CORTESIA" : "TOTAL A PAGAR", 122, y + 6.5); pdf.text(budget.isCourtesy ? "SEM COBRANÇA" : money.format(pricing.chargedValue), right - 1, y + 6.5, { align: "right" });
  y += 22; pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.text("Aceite por escrito, carimbo da empresa, data e assinatura.", 120, y); pdf.setDrawColor(203, 213, 225); pdf.rect(120, y + 5, 75, 16); if (budget.observations) { pdf.setFontSize(8); pdf.text("Observações: " + budget.observations, left, y + 7, { maxWidth: 95 }); }
  pdf.setDrawColor(203, 213, 225); pdf.line(left, 287, right, 287); pdf.setFontSize(7); if (settings.showCnpj && settings.cnpj) pdf.text("CNPJ: " + settings.cnpj, 105, 291, { align: "center" }); pdf.text("1 / 1", right, 291, { align: "right" });
  if (download) pdf.save("proposta-" + code(budget) + ".pdf");
  return pdf.output("datauristring");
}
