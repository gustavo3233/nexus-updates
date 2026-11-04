import type { ClientFile } from "../domain/client-file";

const filesKey = "@nexus/desktop/client-files";

export function listClientFiles(): ClientFile[] {
  const content = window.localStorage.getItem(filesKey);
  if (!content) return [];

  try {
    return (JSON.parse(content) as ClientFile[]).sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  } catch {
    return [];
  }
}

export function saveClientFile(file: ClientFile): ClientFile[] {
  const files = [file, ...listClientFiles()];
  window.localStorage.setItem(filesKey, JSON.stringify(files));
  return files;
}

export function listFilesForClient(clientId: string): ClientFile[] {
  return listClientFiles().filter((file) => file.clientId === clientId);
}
