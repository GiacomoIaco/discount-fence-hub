import { useAuth } from '../../../contexts/AuthContext';
import { useUserFunctionAccess } from './useLeadershipQuery';

/**
 * Hook to check user permissions for Leadership Hub and My Todos
 * Based on the new Function-based access model:
 * - Super Admin: Full access everywhere
 * - Function Owner: Leadership Hub view all, edit own functions; My Todos Team View for owned functions
 * - Function Member: No Leadership Hub access; My Todos Team View for member functions
 * - Regular User: No Leadership Hub; My Todos personal tasks only
 */
export const useLeadershipPermissions = (functionId?: string) => {
  const { user, profile } = useAuth();
  const { data: access, isLoading: accessLoading } = useUserFunctionAccess();

  const isSuperAdmin = profile?.is_super_admin === true;

  // Check if user owns or is member of the specific function
  const isOwnerOfFunction = functionId
    ? (access?.ownedFunctions.some(f => f.id === functionId) || false)
    : false;
  const isMemberOfFunction = functionId
    ? (access?.memberFunctions.some(f => f.id === functionId) || false)
    : false;
  const hasFunctionAccess = isOwnerOfFunction || isMemberOfFunction;

  // ============================================
  // LEADERSHIP HUB PERMISSIONS
  // ============================================

  // Can access Leadership Hub at all (sidebar shows up)
  const canAccessLeadershipHub = isSuperAdmin || (access?.ownedFunctions.length || 0) > 0;

  // Can view all functions in Leadership Hub (read-only for non-owned)
  const canViewAllFunctions = isSuperAdmin || (access?.ownedFunctions.length || 0) > 0;

  // Can edit the specific function (create initiatives, add actions/targets, etc.)
  const canEditFunction = isSuperAdmin || isOwnerOfFunction;

  // Can perform CEO scoring in Annual Plan workflow
  const canScoreCEO = isSuperAdmin;

  // Can see Bonus KPIs tab for a function
  const canSeeBonusKPIs = isSuperAdmin || isOwnerOfFunction;

  // ============================================
  // MY TODOS PERMISSIONS
  // ============================================

  // Can use Team View toggle in My Todos
  const canUseTeamView = isSuperAdmin || (access?.allAccessibleFunctions.length || 0) > 0;

  // Functions visible in Team View
  const teamViewFunctions = access?.allAccessibleFunctions || [];

  // ============================================
  // ACCESS MANAGEMENT PERMISSIONS
  // ============================================

  // Can add/remove Function Owners (Super Admin only)
  const canManageOwners = isSuperAdmin;

  // Can add/remove Function Members (Super Admin or Function Owner)
  const canManageMembers = isSuperAdmin || isOwnerOfFunction;

  // ============================================
  // LEGACY PERMISSIONS (for backward compatibility)
  // ============================================

  // Legacy: isAdmin check (now maps to Super Admin)
  const isAdmin = isSuperAdmin;

  // Legacy permissions mapped to new model
  const canView = isSuperAdmin || isOwnerOfFunction;
  const canEdit = isSuperAdmin || isOwnerOfFunction;
  const canCreate = isSuperAdmin || isOwnerOfFunction;
  const canDelete = isSuperAdmin || isOwnerOfFunction;
  const canManageAccess = isSuperAdmin || isOwnerOfFunction;
  const canManageSettings = isSuperAdmin;

  return {
    // Identity
    user,
    profile,
    isSuperAdmin,
    isOwnerOfFunction,
    isMemberOfFunction,
    hasFunctionAccess,

    // Leadership Hub permissions
    canAccessLeadershipHub,
    canViewAllFunctions,
    canEditFunction,
    canScoreCEO,
    canSeeBonusKPIs,

    // My Todos permissions
    canUseTeamView,
    teamViewFunctions,

    // Access Management permissions
    canManageOwners,
    canManageMembers,

    // Loading state
    isLoading: accessLoading,

    // Legacy (backward compatibility)
    isAdmin,
    userRole: isSuperAdmin ? 'admin' : isOwnerOfFunction ? 'lead' : isMemberOfFunction ? 'member' : undefined,
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
  const { canEditFunction, isSuperAdmin } = useLeadershipPermissions(functionId);

  const isOwner = user?.id === initiativeOwnerId;
  const canEditInitiative = isOwner || canEditFunction || isSuperAdmin;
  const canDeleteInitiative = canEditFunction || isSuperAdmin;

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
