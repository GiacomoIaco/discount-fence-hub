/**
 * ProjectCreateWizard - Step-by-step project creation
 *
 * Flow:
 * 1. Client Selection (search existing or create new)
 * 2. Property/Address (select existing property or enter new)
 * 3. Business Unit (QBO Class selection)
 * 4. Project Details (name, description, rep assignment)
 */

import { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  MapPin,
  Building,
  Briefcase,
  Plus,
  User,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { useCreateProject, type CreateProjectData } from '../../hooks/useProjects';
import { useTerritories } from '../../hooks/useTerritories';
import { SmartAddressInput } from '../../../shared/components/SmartAddressInput';
import ClientEditorModal from '../../../client_hub/components/ClientEditorModal';
import { ClientLookup } from '../../../../components/common/SmartLookup';
import type { SelectedEntity } from '../../../../components/common/SmartLookup';
import type { ProjectSource, QboClass } from '../../types';
import type { AddressFormData } from '../../../shared/types/location';

// Wizard step types
type WizardStep = 'client' | 'property' | 'business_unit' | 'details';

const STEPS: { id: WizardStep; label: string; icon: typeof User }[] = [
  { id: 'client', label: 'Client', icon: User },
  { id: 'property', label: 'Property', icon: MapPin },
  { id: 'business_unit', label: 'Business Unit', icon: Building },
  { id: 'details', label: 'Details', icon: Briefcase },
];

interface Property {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  community_id: string | null;
  client_id: string | null;
  community?: { name: string };
}

// Data returned when project is created
export interface ProjectWizardResult {
  projectId: string;
  clientId: string;
  communityId?: string;
  propertyId?: string;
  qboClassId?: string;
}

interface ProjectCreateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: ProjectWizardResult) => void;
  /** Pre-fill with existing data (e.g., from a request) */
  initialData?: Partial<CreateProjectData>;
}

