import { jsPDF } from "jspdf";
import type { Client } from "../domain/client";
import type { NexusDocument } from "../domain/document";
import type { Settings } from "../domain/settings";

export function generateDocumentPdf(document: NexusDocument, client: Client, settings: Settings) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" }); const logo = settings.pdfLogoDataUrl || settings.logoDataUrl;
  if (logo) { try { pdf.saveGraphicsState(); pdf.setGState(pdf.GState({ opacity: 0.06 })); pdf.addImage(logo, "PNG", 45, 95, 120, 100, undefined, "FAST"); pdf.restoreGraphicsState(); pdf.addImage(logo, "PNG", 15, 10, 24, 20, undefined, "FAST"); } catch { /* Documento continua mesmo com logo inválido. */ } }
  pdf.setFillColor(15, 35, 55); pdf.rect(0, 0, 210, 36, "F"); pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.text(settings.companyName || "Nexus Construção e Reformas", logo ? 45 : 15, 17); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.text(settings.companySubtitle || "CONSTRUÇÃO E REFORMAS", logo ? 45 : 15, 24); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.text(document.type.toUpperCase(), 195, 17, { align: "right" });
  pdf.setTextColor(15, 23, 42); pdf.setFontSize(17); pdf.text(document.title, 15, 52); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(71, 85, 105); pdf.text("Cliente: " + client.name, 15, 61); pdf.text("Documento nº " + document.id.slice(0, 8).toUpperCase() + " · Versão " + document.version, 15, 67); pdf.text("Situação: " + document.signatureStatus, 15, 73);
  pdf.setTextColor(15, 23, 42); pdf.setFontSize(10); const lines = pdf.splitTextToSize(document.content || "Sem conteúdo.", 178); pdf.text(lines, 16, 86); pdf.setDrawColor(148, 163, 184); pdf.line(15, 270, 195, 270); pdf.setFontSize(8); pdf.setTextColor(100, 116, 139); pdf.text("Assinatura do cliente", 55, 278, { align: "center" }); pdf.text("Assinatura da empresa", 155, 278, { align: "center" }); pdf.save("documento-" + document.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".pdf");
}
