/**
 * QuotesHub - FSM Quotes Hub (Project-First Architecture)
 *
 * Routes:
 * - /quotes → QuotesList (list view)
 * - /quotes/:id → QuoteCard (unified view/edit)
 *
 * Flow:
 * - "New Quote" → ProjectCreateWizard → QuoteCard (create mode)
 * - Click quote → QuoteCard (view mode)
 * - Edit button → QuoteCard (edit mode)
 */

import { useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Building2,
  Calendar,
  User,
} from 'lucide-react';
import { useQuotes } from '../hooks/useQuotes';
import { useProjectFull } from '../hooks/useProjects';
import { QuoteCard } from '../components/QuoteCard';
import { ProjectCreateWizard } from '../components/project';
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_COLORS,
  type QuoteStatus,
} from '../types';
import type { EntityContext } from '../../../hooks/useRouteSync';
import type { EntityType } from '../../../lib/routes';

interface QuotesHubProps {
  onBack?: () => void;
  /** Entity context from URL for deep linking (e.g., /quotes/abc123) */
  entityContext?: EntityContext | null;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
  /** Clear entity selection (go back to list) */
  onClearEntity?: () => void;
}

export default function QuotesHub({
  entityContext,
  onNavigateToEntity,
  onClearEntity,
}: QuotesHubProps) {
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Project-First Architecture state
  const [showProjectWizard, setShowProjectWizard] = useState(false);
  const [newProjectId, setNewProjectId] = useState<string | null>(null);
  const [quoteMode, setQuoteMode] = useState<'create' | 'edit' | 'view'>('view');

  const filters = statusFilter === 'all' ? undefined : { status: statusFilter };
  const { data: quotes, isLoading, error } = useQuotes(filters);

  // Fetch project data when creating quote from new project
  const { data: projectData } = useProjectFull(newProjectId || undefined);

  // Filter quotes by search query
  const filteredQuotes = quotes?.filter(quote => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      quote.quote_number?.toLowerCase().includes(query) ||
      quote.client?.name?.toLowerCase().includes(query) ||
      quote.community?.name?.toLowerCase().includes(query) ||
      quote.product_type?.toLowerCase().includes(query)
    );
  });

  // Handle quote selection - update URL
  const handleQuoteSelect = (quoteId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('quote', { id: quoteId });
    }
  };

  // Handle navigation to related entities
  const handleNavigateToJob = (jobId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('job', { id: jobId });
    }
  };

  // Handle closing QuoteCard and returning to list
  const handleQuoteCardBack = () => {
    setNewProjectId(null);
    setQuoteMode('view');
    if (onClearEntity) {
      onClearEntity();
    }
  };

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Show ProjectCreateWizard when creating new quote
  if (showProjectWizard) {
    return (
      <ProjectCreateWizard
        isOpen={true}
        onClose={() => setShowProjectWizard(false)}
        onComplete={(projectId) => {
          setShowProjectWizard(false);
          setNewProjectId(projectId);
          setQuoteMode('create');
        }}
        initialData={{ source: 'direct_quote' }}
      />
    );
  }

  // Show QuoteCard for creating new quote (after project wizard completes)
  if (newProjectId && projectData) {
    return (
      <QuoteCard
        mode="create"
        projectId={newProjectId}
        clientId={projectData.client_id || undefined}
        communityId={projectData.community_id || undefined}
        propertyId={projectData.property_id || undefined}
        onBack={handleQuoteCardBack}
        onSave={() => {
          setNewProjectId(null);
          setQuoteMode('view');
        }}
        onConvertToJob={(quoteId) => {
          handleNavigateToJob(quoteId);
        }}
      />
    );
  }

  // Show QuoteCard for viewing/editing existing quote
  if (entityContext?.type === 'quote' && entityContext.id !== 'new') {
    return (
      <QuoteCard
        mode={quoteMode}
        quoteId={entityContext.id}
        onBack={handleQuoteCardBack}
        onSave={() => {
          setQuoteMode('view');
          // Quote stays open in view mode after save
        }}
        onConvertToJob={(quoteId) => {
          handleNavigateToJob(quoteId);
        }}
      />
    );
  }

  // Otherwise, render the list view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
                <p className="text-sm text-gray-500">Manage quotes and proposals</p>
              </div>
            </div>
            <button
              onClick={() => setShowProjectWizard(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              New Quote
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotes..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | 'all')}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Statuses</option>
              {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error ? (
          <div className="p-8 text-center text-red-600">
            Error loading quotes: {error.message}
          </div>
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading quotes...</div>
        ) : !filteredQuotes?.length ? (
          <div className="p-8 text-center border-2 border-dashed rounded-lg bg-white">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No quotes found</p>
            <button
              onClick={() => setShowProjectWizard(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Create First Quote
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                onClick={() => handleQuoteSelect(quote.id)}
                className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <FileText className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">
                            {quote.quote_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${QUOTE_STATUS_COLORS[quote.status]}`}>
                            {QUOTE_STATUS_LABELS[quote.status]}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          {quote.client && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {quote.client.name}
                            </span>
                          )}
                          {quote.product_type && (
                            <span>{quote.product_type}</span>
                          )}
                          {quote.linear_feet && (
                            <span>{quote.linear_feet} LF</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      {formatDate(quote.created_at)}
                    </div>
                    {quote.sales_rep && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <User className="w-4 h-4" />
                        {quote.sales_rep.name}
                      </div>
                    )}
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(quote.total)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
