import { jsPDF } from "jspdf";
import type { Client } from "../domain/client";
import type { Financing } from "../domain/financing";
import type { Settings } from "../domain/settings";
import type { Work } from "../domain/work";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function generateFinancingPdf(financing: Financing, client: Client, work: Work, settings: Settings, download = true) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const logo = settings.pdfLogoDataUrl || settings.logoDataUrl;
  const company = settings.companyName || "Empresa";
  if (logo) { try { pdf.addImage(logo, "PNG", 16, 12, Math.max(18, settings.pdfLogoSize * 0.8), 20, undefined, "FAST"); } catch { /* A proposta permanece válida sem imagem compatível. */ } }
  pdf.setTextColor(15, 35, 55); pdf.setFont("helvetica", "bold"); pdf.setFontSize(18); pdf.text("Proposta de financiamento", 16, 43);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(71, 85, 105); pdf.text(company, 16, 49);
  pdf.setDrawColor(226, 232, 240); pdf.line(16, 55, 194, 55);
  const label = (title: string, value: string, x: number, y: number) => { pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text(title.toUpperCase(), x, y); pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.text(value || "Não informado", x, y + 6, { maxWidth: 78 }); };
  label("Cliente", client.name, 16, 66); label("Obra", work.number, 108, 66);
  label("Endereço da obra", work.address, 16, 82); label("Serviço", work.contractedServices || "Não informado", 108, 82);
  const entry = financing.downPaymentAmount || 0;
  const balance = financing.financedAmount ?? Math.max(0, financing.principalAmount - entry);
  pdf.setFillColor(248, 250, 252); pdf.roundedRect(16, 98, 178, 35, 3, 3, "F");
  label("Valor da obra", money.format(financing.principalAmount), 22, 107); label("Entrada", money.format(entry), 70, 107); label("Saldo parcelado", money.format(balance), 118, 107);
  label("Taxa mensal", `${financing.installmentRate.toLocaleString("pt-BR")}%`, 22, 123); label("Total das parcelas", money.format(financing.totalFinanced), 70, 123); label("Total do contrato", money.format(entry + financing.totalFinanced), 118, 123);
  let y = 146;
  const header = () => { pdf.setFillColor(15, 35, 55); pdf.rect(16, y, 178, 9, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text("PARCELA", 20, y + 5.8); pdf.text("VENCIMENTO", 83, y + 5.8); pdf.text("VALOR", 188, y + 5.8, { align: "right" }); y += 9; };
  header();
  for (const installment of financing.installments) {
    if (y > 270) { pdf.addPage(); y = 18; header(); }
    pdf.setDrawColor(226, 232, 240); pdf.line(16, y + 8, 194, y + 8); pdf.setTextColor(15, 23, 42); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
    pdf.text(`${String(installment.number).padStart(2, "0")} de ${financing.installmentsCount}`, 20, y + 5.5);
    pdf.text(new Date(`${installment.dueDate}T12:00:00`).toLocaleDateString("pt-BR"), 83, y + 5.5);
    pdf.text(money.format(installment.amount), 188, y + 5.5, { align: "right" }); y += 8;
  }
  pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text("Tabela informativa de parcelamento. Condições sujeitas à formalização entre as partes.", 16, 286);
  if (download) { pdf.save(`financiamento-${work.number.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`); return ""; }
  return pdf.output("datauristring");
}
