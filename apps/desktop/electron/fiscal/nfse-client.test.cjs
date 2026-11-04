const assert = require("node:assert/strict");
const test = require("node:test");
const { NfseApiClient, NfseTechnicalError, UnconfiguredCertificateSigner, validateDpsData, inspectOfficialSchemaPackage } = require("./nfse-client.cjs");
const { createHomologationDiagnostics, inspectRestrictedXsdPackage, RESTRICTED_XSD_VERSION } = require("./nfse-diagnostics.cjs");
const { validateDpsXml, RESTRICTED_XSD_SHA256 } = require("./nfse-xsd-validator.cjs");
const path = require("node:path");

test("valida campos obrigatórios de DPS sem construir XML fiscal", () => {
  const issues = validateDpsData({ record: { serviceValue: 0 }, client: {} });
  assert.ok(issues.some((issue) => issue.includes("Código de serviço")));
  assert.ok(issues.some((issue) => issue.includes("tomador")));
});

test("cliente HTTP diferencia ambientes e não acessa rede por padrão", async () => {
  const client = new NfseApiClient({ environment: "restricted", fetchImpl: async () => { throw new Error("não deveria chamar"); } });
  await assert.rejects(client.municipalAgreement("4314902"), (error) => error.code === "NETWORK_DISABLED");
  assert.throws(() => new NfseApiClient({ environment: "outro" }), /Ambiente NFS-e inválido/);
});

test("consultas oficiais usam somente GET ou HEAD quando a rede estiver autorizada", async () => {
  const calls = [];
  const client = new NfseApiClient({ environment: "restricted", allowNetwork: true, fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, headers: { get: () => "application/json" }, text: async () => "{}" }; } });
  await client.municipalAgreement("4314902");
  await client.headDps("identificador-oficial-fornecido-pelo-leiaute");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].options.method, "HEAD");
  assert.match(calls[0].url, /parametros_municipais\/4314902\/convenio$/);
});

test("transmissão, evento e assinatura permanecem bloqueados sem credenciais autorizadas", async () => {
  const client = new NfseApiClient({ environment: "production" });
  await assert.rejects(client.transmitDps(), (error) => error.code === "TRANSMISSION_DISABLED");
  await assert.rejects(client.registerEvent(), (error) => error.code === "TRANSMISSION_DISABLED");
  await assert.rejects(new UnconfiguredCertificateSigner().sign("<DPS/>"), (error) => error.code === "CERTIFICATE_NOT_CONFIGURED");
});

test("validador XSD exige pacote oficial com checksum verificado", () => {
  assert.throws(() => inspectOfficialSchemaPackage({ xml: "<DPS/>", xsdArchive: Buffer.from("x"), expectedSha256: "invalido", version: "oficial" }), (error) => error instanceof NfseTechnicalError && error.code === "XSD_CHECKSUM_MISMATCH");
});

test("produção permanece bloqueada mesmo quando a rede é solicitada", async () => {
  const client = new NfseApiClient({ environment: "production", allowNetwork: true, fetchImpl: async () => { throw new Error("não deve acessar"); } });
  await assert.rejects(client.getNfse("chave"), (error) => error.code === "PRODUCTION_DISABLED");
});

test("diagnóstico de homologação não abre rede e informa XSD e fiscal pendentes", async () => {
  const report = await createHomologationDiagnostics({ fiscalSettings: null });
  assert.equal(report.environment.selected, "Produção Restrita");
  assert.equal(report.environment.networkEnabled, false);
  assert.equal(report.environment.productionBlocked, true);
  assert.equal(report.transmission.allowed, false);
  assert.equal(report.xsd.status, "pendente");
  assert.equal(report.xsd.expectedVersion, RESTRICTED_XSD_VERSION);
  assert.ok(report.fiscal.pending.length > 0);
});

test("inspeção XSD não copia o arquivo e relata pacote ausente", async () => {
  const report = await inspectRestrictedXsdPackage("/caminho/que/nao/existe.zip");
  assert.equal(report.status, "pendente");
  assert.match(report.message, /Nenhum arquivo foi copiado/);
});

test("validação XSD oficial rejeita DPS estruturalmente inválida", async () => {
  const root = "/home/gustavo/.config/@nexus/desktop/nfse/xsd/NFSe-ESQUEMAS_XSD-PRODREST-v1.01-20261020";
  const result = await validateDpsXml({ xml: '<DPS xmlns="http://www.sped.fazenda.gov.br/nfse"/>', packagePath: path.join(root, "package.zip"), schemaDirectory: path.join(root, "schema") });
  assert.equal(result.valid, false);
  assert.equal(result.sha256, RESTRICTED_XSD_SHA256);
  assert.ok(result.errors.length > 0);
});
