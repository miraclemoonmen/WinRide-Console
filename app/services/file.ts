import { http } from "~/services/http";
import type {
  FileRecord,
  FileUploadInput,
  PageResult,
  QueryParams,
  UploadPrepare,
} from "~/types/api";

export async function getFiles(params: QueryParams) {
  return http<PageResult<FileRecord>>(`/files`, {
    method: "GET",
    params,
  });
}

export async function getUploadAuth(
  data: FileUploadInput,
  signal?: AbortSignal,
) {
  return http<UploadPrepare>("/files", {
    method: "POST",
    data,
    signal,
  });
}

export async function confirmUpload(id: string, signal?: AbortSignal) {
  return http<boolean>(`/files/complete/${id}`, {
    method: "POST",
    signal,
  });
}

export async function removeFile(id: string) {
  return http<boolean>(`/files/${id}`, {
    method: "DELETE",
  });
}
