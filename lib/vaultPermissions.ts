/**
 * Centralized permission helpers for vault management.
 *
 * Backend authorization is the source of truth; these helpers
 * only gate UI controls so unauthorized options are never shown.
 * The backend enforces the same rules and will reject any request
 * that bypasses the UI.
 */

import type { VaultMember } from "@/lib/types"

export type VaultRole = "owner" | "member"

/**
 * Return the current user's role in a vault, or null if not found.
 */
export function currentMember(
  members: VaultMember[],
  currentUserId: string | null,
): VaultMember | null {
  if (!currentUserId) return null
  return members.find(m => m.user_id === currentUserId) ?? null
}

/** Owner can rename the vault. */
export function canEditVault(role: VaultRole | null): boolean {
  return role === "owner"
}

/** Owner can remove other members. */
export function canManageMembers(role: VaultRole | null): boolean {
  return role === "owner"
}

/**
 * Owner can invite members (invite code is owner-only).
 * Regenerating the code is also owner-only.
 */
export function canInviteMembers(role: VaultRole | null): boolean {
  return role === "owner"
}

/**
 * Role changes are NOT supported by the backend.
 * Roles are fixed at join time (owner stays owner, members stay members).
 */
export function canChangeRoles(_role: VaultRole | null): boolean {
  return false // backend does not support role changes
}

/**
 * Archive is NOT supported by the backend.
 * The Vault model has no is_archived field.
 */
export function canArchiveVault(_role: VaultRole | null): boolean {
  return false // backend does not support archiving
}

/** Owner can delete the vault (requires confirm_name). */
export function canDeleteVault(role: VaultRole | null): boolean {
  return role === "owner"
}

/**
 * Non-owner members can leave. Owners cannot leave — they must delete instead.
 */
export function canLeaveVault(role: VaultRole | null): boolean {
  return role === "member"
}

/**
 * Whether a specific member can be removed by the current user.
 * - Current user must be owner.
 * - Cannot remove yourself (owner cannot remove themselves).
 * - Cannot remove the vault owner.
 */
export function canRemoveMember(
  currentRole: VaultRole | null,
  targetMember: VaultMember,
  currentUserId: string | null,
): boolean {
  if (currentRole !== "owner") return false
  if (targetMember.user_id === currentUserId) return false
  return true  // owners can remove any other member regardless of role
}
