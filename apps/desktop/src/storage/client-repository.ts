import type { Client } from "../domain/client";

const clientsKey = "@nexus/desktop/clients";

export function listClients(): Client[] {
  const content = window.localStorage.getItem(clientsKey);
  if (!content) return [];

  try {
    return (JSON.parse(content) as Client[]).map((client) => ({ ...client, active: client.active !== false })).sort((first, second) => first.name.localeCompare(second.name));
  } catch {
    return [];
  }
}

export function saveClient(client: Client): Client[] {
  const clients = [...listClients().filter((item) => item.id !== client.id), { ...client, active: client.active !== false }].sort((first, second) => first.name.localeCompare(second.name));
  window.localStorage.setItem(clientsKey, JSON.stringify(clients));
  return clients;
}
