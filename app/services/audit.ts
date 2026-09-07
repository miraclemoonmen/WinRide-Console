import { http } from "~/services/http";
import type {
  AuditRecord,
  CommentRecord,
  PageResult,
  PostRecord,
} from "~/types/api";

export async function getAuditRecord(params: string) {
  return http<PageResult<AuditRecord>>(`/auditRecord`, {
    method: "GET",
    params,
  });
}

export const getPostAuditDetail = (id: string, signal?: AbortSignal) =>
  http<PostRecord>(`/auditRecord/posts/${id}`, { signal });

export const getCommentAuditDetail = (id: string, signal?: AbortSignal) =>
  http<CommentRecord>(`/auditRecord/comments/${id}`, { signal });

export type AuditDecision = {
  decision: "APPROVE" | "REJECT";
  reasonCode?: string;
  note?: string;
};

export async function decideAudit(auditId: number, decision: AuditDecision) {
  return http<null>(`/auditRecord/${auditId}/decision`, {
    method: "PUT",
    data: decision,
  });
}
