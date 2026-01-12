/**
 * QuickTicketModal - Create a ticket from FSM entities (Quote/Job)
 *
 * IMPORTANT: This is ADDITIVE to existing ticket flows.
 * - Uses existing createRequest() function (no backend changes)
 * - Pre-fills free-text fields from FSM data
 * - Optionally sets FSM FK fields (fsm_quote_id, fsm_job_id, fsm_project_id)
 * - All existing ticket functionality continues to work
 *
 * Pattern: "Tickets-First, FSM-Optional"
 * - Free-text fields (customer_name, address, etc.) remain the primary data
 * - FSM links are optional enrichment for the few projects managed in-app
 */

import { useState, useMemo } from 'react';
import { X, Ticket, AlertCircle, Loader2 } from 'lucide-react';
import { useCreateRequestMutation } from '../../requests/hooks/useRequestsQuery';
import type { RequestType, Urgency, CreateRequestInput } from '../../requests/lib/requests';

// Ticket type options for FSM context
const FSM_TICKET_TYPES: { value: RequestType; label: string; description: string }[] = [
  { value: 'pricing', label: 'Custom Pricing', description: 'Request special pricing or discount approval' },
  { value: 'material', label: 'Material Issue', description: 'Report material shortage or quality issue' },
  { value: 'support', label: 'Support', description: 'General support request' },
  { value: 'warranty', label: 'Warranty', description: 'Warranty claim or repair request' },
  { value: 'other', label: 'Other', description: 'Other issue or question' },
];

// Context passed from Quote or Job
export interface FsmTicketContext {
  entityType: 'quote' | 'job';
  entityId: string;
  entityNumber: string;
  projectId?: string | null;
  // Customer info (from client/community)
  clientId?: string;
  clientName?: string;
  communityId?: string;
  communityName?: string;
  // Address
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  // Project details
  productType?: string | null;
  linearFeet?: number | null;
  // Contact (from client if available)
  phone?: string;
  email?: string;
}

interface QuickTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: FsmTicketContext;
  /** Callback after successful ticket creation */
  onSuccess?: (ticketId: string) => void;
}

export default function QuickTicketModal({
  isOpen,
  onClose,
  context,
  onSuccess,
}: QuickTicketModalProps) {
  // Form state
  const [ticketType, setTicketType] = useState<RequestType>(() => {
    // Default based on entity type
    return context.entityType === 'quote' ? 'pricing' : 'support';
  });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');

  // Mutation
  const createTicket = useCreateRequestMutation();

  // Build display name: "Client - Community" or just client/community
  const customerDisplayName = useMemo(() => {
    if (context.clientName && context.communityName) {
      return `${context.clientName} - ${context.communityName}`;
    }
    return context.communityName || context.clientName || '';
  }, [context.clientName, context.communityName]);

  // Build address string
  const addressString = useMemo(() => {
    if (!context.address) return '';
    const parts = [
      context.address.line1,
      context.address.line2,
      context.address.city,
      context.address.state,
      context.address.zip,
    ].filter(Boolean);
    return parts.join(', ');
  }, [context.address]);

  // Default title based on type and entity
  const defaultTitle = useMemo(() => {
    const typeLabel = FSM_TICKET_TYPES.find(t => t.value === ticketType)?.label || 'Request';
    return `${typeLabel} - ${context.entityNumber}`;
  }, [ticketType, context.entityNumber]);

  // Handle submit
  const handleSubmit = async () => {
    try {
      // Build the ticket data using CreateRequestInput
      // NOTE: fsm_quote_id, fsm_job_id, fsm_project_id are in the database
      // but not in CreateRequestInput type yet. We pass them directly to createRequest
      // which will include them in the insert.
      const ticketData: CreateRequestInput & {
        fsm_quote_id?: string;
        fsm_job_id?: string;
        fsm_project_id?: string;
      } = {
        request_type: ticketType,
        title: title || defaultTitle,
        description: description || undefined,
        urgency,
        // Pre-fill free-text fields (these remain primary data source)
        customer_name: customerDisplayName || undefined,
        customer_address: addressString || undefined,
        customer_phone: context.phone || undefined,
        customer_email: context.email || undefined,
        project_number: context.entityNumber,
        fence_type: context.productType || undefined,
        linear_feet: context.linearFeet || undefined,
        // Client Hub links
        client_id: context.clientId || undefined,
        community_id: context.communityId || undefined,
      };

      // Add FSM FK links (optional enrichment)
      if (context.entityType === 'quote') {
        ticketData.fsm_quote_id = context.entityId;
      } else {
        ticketData.fsm_job_id = context.entityId;
      }
      if (context.projectId) {
        ticketData.fsm_project_id = context.projectId;
      }

      const result = await createTicket.mutateAsync(ticketData as CreateRequestInput);

      onSuccess?.(result.id);
      onClose();
    } catch (error) {
      console.error('Failed to create ticket:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Ticket className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Create Ticket</h2>
              <p className="text-sm text-gray-500">From {context.entityNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={createTicket.isPending}
            className="p-2 hover:bg-gray-200 rounded-lg disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Pre-filled context info */}
          {customerDisplayName && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm">
              <div className="font-medium text-gray-700">Customer</div>
              <div className="text-gray-900">{customerDisplayName}</div>
              {addressString && (
                <div className="text-gray-500 text-xs mt-1">{addressString}</div>
              )}
            </div>
          )}

          {/* Ticket Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ticket Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FSM_TICKET_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setTicketType(type.value)}
                  className={`p-3 text-left border rounded-lg transition-colors ${
                    ticketType === type.value
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-sm font-medium ${
                    ticketType === type.value ? 'text-blue-700' : 'text-gray-900'
                  }`}>
                    {type.label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue or request..."
              rows={3}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Urgency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Urgency
            </label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'critical'] as Urgency[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setUrgency(level)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${
                    urgency === level
                      ? level === 'critical'
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : level === 'high'
                        ? 'bg-orange-100 border-orange-500 text-orange-700'
                        : level === 'medium'
                        ? 'bg-yellow-100 border-yellow-500 text-yellow-700'
                        : 'bg-green-100 border-green-500 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Error message */}
          {createTicket.isError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Failed to create ticket. Please try again.</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={createTicket.isPending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createTicket.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createTicket.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Ticket className="w-4 h-4" />
                Create Ticket
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
