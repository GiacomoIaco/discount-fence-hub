/**
 * Route Configuration
 *
 * Maps internal Section IDs to URL paths and vice versa.
 * This enables URL-based navigation while keeping the existing
 * state-based rendering logic intact.
 */

export type Section =
  | 'home'
  | 'dashboard'
  | 'schedule'
  | 'client-hub'
  | 'projects-hub'
  | 'sales-hub'
  | 'bom-calculator'
  | 'bom-calculator-v2'
  | 'inventory'
  | 'yard'
  | 'requests'
  | 'my-requests'
  | 'request-queue'
  | 'my-todos'
  | 'direct-messages'
  | 'team-communication'
  | 'leadership'
  | 'survey-hub'
  | 'analytics'
  | 'roadmap'
  | 'team'
  | 'custom-pricing'
  | 'presentation'
  | 'stain-calculator'
  | 'sales-coach'
  | 'sales-coach-admin'
  | 'photo-gallery'
  | 'sales-resources'
  | 'manager-dashboard'
  | 'assignment-rules';

/**
 * Route definitions mapping Section to URL path
 * The path should NOT include leading slash (added automatically)
 */
export const ROUTE_CONFIG: Record<Section, string> = {
  // Core Navigation
  'home': '',
  'dashboard': 'dashboard',
  'schedule': 'schedule',

  // Client & Projects
  'client-hub': 'clients',
  'projects-hub': 'projects',

  // Sales
  'sales-hub': 'sales',
  'presentation': 'sales/presentation',
  'stain-calculator': 'sales/stain-calculator',
  'sales-coach': 'sales/coach',
  'sales-coach-admin': 'sales/coach/admin',
  'photo-gallery': 'sales/photos',
  'sales-resources': 'sales/resources',

  // Operations
  'bom-calculator': 'ops',
  'bom-calculator-v2': 'ops/v2',
  'inventory': 'ops/inventory',
  'yard': 'ops/yard',

  // Requests
  'requests': 'requests',
  'my-requests': 'requests/my',
  'request-queue': 'requests/queue',
  'custom-pricing': 'requests/custom-pricing',

  // Personal
  'my-todos': 'todos',

  // Communication
  'direct-messages': 'chat',
  'team-communication': 'announcements',

  // Admin
  'leadership': 'leadership',
  'survey-hub': 'surveys',
  'analytics': 'analytics',
  'roadmap': 'roadmap',
  'team': 'settings',

  // Legacy/Internal
  'manager-dashboard': 'manager',
  'assignment-rules': 'settings/assignment-rules',
};

/**
 * Reverse lookup: URL path to Section
 */
const PATH_TO_SECTION: Record<string, Section> = Object.entries(ROUTE_CONFIG).reduce(
  (acc, [section, path]) => {
    acc[path] = section as Section;
    return acc;
  },
  {} as Record<string, Section>
);

/**
 * Convert a Section to its URL path
 */
export function sectionToPath(section: Section): string {
  return '/' + (ROUTE_CONFIG[section] || '');
}

/**
 * Convert a URL path to its Section
 * Returns 'home' if path not found
 */
export function pathToSection(path: string): Section {
  // Remove leading slash and trailing slash
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  return PATH_TO_SECTION[cleanPath] || 'home';
}

/**
 * Check if a path matches a section (handles nested routes)
 * e.g., '/sales/coach' matches 'sales-coach', '/sales' matches 'sales-hub'
 */
export function pathMatchesSection(path: string, section: Section): boolean {
  const sectionPath = ROUTE_CONFIG[section];
  const cleanPath = path.replace(/^\/+|\/+$/g, '');
  return cleanPath === sectionPath;
}

/**
 * Get the best matching section for a path
 * Handles partial matches for nested routes
 */
export function getBestMatchingSection(path: string): Section {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');

  // Exact match first
  if (PATH_TO_SECTION[cleanPath]) {
    return PATH_TO_SECTION[cleanPath];
  }

  // Try progressively shorter paths for nested routes
  const parts = cleanPath.split('/');
  while (parts.length > 0) {
    parts.pop();
    const parentPath = parts.join('/');
    if (PATH_TO_SECTION[parentPath]) {
      return PATH_TO_SECTION[parentPath];
    }
  }

  return 'home';
}

/**
 * FSM Entity Routes (for deep linking to specific entities)
 * These are handled separately from Section navigation
 */
export const FSM_ENTITY_ROUTES = {
  request: '/fsm/requests/:id',
  quote: '/fsm/quotes/:id',
  job: '/fsm/jobs/:id',
  invoice: '/fsm/invoices/:id',
  client: '/clients/:id',
  community: '/clients/:clientId/communities/:id',
  property: '/clients/:clientId/properties/:id',
} as const;

/**
 * Build an entity URL
 */
export function buildEntityUrl(
  entityType: keyof typeof FSM_ENTITY_ROUTES,
  params: Record<string, string>
): string {
  let url: string = FSM_ENTITY_ROUTES[entityType];
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, value);
  });
  return url;
}
