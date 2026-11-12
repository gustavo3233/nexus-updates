const { verifyLicenseToken } = require("./licensing.cjs");
const bundledConfig = require("./license-service-config.cjs");

class NexusLicenseClient {
  constructor({ serviceUrl = process.env.NEXUS_LICENSE_SERVICE_URL || bundledConfig.serviceUrl, publicKey = process.env.NEXUS_LICENSE_PUBLIC_KEY || bundledConfig.publicKey, packaged = false } = {}) {
    this.serviceUrl = String(serviceUrl || "").replace(/\/$/, "");
    this.publicKey = publicKey || "";
    this.packaged = packaged;
  }

  configured() {
    return Boolean(this.serviceUrl && this.publicKey);
  }

  async activate({ key, installationId, companyName, companyDocument }) {
    if (!this.serviceUrl) throw new Error("O serviço de licenças ainda não foi configurado. A ativação comercial não está disponível nesta versão.");
    if (!this.publicKey) throw new Error("A chave pública do serviço de licenças ainda não foi configurada nesta versão.");
    if (this.packaged && !this.serviceUrl.startsWith("https://")) throw new Error("O serviço de licenças precisa usar HTTPS.");
    const response = await fetch(`${this.serviceUrl}/v1/activate`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ key: String(key || "").trim(), installationId, companyName, companyDocument })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Não foi possível validar a chave de licença.");
    const license = verifyLicenseToken(payload.token, this.publicKey);
    if (license.installationId !== installationId) throw new Error("A licença retornada não pertence a esta instalação.");
    if (license.status !== "active" || !license.expiresAt || !license.licenseId) throw new Error("A licença retornada pelo servidor está incompleta.");
    return { token: payload.token, license };
  }
}

module.exports = { NexusLicenseClient };
