// Roles that may create and edit posts. Must match PUBLISHING_ROLES in the backend
// (app/services/auth_service.py). The backend enforces this too; the UI check only hides what would 403.
export const PUBLISHING_ROLES = ['admin', 'publisher', 'editor', 'support'] as const

export function canPublish(user: any): boolean {
  const role = user?.role_name || user?.role
  return !!role && (PUBLISHING_ROLES as readonly string[]).includes(role)
}

// Roles that may manage datasets on /admin/datasets. Must match DATASET_MANAGER_ROLES
// in the backend (app/services/auth_service.py).
export const DATASET_MANAGER_ROLES = ['admin'] as const

export function canManageDatasets(user: any): boolean {
  const role = user?.role_name || user?.role
  return !!role && (DATASET_MANAGER_ROLES as readonly string[]).includes(role)
}