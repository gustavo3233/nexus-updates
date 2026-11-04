const { RESTRICTED_XSD_VERSION, inspectRestrictedPackage } = require("./nfse-xsd-validator.cjs");

async function inspectRestrictedXsdPackage(packagePath) { return inspectRestrictedPackage(packagePath); }

async function inspectCertificateAvailability(certificateReferences = []) {
  if (!certificateReferences.length) return { status: "pendente", message: "Nenhum certificado A1 registrado para a empresa ativa. Nenhum arquivo ou senha foi solicitado." };
  const configured = certificateReferences.find((reference) => reference.certificateType === "A1");
  if (!configured) return { status: "pendente", message: "Há referências de certificado, mas nenhuma é A1." };
  return { status: "aguardando-cofre", message: "Referência A1 cadastrada; a disponibilidade da chave privada depende do cofre seguro do sistema operacional.", certificateCnpj: configured.certificateCnpj || null, validUntil: configured.validUntil || null };
}

async function createHomologationDiagnostics({ fiscalSettings, xsdPackagePath, certificateReferences = [] } = {}) {
  const xsd = await inspectRestrictedXsdPackage(xsdPackagePath);
  const certificate = await inspectCertificateAvailability(certificateReferences);
  const fiscalMissing = !fiscalSettings ? ["Configurações fiscais não cadastradas."] : [
    [fiscalSettings.legalName, "Razão social"], [fiscalSettings.cnpj, "CNPJ"], [fiscalSettings.municipalRegistration, "Inscrição municipal"], [fiscalSettings.taxRegime, "Regime tributário"], [fiscalSettings.municipalityIbgeCode, "Código IBGE do município"], [fiscalSettings.defaultServiceCode, "Código de serviço"], [fiscalSettings.defaultServiceDescription, "Descrição do serviço"], [fiscalSettings.dpsSeries, "Série DPS"]
  ].filter(([value]) => !String(value || "").trim()).map(([, label]) => label + " pendente.");
  if (fiscalSettings?.issRate === null || fiscalSettings?.issRate === undefined) fiscalMissing.push("Alíquota de ISS pendente.");
  if (!fiscalSettings?.retentions?.confirmed) fiscalMissing.push("Confirmação de retenções pendente.");
  return { environment: { selected: "Produção Restrita", endpoint: "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional", productionBlocked: true, networkEnabled: false, connectivity: "Não executada: rede permanece bloqueada até haver certificado A1 e autorização explícita por operação." }, fiscal: { pending: fiscalMissing, valid: fiscalMissing.length === 0 }, xsd, certificate, transmission: { allowed: false, message: "Transmissão DPS permanece bloqueada: requer certificado A1 disponível no cofre, credenciamento, parâmetros municipais consultados e autorização explícita para uma operação de Produção Restrita." } };
}

module.exports = { RESTRICTED_XSD_VERSION, inspectRestrictedXsdPackage, inspectCertificateAvailability, createHomologationDiagnostics };
