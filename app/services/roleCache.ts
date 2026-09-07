import { getRoleList } from "~/services/role";
import { requireApiSuccess } from "~/services/http";
import type { Role } from "~/types/api";

let cachedRoles: Role[] | null = null;
let rolesRequest: Promise<Role[]> | null = null;
let cacheGeneration = 0;

export function getCachedRoles(): Promise<Role[]> {
  if (cachedRoles) return Promise.resolve(cachedRoles);
  if (rolesRequest) return rolesRequest;

  const requestGeneration = cacheGeneration;
  const request = getRoleList()
    .then(requireApiSuccess)
    .then(roles => {
      if (requestGeneration === cacheGeneration) cachedRoles = roles;
      return roles;
    })
    .finally(() => {
      if (rolesRequest === request) rolesRequest = null;
    });
  rolesRequest = request;
  return request;
}

export function invalidateRoles(): void {
  cacheGeneration += 1;
  cachedRoles = null;
  rolesRequest = null;
}
