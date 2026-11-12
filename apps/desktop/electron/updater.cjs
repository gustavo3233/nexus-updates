const { app } = require("electron");
const { autoUpdater } = require("electron-updater");

// Repositório público exclusivo para binários e manifestos de atualização.
// Não contém código-fonte, bancos SQLite, documentos de clientes ou certificados.
const UPDATE_OWNER = "gustavo3233";
const UPDATE_REPOSITORY = "nexus-updates";
const UPDATE_CHANNEL = "alpha";
const UPDATE_FEED_URL = `https://github.com/${UPDATE_OWNER}/${UPDATE_REPOSITORY}/releases`;
const RELEASE_API_URL = `https://api.github.com/repos/${UPDATE_OWNER}/${UPDATE_REPOSITORY}/releases/tags`;

function initialState() {
  return { status: app.isPackaged ? "idle" : "development", currentVersion: app.getVersion(), availableVersion: null, releaseNotes: [], progress: 0, message: app.isPackaged ? "Pronto para verificar atualizações." : "Atualizações funcionam apenas no aplicativo instalado." };
}

function normalizeReleaseNotes(value) {
  const text = Array.isArray(value) ? value.map((item) => item.note || item).join("\n") : String(value || "");
  return text.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-*+]\s+|#+\s*)/, "").trim()).filter(Boolean).slice(0, 20);
}

class NexusUpdater {
  constructor() {
    this.state = initialState();
    this.ready = false;
  }

  configure() {
    if (this.ready || !app.isPackaged) return;
    this.ready = true;
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    // Versões de pré-lançamento usam o manifesto alpha-linux.yml gerado pelo
    // electron-builder. O canal precisa coincidir com o pacote instalado.
    autoUpdater.setFeedURL({ provider: "github", owner: UPDATE_OWNER, repo: UPDATE_REPOSITORY, private: false, channel: UPDATE_CHANNEL });
    autoUpdater.on("checking-for-update", () => this.setState({ status: "checking", progress: 0, message: "Verificando nova versão..." }));
    autoUpdater.on("update-available", (info) => {
      const releaseNotes = normalizeReleaseNotes(info.releaseNotes);
      this.setState({ status: "available", availableVersion: info.version, releaseNotes, progress: 0, message: `Versão ${info.version} disponível.` });
      void this.loadReleaseNotes(info.version, releaseNotes);
    });
    autoUpdater.on("update-not-available", () => this.setState({ status: "not-available", availableVersion: null, releaseNotes: [], progress: 0, message: "Você já está usando a versão mais recente." }));
    autoUpdater.on("download-progress", (progress) => this.setState({ status: "downloading", progress: Math.round(progress.percent), message: `Baixando atualização: ${Math.round(progress.percent)}%.` }));
    autoUpdater.on("update-downloaded", (info) => this.setState({ status: "downloaded", availableVersion: info.version, progress: 100, message: `Versão ${info.version} pronta para instalar.` }));
    autoUpdater.on("error", (error) => this.setState({ status: "error", progress: 0, message: `Não foi possível consultar atualizações: ${String(error.message || error)}` }));
  }

  setState(next) { this.state = { ...this.state, ...next }; }
  async loadReleaseNotes(version, fallback) {
    try {
      const response = await fetch(`${RELEASE_API_URL}/v${encodeURIComponent(version)}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Nexus-Updater" } });
      if (!response.ok) return;
      const release = await response.json();
      const releaseNotes = normalizeReleaseNotes(release.body);
      if (releaseNotes.length) this.setState({ releaseNotes });
    } catch {
      // A atualização continua disponível mesmo quando as notas não puderem ser consultadas.
      this.setState({ releaseNotes: fallback });
    }
  }
  status() { return { ...this.state, feedUrl: UPDATE_FEED_URL, enabled: app.isPackaged }; }
  async check() { if (!app.isPackaged) return this.status(); this.configure(); await autoUpdater.checkForUpdates(); return this.status(); }
  async download() { if (!app.isPackaged) return this.status(); if (this.state.status !== "available") throw new Error("Nenhuma atualização disponível para download."); await autoUpdater.downloadUpdate(); return this.status(); }
  install() { if (!app.isPackaged) throw new Error("A instalação de atualização só funciona no aplicativo instalado."); if (this.state.status !== "downloaded") throw new Error("A atualização ainda não foi baixada."); autoUpdater.quitAndInstall(false, true); }
}

module.exports = { NexusUpdater, UPDATE_FEED_URL };
