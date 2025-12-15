/**
 * RequestsHub - FSM Service Requests Hub
 *
 * Routes:
 * - /requests → RequestsList (list view)
 * - /requests/:id → RequestDetailPage (detail view)
 *
 * This is the entry point for client service requests (fence inquiries).
 * Not to be confused with internal "Tickets" (employee requests).
 */

import { useState } from 'react';
import {
  ClipboardList,
  Plus,
} from 'lucide-react';
import { RequestsList } from '../components';
import { RequestDetailPage, RequestEditorPage } from '../pages';
import { useConvertRequestToQuote } from '../hooks/useRequests';
import type { EntityContext } from '../../../hooks/useRouteSync';
import type { EntityType } from '../../../lib/routes';

interface RequestsHubProps {
  onBack?: () => void;
  /** Entity context from URL for deep linking (e.g., /requests/abc123) */
  entityContext?: EntityContext | null;
  /** Navigate to a specific entity */
  onNavigateToEntity?: (entityType: EntityType, params: Record<string, string>) => void;
  /** Clear entity selection (go back to list) */
  onClearEntity?: () => void;
}

export default function RequestsHub({
  entityContext,
  onNavigateToEntity,
  onClearEntity,
}: RequestsHubProps) {
  const [showEditor, setShowEditor] = useState<'create' | 'edit' | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const convertToQuoteMutation = useConvertRequestToQuote();

  // Handle request selection - update URL
  const handleRequestSelect = (requestId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('request', { id: requestId });
    }
  };

  // Handle closing request detail - clear URL
  const handleRequestClose = () => {
    if (onClearEntity) {
      onClearEntity();
    }
  };

  // Handle quote navigation
  const handleNavigateToQuote = (quoteId: string) => {
    if (onNavigateToEntity) {
      onNavigateToEntity('quote', { id: quoteId });
    }
  };

  // Handle create quote from request - converts and navigates to the new quote
  const handleCreateQuote = async (requestId: string) => {
    try {
      const quote = await convertToQuoteMutation.mutateAsync(requestId);
      // Navigate to the newly created quote
      if (onNavigateToEntity) {
        onNavigateToEntity('quote', { id: quote.id });
      }
    } catch (error) {
      console.error('Failed to convert request to quote:', error);
    }
  };

  // Handle edit request
  const handleEditRequest = (requestId: string) => {
    setEditingRequestId(requestId);
    setShowEditor('edit');
  };

  // Handle editor close
  const handleEditorClose = () => {
    setShowEditor(null);
    setEditingRequestId(null);
  };

  // If showing the editor (create or edit), render the editor page
  if (showEditor) {
    return (
      <RequestEditorPage
        requestId={showEditor === 'edit' ? editingRequestId || undefined : undefined}
        onBack={handleEditorClose}
        onSaved={(requestId) => {
          handleEditorClose();
          // Navigate to the created/edited request
          handleRequestSelect(requestId);
        }}
      />
    );
  }

  // If entity context is 'new', show editor for creating new request
  if (entityContext?.type === 'request' && entityContext.id === 'new') {
    return (
      <RequestEditorPage
        onBack={() => onClearEntity?.()}
        onSaved={(requestId) => {
          // Navigate to the created request
          handleRequestSelect(requestId);
        }}
      />
    );
  }

  // If viewing a specific request, render the detail page
  if (entityContext?.type === 'request' && entityContext.id !== 'new') {
    return (
      <RequestDetailPage
        requestId={entityContext.id}
        onBack={handleRequestClose}
        onNavigateToQuote={handleNavigateToQuote}
        onCreateQuote={handleCreateQuote}
        onEdit={handleEditRequest}
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <ClipboardList className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
                <p className="text-sm text-gray-500">Client service requests and inquiries</p>
              </div>
            </div>
            <button
              onClick={() => setShowEditor('create')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              New Request
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <RequestsList
          onSelectRequest={(request) => handleRequestSelect(request.id)}
          onCreate={() => setShowEditor('create')}
          onEdit={(request) => handleEditRequest(request.id)}
          hideHeader
        />
      </div>
    </div>
  );
}
