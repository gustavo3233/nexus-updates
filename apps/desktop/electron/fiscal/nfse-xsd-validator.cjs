const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const RESTRICTED_XSD_VERSION = "NFSe-ESQUEMAS_XSD-PRODREST-v1.01-20261020";
const RESTRICTED_XSD_SHA256 = "25fdcecc651a67a216496ab10d7566631e6ed10f721e37d62c7845dadb0ea267";
const OFFICIAL_RESTRICTED_XSD_URL = "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/producao-restrita/esquemas_prod_restrita_20261020.zip";

const validatorProgram = String.raw`
import json, sys
from lxml import etree
xml_path, xsd_path = sys.argv[1], sys.argv[2]
try:
  schema_document = etree.parse(xsd_path)
  schema = etree.XMLSchema(schema_document)
  document = etree.parse(xml_path)
  valid = schema.validate(document)
  print(json.dumps({"valid": valid, "errors": [str(item) for item in schema.error_log]}))
except Exception as error:
  print(json.dumps({"valid": False, "errors": [str(error)]}))
  sys.exit(2)
`;

class XsdValidationError extends Error {
  constructor(code, message, detail) { super(message); this.name = "XsdValidationError"; this.code = code; this.detail = detail; }
}

async function inspectRestrictedPackage(packagePath) {
  if (!packagePath) return { valid: false, status: "pendente", version: RESTRICTED_XSD_VERSION, expectedVersion: RESTRICTED_XSD_VERSION, message: "Pacote XSD oficial de Produção Restrita não instalado." };
  try {
    const buffer = await fs.readFile(packagePath);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const versionOk = path.basename(path.dirname(packagePath)).includes(RESTRICTED_XSD_VERSION) || path.basename(packagePath).includes(RESTRICTED_XSD_VERSION);
    const valid = versionOk && sha256 === RESTRICTED_XSD_SHA256;
    return { valid, status: valid ? "validado" : "inválido", version: RESTRICTED_XSD_VERSION, expectedVersion: RESTRICTED_XSD_VERSION, sha256, sourceUrl: OFFICIAL_RESTRICTED_XSD_URL, message: valid ? "Pacote oficial de Produção Restrita validado por versão e SHA-256." : "Pacote XSD não corresponde à versão ou ao SHA-256 oficial registrado." };
  } catch { return { valid: false, status: "pendente", version: RESTRICTED_XSD_VERSION, expectedVersion: RESTRICTED_XSD_VERSION, message: "Pacote XSD oficial de Produção Restrita não localizado. Nenhum arquivo foi copiado ou alterado." }; }
}

async function validateDpsXml({ xml, packagePath, schemaDirectory }) {
  if (!String(xml || "").trim()) throw new XsdValidationError("EMPTY_XML", "XML da DPS não informado.");
  const packageInfo = await inspectRestrictedPackage(packagePath);
  if (!packageInfo.valid) throw new XsdValidationError("XSD_PACKAGE_INVALID", packageInfo.message, packageInfo);
  const xsdPath = path.join(schemaDirectory, "DPS_v1.01.xsd");
  try { await fs.access(xsdPath); } catch { throw new XsdValidationError("DPS_SCHEMA_MISSING", "O esquema DPS_v1.01.xsd não foi localizado no pacote oficial."); }
  const directory = await fs.mkdtemp(path.join(require("node:os").tmpdir(), "nexus-dps-"));
  const xmlPath = path.join(directory, "dps.xml");
  try {
    await fs.writeFile(xmlPath, xml, "utf8");
    const { stdout } = await execFileAsync("python3", ["-c", validatorProgram, xmlPath, xsdPath], { timeout: 10000, maxBuffer: 1024 * 1024 });
    const result = JSON.parse(stdout || "{}");
    return { valid: result.valid === true, errors: Array.isArray(result.errors) ? result.errors : [], version: packageInfo.version, sha256: packageInfo.sha256 };
  } catch (error) {
    if (error instanceof SyntaxError) throw new XsdValidationError("XSD_VALIDATOR_OUTPUT", "O validador XSD retornou um resultado inválido.");
    const output = error.stdout ? String(error.stdout) : "";
    try { const result = JSON.parse(output); return { valid: false, errors: result.errors || ["Falha de validação XSD."], version: packageInfo.version, sha256: packageInfo.sha256 }; } catch { throw new XsdValidationError("XSD_VALIDATOR_UNAVAILABLE", "Não foi possível executar o validador XSD local. Instale o runtime de validação XML compatível.", String(error.message || error)); }
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
}

module.exports = { RESTRICTED_XSD_VERSION, RESTRICTED_XSD_SHA256, OFFICIAL_RESTRICTED_XSD_URL, XsdValidationError, inspectRestrictedPackage, validateDpsXml };
