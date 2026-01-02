// QuoteCard - Unified quote component for create/edit/view modes
// Replaces QuoteBuilderPage and QuoteDetailPage with a single component

export { default as QuoteCard } from './QuoteCard';
export { default as QuoteHeader } from './QuoteHeader';
export { default as QuoteClientSection } from './QuoteClientSection';
export { default as QuoteLineItems } from './QuoteLineItems';
export { default as QuoteSidebar } from './QuoteSidebar';
export { default as QuoteTotals } from './QuoteTotals';
export { useQuoteForm } from './useQuoteForm';
export type {
  QuoteCardProps,
  QuoteCardMode,
  QuoteFormState,
  LineItemFormState,
  QuoteTotals as QuoteTotalsType,
  QuoteValidation,
} from './types';
