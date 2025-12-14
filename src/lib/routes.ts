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
  // Internal ticketing (formerly "requests")
  | 'tickets'
  | 'my-tickets'
  | 'ticket-queue'
  | 'custom-pricing'
  // FSM Pipeline
  | 'requests'          // FSM service requests (client inquiries)
  | 'quotes'            // FSM quotes
  | 'jobs'              // FSM jobs
  | 'invoices'          // FSM invoices
  | 'my-todos'
  | 'direct-messages'
  | 'team-communication'
  | 'leadership'
  | 'survey-hub'
  | 'analytics'
  | 'roadmap'
  | 'team'
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

  // Internal ticketing (formerly "requests")
  'tickets': 'tickets',
  'my-tickets': 'tickets/my',
  'ticket-queue': 'tickets/queue',
  'custom-pricing': 'tickets/custom-pricing',

  // FSM Pipeline
  'requests': 'requests',
  'quotes': 'quotes',
  'jobs': 'jobs',
  'invoices': 'invoices',

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
 * Entity types that support deep linking
 */
export type EntityType =
  | 'client'
  | 'community'
  | 'property'
  | 'project'
  | 'ticket'      // Internal ticket (formerly request)
  | 'request'     // FSM service request
  | 'quote'
  | 'job'
  | 'invoice';

/**
 * Entity route patterns - maps entity types to their URL patterns
 * These routes support deep linking to specific records
 */
export const ENTITY_ROUTES: Record<EntityType, { pattern: string; section: Section }> = {
  // Client Hub entities
  client: { pattern: '/clients/:id', section: 'client-hub' },
  community: { pattern: '/clients/:clientId/communities/:id', section: 'client-hub' },
  property: { pattern: '/clients/:clientId/properties/:id', section: 'client-hub' },

  // Projects Hub entities
  project: { pattern: '/projects/:id', section: 'projects-hub' },

  // Internal ticketing
  ticket: { pattern: '/tickets/:id', section: 'tickets' },

  // FSM Pipeline entities
  request: { pattern: '/requests/:id', section: 'requests' },
  quote: { pattern: '/quotes/:id', section: 'quotes' },
  job: { pattern: '/jobs/:id', section: 'jobs' },
  invoice: { pattern: '/invoices/:id', section: 'invoices' },
};

/**
 * Build an entity URL for deep linking
 *
 * @example
 * buildEntityUrl('client', { id: 'abc123' }) // '/clients/abc123'
 * buildEntityUrl('community', { clientId: 'abc', id: '123' }) // '/clients/abc/communities/123'
 * buildEntityUrl('request', { id: 'req-456' }) // '/requests/req-456'
 */
export function buildEntityUrl(
  entityType: EntityType,
  params: Record<string, string>
): string {
  let url: string = ENTITY_ROUTES[entityType].pattern;
  Object.entries(params).forEach(([key, value]) => {
    url = url.replace(`:${key}`, value);
  });
  return url;
}

/**
 * Parse an entity URL to extract type and params
 * Returns null if URL doesn't match any entity pattern
 *
 * @example
 * parseEntityUrl('/clients/abc123') // { type: 'client', params: { id: 'abc123' }, section: 'client-hub' }
 * parseEntityUrl('/requests/req-456') // { type: 'request', params: { id: 'req-456' }, section: 'requests' }
 */
export function parseEntityUrl(path: string): {
  type: EntityType;
  params: Record<string, string>;
  section: Section;
} | null {
  const cleanPath = path.replace(/^\/+|\/+$/g, '');

  for (const [entityType, config] of Object.entries(ENTITY_ROUTES)) {
    const pattern = config.pattern.replace(/^\/+/, '');
    const params = matchPattern(cleanPath, pattern);
    if (params) {
      return {
        type: entityType as EntityType,
        params,
        section: config.section
      };
    }
  }

  return null;
}

/**
 * Match a path against a pattern with :param placeholders
 * Returns extracted params or null if no match
 */
function matchPattern(path: string, pattern: string): Record<string, string> | null {
  const pathParts = path.split('/');
  const patternParts = pattern.split('/');

  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      // This is a parameter - extract it
      const paramName = patternPart.slice(1);
      params[paramName] = pathPart;
    } else if (patternPart !== pathPart) {
      // Static part doesn't match
      return null;
    }
  }

  return params;
}

/**
 * Check if a path is an entity route (has an ID parameter)
 */
export function isEntityRoute(path: string): boolean {
  return parseEntityUrl(path) !== null;
}