export function ProjectCreateWizard({
  isOpen,
  onClose,
  onComplete,
  initialData,
}: ProjectCreateWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('client');
  const [formData, setFormData] = useState<Partial<CreateProjectData>>({
    ...initialData,
  });

  // Client/Community selection via unified lookup
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);

  // Derived: extract client and community from selected entity
  const selectedClient = selectedEntity?.client || null;
  const selectedCommunity = selectedEntity?.community || null;

  // Property
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isNewProperty, setIsNewProperty] = useState(false);
  const [newPropertyAddress, setNewPropertyAddress] = useState<AddressFormData>({
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'TX',
    zip: '',
    latitude: null,
    longitude: null,
  });

  // QBO Class
  const [selectedQboClass, setSelectedQboClass] = useState<QboClass | null>(null);

  // Mutations
  const createProject = useCreateProject();

  // Fetch properties for selected client/community
  const { data: clientProperties = [] } = useQuery({
    queryKey: ['client-properties', selectedClient?.id, selectedCommunity?.id],
    queryFn: async () => {
      if (!selectedClient?.id) return [];

      // If a community is selected, only show properties from that community
      if (selectedCommunity?.id) {
        const { data: commProps, error } = await supabase
          .from('properties')
          .select(`
            id, address_line1, city, state, zip, community_id, client_id,
            community:communities(name)
          `)
          .eq('community_id', selectedCommunity.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return (commProps || []).map((prop: any) => ({
          ...prop,
          community: Array.isArray(prop.community) ? prop.community[0] : prop.community,
        })) as Property[];
      }

      // No community selected - show properties directly linked to client (residential)
      const { data: directProps, error: directError } = await supabase
        .from('properties')
        .select(`
          id, address_line1, city, state, zip, community_id, client_id,
          community:communities(name)
        `)
        .eq('client_id', selectedClient.id)
        .order('created_at', { ascending: false });

      if (directError) throw directError;

      // Transform community array to object
      return (directProps || []).map((prop: any) => ({
        ...prop,
        community: Array.isArray(prop.community) ? prop.community[0] : prop.community,
      })) as Property[];
    },
    enabled: !!selectedClient?.id,
  });

  // Fetch QBO classes
  const { data: qboClasses = [] } = useQuery({
    queryKey: ['qbo-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qbo_classes')
        .select('*')
        .eq('is_selectable', true)
        .order('name');

      if (error) throw error;
      return data as QboClass[];
    },
  });

  // Fetch territories for auto-detection
  const { data: territories = [] } = useTerritories();

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('client');
      setFormData(initialData || {});
      setSelectedEntity(null);
      setSelectedProperty(null);
      setSelectedQboClass(null);
      setIsNewProperty(false);
      setNewPropertyAddress({
        address_line1: '',
        address_line2: '',
        city: '',
        state: 'TX',
        zip: '',
        latitude: null,
        longitude: null,
      });
    }
  }, [isOpen, initialData]);

  // Auto-select QBO class when client is selected (if they have a default)
  useEffect(() => {
    if (selectedClient?.default_qbo_class_id && qboClasses.length > 0 && !selectedQboClass) {
      const defaultClass = qboClasses.find(q => q.id === selectedClient.default_qbo_class_id);
      if (defaultClass) {
        setSelectedQboClass(defaultClass);
      }
    }
  }, [selectedClient, qboClasses, selectedQboClass]);

  // Auto-detect territory from ZIP
  const detectTerritory = (zip: string) => {
    if (!zip || zip.length < 5) return null;
    const territory = territories.find((t) => t.zip_codes?.includes(zip));
    return territory?.id || null;
  };

  // Handle step navigation
  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  };

  const goBack = () => {
    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    }
  };

  // Can proceed to next step?
  const canProceed = () => {
    switch (currentStep) {
      case 'client':
        return !!selectedClient;
      case 'property':
        // Client/community already selected in step 1 via unified lookup
        return selectedProperty || (isNewProperty && newPropertyAddress.address_line1);
      case 'business_unit':
        return !!selectedQboClass;
      case 'details':
        // Project name is optional - we have a default fallback in handleCreate
        return true;
      default:
        return false;
    }
  };

  // Handle client creation callback
  const handleClientCreated = async (clientId: string) => {
    // Fetch the newly created client
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, company_name, primary_contact_phone, default_qbo_class_id')
      .eq('id', clientId)
      .single();

    if (!error && data) {
      // Set as selected entity (client only, no community)
      setSelectedEntity({
        client: data as any,
        community: null,
        display_name: data.company_name || data.name,
      });
    }
    setShowCreateClient(false);
  };

  // Handle project creation
  const handleCreate = async () => {
    if (!selectedClient) return;

    let propertyId = selectedProperty?.id;
    let communityId = selectedCommunity?.id || selectedProperty?.community_id;
    let territoryId = formData.territory_id;

    // If new property, create it first
    if (isNewProperty && newPropertyAddress.address_line1) {
      const { data: newProp, error: propError } = await supabase
        .from('properties')
        .insert({
          client_id: selectedCommunity ? null : selectedClient.id, // Link to client only if no community
          community_id: selectedCommunity?.id || null, // Link to community if selected
          address_line1: newPropertyAddress.address_line1,
          // Note: address_line2 column doesn't exist in properties table
          city: newPropertyAddress.city,
          state: newPropertyAddress.state,
          zip: newPropertyAddress.zip,
          latitude: newPropertyAddress.latitude || null,
          longitude: newPropertyAddress.longitude || null,
        })
        .select()
        .single();

      if (propError) {
        console.error('Failed to create property:', propError);
        return;
      }

      propertyId = newProp.id;
      territoryId = detectTerritory(newPropertyAddress.zip) || undefined;
    } else if (selectedProperty) {
      // Auto-detect territory from selected property's ZIP
      territoryId = detectTerritory(selectedProperty.zip) || undefined;
    }

    const projectData: CreateProjectData = {
      client_id: selectedClient.id,
      property_id: propertyId,
      community_id: communityId || undefined,
      territory_id: territoryId,
      qbo_class_id: selectedQboClass?.id,
      assigned_rep_user_id: formData.assigned_rep_user_id,
      name: formData.name || `${selectedClient.company_name || selectedClient.name} Project`,
      description: formData.description,
      source: (formData.source || 'direct_quote') as ProjectSource,
    };

    createProject.mutate(projectData, {
      onSuccess: (result) => {
        // Return all the data that was selected in the wizard
        onComplete({
          projectId: result.id,
          clientId: selectedClient.id,
          communityId: communityId || undefined,
          propertyId: propertyId,
          qboClassId: selectedQboClass?.id,
        });
      },
    });
  };

  // Suggested QBO class badge
  const suggestedQboClass = useMemo(() => {
    if (!selectedClient?.default_qbo_class_id || !qboClasses.length) return null;
    return qboClasses.find(q => q.id === selectedClient.default_qbo_class_id);
  }, [selectedClient, qboClasses]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Create New Project</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Indicator */}
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = step.id === currentStep;
                const isPast = STEPS.findIndex((s) => s.id === currentStep) > index;
                const isComplete = isPast;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}
                  >
                    <button
                      onClick={() => isPast && goToStep(step.id)}
                      disabled={!isPast}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-100 text-blue-700'
                          : isPast
                          ? 'bg-green-100 text-green-700 cursor-pointer'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isComplete ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                      <span className="text-sm font-medium hidden sm:inline">
                        {step.label}
                      </span>
                    </button>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 ${
                          isPast ? 'bg-green-300' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="p-6 overflow-y-auto max-h-[50vh]">
            {/* Step 1: Client/Community Selection (unified search) */}
            {currentStep === 'client' && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Select Client or Community</h3>
                <p className="text-sm text-gray-500">
                  Search for a client by name, or a community like "Creek Hollow"
                </p>

                {/* Unified Client/Community Lookup */}
                <ClientLookup
                  value={selectedEntity}
                  onChange={(entity) => {
                    setSelectedEntity(entity);
                    // Reset property selection when client/community changes
                    setSelectedProperty(null);
                    setIsNewProperty(false);
                    // Reset QBO class when client changes
                    if (!entity || entity.client.id !== selectedClient?.id) {
                      setSelectedQboClass(null);
                    }
                  }}
                  label=""
                  placeholder="Search clients or communities..."
                />

                {/* Selected Entity Display */}
                {selectedEntity && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        {selectedEntity.community ? (
                          <Building className="w-6 h-6 text-blue-600" />
                        ) : (
                          <User className="w-6 h-6 text-blue-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-blue-900">
                          {selectedEntity.display_name}
                        </p>
                        {selectedEntity.community && (
                          <p className="text-sm text-blue-700">
                            Community under {selectedEntity.client.company_name || selectedEntity.client.name}
                          </p>
                        )}
                        {!selectedEntity.community && selectedClient?.primary_contact_phone && (
                          <p className="text-sm text-blue-600">{selectedClient.primary_contact_phone}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedEntity(null);
                          setSelectedQboClass(null);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Create New Client Button */}
                <button
                  onClick={() => setShowCreateClient(true)}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create new client
                </button>
              </div>
            )}

            {/* Step 2: Property Selection */}
            {currentStep === 'property' && (
              <div className="space-y-4">
                {/* Show selected client/community context */}
                {selectedEntity && (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm">
                    <span className="text-gray-500">For: </span>
                    <span className="font-medium">
                      {selectedEntity.community ? (
                        <>{selectedEntity.community.name} ({selectedEntity.client.company_name || selectedEntity.client.name})</>
                      ) : (
                        selectedEntity.client.company_name || selectedEntity.client.name
                      )}
                    </span>
                  </div>
                )}

                <h3 className="font-medium text-gray-900">
                  {selectedCommunity ? `Select Property in ${selectedCommunity.name}` : 'Select or Add Property'}
                </h3>

                {/* Existing Properties */}
                {clientProperties.length > 0 && !isNewProperty && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">
                      {clientProperties.length} {clientProperties.length === 1 ? 'property' : 'properties'} found:
                    </p>
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {clientProperties.map((prop) => (
                        <button
                          key={prop.id}
                          onClick={() => setSelectedProperty(prop)}
                          className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left ${
                            selectedProperty?.id === prop.id ? 'bg-blue-50' : ''
                          }`}
                        >
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <div className="flex-1">
                            <p className="font-medium">{prop.address_line1}</p>
                            <p className="text-sm text-gray-500">
                              {prop.city}, {prop.state} {prop.zip}
                            </p>
                          </div>
                          {selectedProperty?.id === prop.id && (
                            <Check className="w-5 h-5 text-blue-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Or Divider */}
                {clientProperties.length > 0 && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 border-t" />
                    <span className="text-sm text-gray-500">or</span>
                    <div className="flex-1 border-t" />
                  </div>
                )}

                {/* New Property Toggle */}
                <button
                  onClick={() => {
                    setIsNewProperty(!isNewProperty);
                    setSelectedProperty(null);
                  }}
                  className={`w-full flex items-center gap-3 p-4 border rounded-lg ${
                    isNewProperty ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                  }`}
                >
                  <Plus className="w-5 h-5 text-blue-600" />
                  <span className="font-medium">Add New Property</span>
                </button>

                {/* New Property Form with SmartAddressInput */}
                {isNewProperty && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                    <SmartAddressInput
                      value={newPropertyAddress}
                      onChange={setNewPropertyAddress}
                      label="Property Address"
                      required
                      restrictToTexas={true}
                      placeholder="Start typing an address..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Business Unit */}
            {currentStep === 'business_unit' && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Select Business Unit</h3>
                <p className="text-sm text-gray-500">
                  Choose the QBO class for accounting purposes
                </p>

                {/* Suggested QBO Class indicator */}
                {suggestedQboClass && selectedQboClass?.id === suggestedQboClass.id && (
                  <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-lg">
                    <Check className="w-4 h-4" />
                    <span>Auto-selected based on client's default setting</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {qboClasses.map((qbo) => (
                    <button
                      key={qbo.id}
                      onClick={() => setSelectedQboClass(qbo)}
                      className={`p-4 border rounded-lg text-left relative ${
                        selectedQboClass?.id === qbo.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:border-gray-400'
                      }`}
                    >
                      {suggestedQboClass?.id === qbo.id && (
                        <span className="absolute top-2 right-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          Suggested
                        </span>
                      )}
                      <p className="font-medium">{qbo.name}</p>
                      <p className="text-sm text-gray-500">{qbo.labor_code}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {qbo.bu_type} • {qbo.location_code}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Project Details */}
            {currentStep === 'details' && (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Project Details</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={`${selectedClient?.company_name || selectedClient?.name || ''} Project`}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leave blank to use the default name shown above
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Enter project description..."
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Summary */}
                <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                  <h4 className="font-medium text-gray-900">Summary</h4>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-gray-500">Client:</span>{' '}
                      {selectedClient?.company_name || selectedClient?.name}
                    </p>
                    {selectedCommunity && (
                      <p>
                        <span className="text-gray-500">Community:</span>{' '}
                        {selectedCommunity.name}
                      </p>
                    )}
                    <p>
                      <span className="text-gray-500">Address:</span>{' '}
                      {selectedProperty?.address_line1 || newPropertyAddress.address_line1}
                      {(selectedProperty?.city || newPropertyAddress.city) && (
                        <span className="text-gray-400">
                          , {selectedProperty?.city || newPropertyAddress.city}, {selectedProperty?.state || newPropertyAddress.state} {selectedProperty?.zip || newPropertyAddress.zip}
                        </span>
                      )}
                    </p>
                    <p>
                      <span className="text-gray-500">Business Unit:</span>{' '}
                      {selectedQboClass?.name}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <button
              onClick={currentStep === 'client' ? onClose : goBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg"
            >
              <ChevronLeft className="w-4 h-4" />
              {currentStep === 'client' ? 'Cancel' : 'Back'}
            </button>

            {currentStep === 'details' ? (
              <button
                onClick={handleCreate}
                disabled={!canProceed() || createProject.isPending}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createProject.isPending ? 'Creating...' : 'Create Project'}
                <Check className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Client Editor Modal */}
      {showCreateClient && (
        <ClientEditorModal
          client={null}
          onClose={() => setShowCreateClient(false)}
          onSave={handleClientCreated}
        />
      )}
    </>
  );
}

export default ProjectCreateWizard;
