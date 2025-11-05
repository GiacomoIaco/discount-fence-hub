import { useAuth } from '../../../contexts/AuthContext';
import { useFunctionQuery } from './useLeadershipQuery';
import type { FunctionAccessRole } from '../lib/leadership';

/**
 * Hook to check user permissions for a specific function
 */
export const useLeadershipPermissions = (functionId?: string) => {
  const { user, profile } = useAuth();
  const { data: functionData } = useFunctionQuery(functionId);

  const isAdmin = profile?.role === 'admin';
  const userRole = functionData?.user_access?.role as FunctionAccessRole | undefined;

  const canView = !!userRole || isAdmin;
  const canEdit = userRole === 'admin' || userRole === 'lead' || userRole === 'member' || isAdmin;
  const canCreate = userRole === 'admin' || userRole === 'lead' || isAdmin;
  const canDelete = userRole === 'admin' || userRole === 'lead' || isAdmin;
  const canManageAccess = userRole === 'admin' || userRole === 'lead' || isAdmin;
  const canManageSettings = isAdmin;

  return {
    user,
    profile,
    isAdmin,
    userRole,
    canView,
    canEdit,
    canCreate,
    canDelete,
    canManageAccess,
    canManageSettings,
    hasAccess: canView,
  };
};

/**
 * Hook to check if user can edit a specific initiative
 */
export const useInitiativePermissions = (initiativeOwnerId?: string, functionId?: string) => {
  const { user } = useAuth();
  const { canEdit, canDelete, isAdmin } = useLeadershipPermissions(functionId);

  const isOwner = user?.id === initiativeOwnerId;
  const canEditInitiative = isOwner || canEdit || isAdmin;
  const canDeleteInitiative = canDelete || isAdmin;

  return {
    isOwner,
    canEdit: canEditInitiative,
    canDelete: canDeleteInitiative,
  };
};

/**
 * Hook to check if the current device is desktop
 * Leadership features are desktop-only
 */
export const useIsDesktop = () => {
  // Check if screen width is at least 1024px (Tailwind's lg breakpoint)
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
  return isDesktop;
};
