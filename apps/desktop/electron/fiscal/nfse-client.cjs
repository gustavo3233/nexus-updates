const crypto = require("node:crypto");

const NfseEnvironment = Object.freeze({
  restricted: {
    sefinBaseUrl: "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional",
    adnBaseUrl: "https://adn.producaorestrita.nfse.gov.br",
    label: "Produção Restrita"
  },
  production: {
    sefinBaseUrl: "https://sefin.nfse.gov.br/SefinNacional",
    adnBaseUrl: "https://adn.nfse.gov.br",
    label: "Produção"
  }
});

class NfseTechnicalError extends Error {
  constructor(code, message, cause) { super(message); this.name = "NfseTechnicalError"; this.code = code; this.cause = cause; }
}

function assertEnvironment(name) {
  const environment = NfseEnvironment[name];
  if (!environment) throw new NfseTechnicalError("INVALID_ENVIRONMENT", "Ambiente NFS-e inválido.");
  return environment;
}

function cleanDigits(value) { return String(value || "").replace(/\D/g, ""); }

function dpsIdentifier({ municipalityIbgeCode, issuerDocument, series, number }) {
  const document = cleanDigits(issuerDocument);
  if (!/^\d{7}$/.test(String(municipalityIbgeCode)) || !/^\d{11,14}$/.test(document) || !String(series || "").trim() || !Number.isInteger(Number(number)) || Number(number) < 1) throw new NfseTechnicalError("INVALID_DPS_IDENTIFIER", "Identificador de DPS incompleto ou inválido.");
  return { municipalityIbgeCode: String(municipalityIbgeCode), issuerDocument: document, series: String(series), number: Number(number) };
}

class NfseApiClient {
  constructor({ environment, fetchImpl = globalThis.fetch, allowNetwork = false, allowRestrictedTransmission = false, certificateTransport = null, timeoutMs = 20000 }) {
    this.environmentName = environment;
    this.environment = assertEnvironment(environment);
    this.fetch = fetchImpl;
    this.allowNetwork = allowNetwork;
    this.allowRestrictedTransmission = allowRestrictedTransmission;
    this.certificateTransport = certificateTransport;
    this.timeoutMs = timeoutMs;
  }

  async request(path, options = {}) {
    if (this.environmentName === "production") throw new NfseTechnicalError("PRODUCTION_DISABLED", "Endpoints de Produção estão bloqueados nesta fase. Somente diagnósticos locais de Produção Restrita são permitidos.");
    if (!this.allowNetwork) throw new NfseTechnicalError("NETWORK_DISABLED", "Comunicação fiscal desabilitada. A autorização explícita para Produção Restrita é necessária antes de qualquer consulta externa.");
    const method = options.method || "GET";
    if (!["GET", "HEAD", "POST"].includes(method)) throw new NfseTechnicalError("METHOD_NOT_ALLOWED", "Método não autorizado para a integração fiscal.");
    if (method === "POST" && (!this.allowRestrictedTransmission || !this.certificateTransport)) throw new NfseTechnicalError("TRANSMISSION_DISABLED", "Transmissão DPS permanece bloqueada: exige autorização explícita por operação e transporte TLS com certificado A1 disponível no cofre seguro.");
    let response;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try { response = await this.fetch(this.environment.sefinBaseUrl + path, { method, headers: { accept: "application/json, application/xml", ...(options.headers || {}) }, body: options.body, signal: controller.signal, dispatcher: this.certificateTransport }); }
    catch (cause) { throw new NfseTechnicalError("COMMUNICATION_ERROR", "Não foi possível comunicar com a API oficial da NFS-e.", cause); }
    finally { clearTimeout(timeout); }
    const body = await response.text();
    if (!response.ok) throw new NfseTechnicalError("HTTP_" + response.status, "A API oficial retornou " + response.status + ".", { status: response.status, body });
    return { status: response.status, contentType: response.headers.get("content-type") || "", body };
  }

