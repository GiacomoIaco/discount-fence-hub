/**
 * QuoteClientSection - Client and property information section
 *
 * Shows client name, property address, and contact details.
 * In edit mode, allows selection via dropdowns.
 */

import { User, MapPin, Mail, Phone, Building2 } from 'lucide-react';
import type { QuoteCardMode } from './types';
import { useClients, useClient } from '../../../client_hub/hooks/useClients';
import { useCommunities, useCommunity } from '../../../client_hub/hooks/useCommunities';
import { useProperties, useProperty } from '../../../client_hub/hooks/useProperties';
import { ClientLookup } from '../../../../components/common/SmartLookup';
import type { SelectedEntity } from '../../../../components/common/SmartLookup';

interface QuoteClientSectionProps {
  mode: QuoteCardMode;
  clientId: string;
  communityId: string;
  propertyId: string;
  onClientChange: (clientId: string, communityId?: string) => void;
  onCommunityChange: (communityId: string) => void;
  onPropertyChange: (propertyId: string) => void;
}

export default function QuoteClientSection({
  mode,
  clientId,
  communityId,
  propertyId,
  onClientChange,
  onCommunityChange,
  onPropertyChange,
}: QuoteClientSectionProps) {
  const isEditable = mode !== 'view';

  // Fetch data lists for dropdowns
  const { data: clients } = useClients({ status: 'active' });
  const { data: communities } = useCommunities(clientId ? { client_id: clientId } : undefined);
  const { data: properties } = useProperties(communityId || null);

  // Fallback: Fetch entities directly by ID when they're not in the lists
  // This handles cases where wizard passes IDs that aren't in filtered lists
  const clientInList = clients?.find(c => c.id === clientId);
  const { data: directClient } = useClient(clientId && !clientInList ? clientId : null);

  const communityInList = communities?.find(c => c.id === communityId);
  const { data: directCommunity } = useCommunity(communityId && !communityInList ? communityId : null);

  // Fetch property directly by ID when we have propertyId but no communityId
  // This handles residential properties linked directly to client (not via community)
  const propertyInList = properties?.find(p => p.id === propertyId);
  const { data: directProperty } = useProperty(propertyId && !propertyInList ? propertyId : null);

  // Get selected entities - prefer list, fallback to direct fetch
  const selectedClient = clientInList || directClient;
  const selectedCommunity = communityInList || directCommunity;
  const selectedProperty = propertyInList || directProperty;

  // Build selected entity for ClientLookup
  const selectedEntity: SelectedEntity | null = selectedClient ? {
    client: selectedClient,
    community: selectedCommunity || null,
    display_name: selectedCommunity
      ? `${selectedCommunity.name} (${selectedClient.name})`
      : selectedClient.name,
  } : null;

  const handleEntitySelect = (entity: SelectedEntity | null) => {
    if (entity) {
      onClientChange(entity.client.id, entity.community?.id);
    } else {
      onClientChange('');
    }
  };

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            Client Details
          </h2>

          {isEditable ? (
            <div className="space-y-3">
              <ClientLookup
                value={selectedEntity}
                onChange={handleEntitySelect}
                label="Client *"
                placeholder="Search clients..."
                required
              />

              {clientId && communities && communities.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Community</label>
                  <select
                    value={communityId}
                    onChange={(e) => {
                      onCommunityChange(e.target.value);
                      onPropertyChange('');
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select community...</option>
                    {communities.map((community) => (
                      <option key={community.id} value={community.id}>{community.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {communityId && properties && properties.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Property</label>
                  <select
                    value={propertyId}
                    onChange={(e) => onPropertyChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select property...</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.lot_number ? `Lot ${property.lot_number} - ` : ''}{property.address_line1}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {selectedClient ? (
                <>
                  <div className="font-medium text-gray-900">
                    {selectedClient.company_name || selectedClient.name}
                  </div>
                  {selectedClient.primary_contact_name && (
                    <div className="text-sm text-gray-600">{selectedClient.primary_contact_name}</div>
                  )}
                  {selectedCommunity && (
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Building2 className="w-3 h-3" />
                      {selectedCommunity.name}
                    </div>
                  )}
                  {selectedClient.primary_contact_email && (
                    <a
                      href={`mailto:${selectedClient.primary_contact_email}`}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <Mail className="w-3 h-3" />
                      {selectedClient.primary_contact_email}
                    </a>
                  )}
                  {selectedClient.primary_contact_phone && (
                    <a
                      href={`tel:${selectedClient.primary_contact_phone}`}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      {selectedClient.primary_contact_phone}
                    </a>
                  )}
                </>
              ) : (
                <span className="text-gray-400 italic">No client selected</span>
              )}
            </div>
          )}
        </div>

        {/* Property Section */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-gray-400" />
            Property Address
          </h2>

          {selectedProperty ? (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium text-gray-900">{selectedProperty.address_line1}</div>
              <div className="text-sm text-gray-600">
                {selectedProperty.city}, {selectedProperty.state} {selectedProperty.zip}
              </div>
              {selectedProperty.lot_number && (
                <div className="text-sm text-gray-500 mt-1">Lot {selectedProperty.lot_number}</div>
              )}
            </div>
          ) : selectedCommunity ? (
            <div className="text-gray-500 italic">
              <div>{selectedCommunity.name}</div>
              <div className="text-sm">Select a property above</div>
            </div>
          ) : (
            <div className="text-gray-400 italic">
              Select client and property
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
