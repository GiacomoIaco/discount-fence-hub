// FSM Components
// Note: TerritoriesList and TerritoryEditorModal removed - use Settings > Territories instead

export { default as CrewsList } from './CrewsList';
export { default as CrewEditorModal } from './CrewEditorModal';
// SalesRepsList and SalesRepEditorModal removed - use FsmTeamList with role='rep' filter
export { default as RequestsList } from './RequestsList';
export { default as RequestEditorModal } from './RequestEditorModal';

// Person-centric FSM components (Phase 3B)
export { default as ProjectTypesList } from './ProjectTypesList';
export { default as ProjectTypeEditorModal } from './ProjectTypeEditorModal';
export { default as AttributesTab } from './AttributesTab';
export { default as FsmTeamList } from './FsmTeamList';
export { default as FsmTeamEditorModal } from './FsmTeamEditorModal';
export { default as FsmTeamImportModal } from './FsmTeamImportModal';

// Project-First Architecture (Phase 3D)
export * from './project';

// Shared components
export * from './shared';

// Job Issues with Penalization (Request-Project Lifecycle)
export { default as JobIssuesList } from './JobIssuesList';

// QuoteCard folder contains the unified quote component (Phase 3F)
// Not exported here to avoid conflict with project/QuoteCard.tsx
// Import directly from './QuoteCard' when ready to replace the old QuoteCard