  municipalAgreement(municipalityIbgeCode) { if (!/^\d{7}$/.test(String(municipalityIbgeCode))) throw new NfseTechnicalError("INVALID_MUNICIPALITY", "Código IBGE deve possuir 7 dígitos."); return this.request(`/parametros_municipais/${municipalityIbgeCode}/convenio`); }
  municipalServiceParameters(municipalityIbgeCode, serviceCode) { if (!/^\d{7}$/.test(String(municipalityIbgeCode)) || !String(serviceCode || "").trim()) throw new NfseTechnicalError("INVALID_PARAMETERS", "Informe município e código de serviço."); return this.request(`/parametros_municipais/${municipalityIbgeCode}/${encodeURIComponent(serviceCode)}`); }
  taxpayerRetentions(municipalityIbgeCode, taxpayerDocument) { const document = cleanDigits(taxpayerDocument); if (!/^\d{7}$/.test(String(municipalityIbgeCode)) || !/^\d{11,14}$/.test(document)) throw new NfseTechnicalError("INVALID_PARAMETERS", "Informe município e CPF/CNPJ válidos."); return this.request(`/parametros_municipais/${municipalityIbgeCode}/${document}`); }
  getNfse(accessKey) { if (!String(accessKey || "").trim()) throw new NfseTechnicalError("INVALID_ACCESS_KEY", "Informe a chave de acesso da NFS-e."); return this.request(`/nfse/${encodeURIComponent(accessKey)}`); }
  getDps(officialDpsId) { if (!String(officialDpsId || "").trim()) throw new NfseTechnicalError("OFFICIAL_DPS_ID_REQUIRED", "Informe o identificador DPS no formato oficial definido pelo leiaute vigente."); return this.request(`/dps/${encodeURIComponent(officialDpsId)}`); }
  headDps(officialDpsId) { if (!String(officialDpsId || "").trim()) throw new NfseTechnicalError("OFFICIAL_DPS_ID_REQUIRED", "Informe o identificador DPS no formato oficial definido pelo leiaute vigente."); return this.request(`/dps/${encodeURIComponent(officialDpsId)}`, { method: "HEAD" }); }
  async transmitDps({ signedXml, validation } = {}) {
    if (this.environmentName === "production" || !this.allowRestrictedTransmission || !this.certificateTransport) throw new NfseTechnicalError("TRANSMISSION_DISABLED", "A transmissão de DPS permanece bloqueada até configuração fiscal, credenciamento, certificado A1 no cofre e autorização explícita para Produção Restrita.");
    if (!validation?.valid) throw new NfseTechnicalError("DPS_XSD_INVALID", "A DPS não passou pela validação XSD oficial; transmissão bloqueada.");
    if (!String(signedXml || "").trim()) throw new NfseTechnicalError("SIGNED_DPS_REQUIRED", "A DPS assinada é obrigatória para transmissão.");
    const response = await this.request("/nfse", { method: "POST", headers: { "content-type": "application/xml; charset=utf-8" }, body: signedXml });
    return interpretOfficialResponse(response);
  }
  async registerEvent() { throw new NfseTechnicalError("TRANSMISSION_DISABLED", "Eventos fiscais e cancelamentos estão deliberadamente bloqueados até autorização expressa."); }
}

function interpretOfficialResponse(response) {
  const body = String(response.body || "");
  const xml = /<\s*(?:\w+:)?NFSe\b/i.test(body);
  const rejection = /<\s*(?:\w+:)?(?:erro|rejeicao|rejeição)\b/i.test(body) || /"(?:erro|rejeicao|rejeição)"/i.test(body);
  return { ...response, outcome: xml ? "authorized-document-returned" : rejection ? "rejected" : "inconclusive", authoritative: xml || rejection };
}

function validateDpsData({ record, client }) {
  const issues = [];
  if (!record?.serviceCode) issues.push("Código de serviço pendente.");
  if (!record?.serviceDescription) issues.push("Descrição do serviço pendente.");
  if (!record?.municipalityIbgeCode) issues.push("Código IBGE do município pendente.");
  if (!record?.dpsSeries || !record?.dpsNumber) issues.push("Série ou numeração da DPS pendente.");
  if (!record?.competencyDate) issues.push("Data de competência pendente.");
  if (!(Number(record?.serviceValue) > 0)) issues.push("Valor do serviço inválido.");
  if (!client?.document) issues.push("CPF/CNPJ do tomador pendente.");
  if (!client?.address) issues.push("Endereço do tomador pendente.");
  return issues;
}

function inspectOfficialSchemaPackage({ xml, xsdArchive, expectedSha256, version }) {
  if (!Buffer.isBuffer(xsdArchive) || !expectedSha256 || !version) throw new NfseTechnicalError("OFFICIAL_XSD_REQUIRED", "A validação XSD exige o pacote oficial, versão e checksum verificado.");
  const actualSha256 = crypto.createHash("sha256").update(xsdArchive).digest("hex");
  if (actualSha256 !== expectedSha256) throw new NfseTechnicalError("XSD_CHECKSUM_MISMATCH", "O checksum do pacote XSD não corresponde ao valor verificado.");
  if (!String(xml || "").trim()) throw new NfseTechnicalError("EMPTY_XML", "XML da DPS não informado.");
  return { valid: false, reason: "Validador XML/XSD aguardando a definição do executável homologado e do pacote oficial " + version + ".", version, checksum: actualSha256 };
}

class UnconfiguredCertificateSigner {
  async sign() { throw new NfseTechnicalError("CERTIFICATE_NOT_CONFIGURED", "Assinatura digital indisponível: o certificado A1 deve estar disponível exclusivamente no cofre seguro do sistema operacional. PFX e senha não são aceitos pelo frontend nem pelo SQLite."); }
}

module.exports = { NfseEnvironment, NfseApiClient, NfseTechnicalError, UnconfiguredCertificateSigner, validateDpsData, inspectOfficialSchemaPackage, dpsIdentifier, interpretOfficialResponse };
