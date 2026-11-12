import { jsPDF } from "jspdf";
import type { Client } from "../domain/client";
import type { Order } from "../domain/order";
import { loadSettings } from "../storage/settings-repository";

function writeLabelValue(pdf: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text(label.toUpperCase(), x, y);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(15, 23, 42); pdf.text(value || "Não informado", x, y + 6, { maxWidth: width });
}

export function generateOrderPdf(order: Order, client: Client, download = true) {
  const settings = loadSettings(); const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const logo = settings.pdfLogoDataUrl || settings.logoDataUrl;
  if (logo) {
    const watermarkWidth = 130; const watermarkHeight = 105;
    try {
      pdf.saveGraphicsState(); pdf.setGState(pdf.GState({ opacity: 0.07 }));
      pdf.addImage(logo, "PNG", 40, 96, watermarkWidth, watermarkHeight, undefined, "FAST");
      pdf.restoreGraphicsState();
    } catch { /* A ordem continua gerando mesmo se a imagem estiver em formato incompatível. */ }
  }
  pdf.setFillColor(15, 35, 55); pdf.rect(0, 0, 210, 31, "F");
  if (logo) { try { pdf.addImage(logo, "PNG", 15, 7, 22, 18, undefined, "FAST"); } catch { /* fallback textual abaixo */ } }
  pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255); pdf.setFontSize(15); pdf.text(settings.companyName || "Nexus Construção e Reformas", 43, 15);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text(settings.companySubtitle || "CONSTRUÇÃO E REFORMAS", 43, 21);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text(order.type.toUpperCase(), 195, 15, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text("Documento de atendimento", 195, 21, { align: "right" });

  pdf.setFillColor(248, 250, 252); pdf.roundedRect(15, 39, 180, 38, 3, 3, "F");
  pdf.setDrawColor(226, 232, 240); pdf.roundedRect(15, 39, 180, 38, 3, 3, "S");
  writeLabelValue(pdf, "Cliente", client.name, 22, 49, 75);
  writeLabelValue(pdf, "Endereço da obra", order.workAddress, 22, 64, 82);
  writeLabelValue(pdf, "Empresa", settings.companyName || "Nexus Construção e Reformas", 112, 49, 75);
  writeLabelValue(pdf, "Data e profissional", new Date(order.scheduledDate + "T12:00:00").toLocaleDateString("pt-BR") + (order.scheduledTime ? ` às ${order.scheduledTime}` : "") + " · " + order.professional, 112, 64, 75);

  pdf.setFillColor(255, 122, 0); pdf.roundedRect(15, 87, 180, 12, 2, 2, "F");
  pdf.setFont("helvetica", "bold"); pdf.setTextColor(255, 255, 255); pdf.setFontSize(12); pdf.text(order.subject, 21, 95);
  pdf.setTextColor(15, 23, 42); pdf.setFontSize(11); pdf.text("Especificações do pedido", 15, 112);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  const descriptionLines = pdf.splitTextToSize(order.description, 170); pdf.text(descriptionLines, 20, 121);
  let y = 121 + descriptionLines.length * 5 + 12;
  if (order.observations) {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text("Observações", 15, y);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); const notes = pdf.splitTextToSize(order.observations, 170); pdf.text(notes, 20, y + 9); y += notes.length * 5 + 12;
  }
  pdf.setDrawColor(148, 163, 184); pdf.line(15, 276, 195, 276);
  pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text("Assinatura do responsável", 150, 282, { align: "center" });
  pdf.text("Gerado pelo sistema Nexus", 15, 282);
  if (download) pdf.save("pedido-" + order.subject.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".pdf");
  return pdf;
}
