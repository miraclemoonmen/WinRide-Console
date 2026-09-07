import { http } from "~/services/http";
import type { PermissionTemplate, Role, RoleMutationInput } from "~/types/api";

export async function getRoleList() {
  return http<Role[]>(`/roles`, {
    method: "GET",
  });
}

export async function addRole(data: RoleMutationInput) {
  return http<boolean>(`/roles`, {
    method: "POST",
    data,
  });
}

export async function getPermissionList(signal?: AbortSignal) {
  return http<PermissionTemplate[]>(`/permissions`, {
    method: "GET",
    signal,
  });
}

export async function getMenuIdsByRoleId(id: number, signal?: AbortSignal) {
  return http<number[]>(`/roles/${id}/permissions`, {
    method: "GET",
    signal,
  });
}

export async function updateRolePermissions(
  data: RoleMutationInput & { id: number },
) {
  return http<boolean>(`/roles/${data.id}`, {
    method: "PUT",
    data,
  });
}

export async function removeRole(id: number) {
  return http<boolean>(`/roles/${id}`, {
    method: "DELETE",
  });
}
