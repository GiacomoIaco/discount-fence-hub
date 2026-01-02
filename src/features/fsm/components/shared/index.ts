// Shared FSM components

// Workflow Progress
export {
  WorkflowProgress,
  RequestProgress,
  QuoteProgress,
  JobProgress,
  InvoiceProgress,
  type WorkflowStep,
} from './WorkflowProgress';

// Entity Header
export { EntityHeader, type Badge } from './EntityHeader';

// Action Bar
export {
  EntityActionBar,
  ActionButtons,
  type ActionButton,
  type ActionVariant,
} from './EntityActionBar';

// Totals Display
export {
  TotalsDisplay,
  TotalsBadge,
  BalanceDueBadge,
} from './TotalsDisplay';

// Budget vs Actual
export {
  BudgetActualDisplay,
  ProfitMarginBadge,
} from './BudgetActualDisplay';
