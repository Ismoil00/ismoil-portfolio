import type { SelectorItems, SelectorKind } from "@/types/api";
import { api } from "./client";

const path = (kind: SelectorKind) => `/admin/selectors/${kind}`;

export async function createSelector<K extends SelectorKind>(kind: K, body: object): Promise<SelectorItems[K]> {
  return (await api.post<SelectorItems[K]>(path(kind), body)).data;
}

export async function updateSelector<K extends SelectorKind>(kind: K, id: string, body: object): Promise<SelectorItems[K]> {
  return (await api.put<SelectorItems[K]>(`${path(kind)}/${id}`, body)).data;
}

export async function deleteSelector(kind: SelectorKind, id: string): Promise<void> {
  await api.delete(`${path(kind)}/${id}`);
}

export async function reorderSelector(kind: SelectorKind, ids: string[]): Promise<void> {
  await api.put(`${path(kind)}/order`, { ids });
}
