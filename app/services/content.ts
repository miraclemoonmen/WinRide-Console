import { http } from "~/services/http";
import type { ManagedContent, PageResult } from "~/types/api";

export type ContentType = "posts" | "comments";

export const getManagedContents = (type: ContentType, params: string) =>
  http<PageResult<ManagedContent>>(`/content/${type}`, {
    method: "GET",
    params,
  });

export const getManagedContent = (
  type: ContentType,
  id: string,
  signal?: AbortSignal,
) => http<ManagedContent>(`/content/${type}/${id}`, { signal });

export const deleteManagedContent = (
  type: ContentType,
  id: string,
  reason: string,
) =>
  http<null>(`/content/${type}/${id}/delete`, {
    method: "POST",
    data: { reason },
  });

export const restoreManagedContent = (type: ContentType, id: string) =>
  http<null>(`/content/${type}/${id}/restore`, { method: "POST" });
