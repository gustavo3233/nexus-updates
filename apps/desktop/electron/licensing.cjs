const crypto = require("node:crypto");

const DAY = 24 * 60 * 60 * 1000;

function timestamp(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function publicLicenseState(state) {
  if (!state) return { state: "missing", active: false, message: "O período de teste ainda não foi iniciado." };
  const { token: _token, nextState: _nextState, ...safe } = state;
  return safe;
}

function evaluateLicenseState(state, { at = new Date().toISOString(), toleranceMinutes = 5 } = {}) {
  if (!state) return { state: "missing", active: false, message: "O período de teste ainda não foi iniciado." };
  const current = timestamp(at);
  const lastChecked = timestamp(state.lastCheckedAt);
  const expiresAt = timestamp(state.expiresAt);
  const tolerance = Number(toleranceMinutes) * 60 * 1000;
  if (current === null || lastChecked === null || expiresAt === null) return { state: "invalid", active: false, message: "Os dados locais de licença são inválidos." };
  if (current + tolerance < lastChecked) return { state: "clock_suspicious", active: false, message: "A data do computador foi alterada. Conecte-se para validar sua licença." };
  if (current >= expiresAt) return { state: "expired", active: false, message: state.type === "trial" ? "O período de teste de 7 dias terminou. Ative uma chave para continuar." : "A licença expirou. Renove a assinatura para continuar.", expiresAt: state.expiresAt, planCode: state.planCode || null };
  const remainingDays = Math.max(1, Math.ceil((expiresAt - current) / DAY));
  return {
    state: state.type === "trial" ? "trial_active" : "licensed",
    active: true,
    message: state.type === "trial" ? `Teste gratuito ativo: ${remainingDays} dia(s) restante(s).` : "Licença ativa.",
    expiresAt: state.expiresAt,
    planCode: state.planCode || null,
    remainingDays,
    nextState: { ...state, lastCheckedAt: new Date(current).toISOString() }
  };
}

function decode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function verifyLicenseToken(token, publicKeyPem) {
  const [header, body, signature, ...extra] = String(token || "").split(".");
  if (!header || !body || !signature || extra.length) throw new Error("A chave retornada pelo servidor possui um formato inválido.");
  let parsedHeader;
  let payload;
  try {
    parsedHeader = JSON.parse(decode(header));
    payload = JSON.parse(decode(body));
  } catch {
    throw new Error("A chave retornada pelo servidor não pôde ser lida.");
  }
  if (parsedHeader.alg !== "EdDSA" || parsedHeader.typ !== "NEXUS-LICENSE" || parsedHeader.v !== 1) throw new Error("O formato da licença não é suportado.");
  const key = String(publicKeyPem || "").replace(/\\n/g, "\n").trim();
  if (!key) throw new Error("A chave pública do serviço de licenças ainda não foi configurada nesta versão do aplicativo.");
  const valid = crypto.verify(null, Buffer.from(`${header}.${body}`), crypto.createPublicKey(key), Buffer.from(signature, "base64url"));
  if (!valid) throw new Error("A assinatura da licença não é válida.");
  return payload;
}

module.exports = { evaluateLicenseState, publicLicenseState, verifyLicenseToken };
