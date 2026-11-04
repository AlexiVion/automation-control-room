export type Permission =
  | "demo.read" | "demo.edit" | "demo.publish" | "demo.start"
  | "demo.approve" | "operator.workflows" | "operator.ai.live"
  | "operator.http.execute" | "operator.credentials.read" | "operator.admin";
export type Principal =
  | { kind: "guest"; sessionId: string; workspaceId: string; authenticatedAtMs: number; expiresAtMs: number }
  | { kind: "operator"; userId: string; workspaceId: string; grants: ReadonlySet<Permission> };
export type ResourceRef = { workspaceId: string; kind: "workflow" | "execution" | "approval" | "crm" | "credential" | "event" };

const GUEST_GRANTS: ReadonlySet<Permission> = new Set([
  "demo.read", "demo.edit", "demo.publish", "demo.start", "demo.approve"
]);
export function canAccess(
  principal: Principal, resource: ResourceRef, permission: Permission, nowMs: number
): boolean {
  // Workspace resource IDs must be obtained with workspace-scoped SQL queries first.
  if (!principal.workspaceId || !resource.workspaceId || principal.workspaceId !== resource.workspaceId) return false;
  if (principal.kind === "guest") {
    if (nowMs < principal.authenticatedAtMs || nowMs >= principal.expiresAtMs) return false;
    if (resource.kind === "credential") return false;
    return GUEST_GRANTS.has(permission);
  }
  if (resource.kind === "credential" && permission !== "operator.credentials.read" &&
      permission !== "operator.admin") return false;
  return principal.grants.has(permission);
}
export function requireAccess(principal: Principal, resource: ResourceRef, permission: Permission, nowMs: number): void {
  if (!canAccess(principal, resource, permission, nowMs)) throw new Error("FORBIDDEN");
}
/** Workspace comes from verified session/principal, never from request body or model output. */
export function workspaceFilter(principal: Principal): { workspaceId: string } {
  if (!principal.workspaceId) throw new Error("UNAUTHENTICATED");
  return { workspaceId: principal.workspaceId };
}
