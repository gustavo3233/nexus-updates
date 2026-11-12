const entityPermissions = Object.freeze({
  clients: "clients.manage",
  budgets: "budgets.manage",
  financial_sheets: "finance.manage",
  orders: "budgets.manage",
  client_files: "documents.manage",
  works: "works.manage",
  ledger_entries: "cashflow.manage",
  professionals: "professionals.manage",
  suppliers: "suppliers.manage",
  products: "products.manage",
  tools: "tools.manage",
  documents: "documents.manage"
});

function permissionForEntity(entity) {
  const permission = entityPermissions[entity];
  if (!permission) throw new Error("Entidade sem regra de permissão.");
  return permission;
}

function hasPermission(user, permission) {
  if (!user?.active) return false;
  return user.role === "super_admin" || user.permissions?.includes("*") || user.permissions?.includes(permission);
}

function requirePermission(user, permission) {
  if (!user) throw new Error("Entre no sistema antes de realizar esta operação.");
  if (!hasPermission(user, permission)) throw new Error("Acesso negado: sua conta não possui permissão para alterar esta área.");
  return user;
}

module.exports = { hasPermission, permissionForEntity, requirePermission };
