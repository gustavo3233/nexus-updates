import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Client } from "../domain/client";

const CLIENTS_KEY = "@nexus/clients";

export async function listClients(): Promise<Client[]> {
  const storedClients = await AsyncStorage.getItem(CLIENTS_KEY);
  if (!storedClients) return [];

  const clients = JSON.parse(storedClients) as Client[];
  return clients.sort((first, second) => first.name.localeCompare(second.name));
}

export async function saveClient(client: Client): Promise<Client[]> {
  const clients = await listClients();
  const nextClients = [...clients, client].sort((first, second) =>
    first.name.localeCompare(second.name)
  );

  await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(nextClients));
  return nextClients;
}
