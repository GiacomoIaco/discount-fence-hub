/**
 * ProjectCreateWizard - Step-by-step project creation
 *
 * Flow:
 * 1. Client Selection (search existing or create new)
 * 2. Property/Address (select existing property or enter new)
 * 3. Business Unit (QBO Class selection)
 * 4. Project Details (name, description, rep assignment)
 */

import { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  MapPin,
  Building,
  Briefcase,
  Search,
  Plus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../lib/supabase';
import { useCreateProject, type CreateProjectData } from '../../hooks/useProjects';
import { useTerritories } from '../../hooks/useTerritories';
import type { ProjectSource, QboClass } from '../../types';

// Wizard step types
type WizardStep = 'client' | 'property' | 'business_unit' | 'details';

const STEPS: { id: WizardStep; label: string; icon: typeof User }[] = [
  { id: 'client', label: 'Client', icon: User },
  { id: 'property', label: 'Property', icon: MapPin },
  { id: 'business_unit', label: 'Business Unit', icon: Building },
  { id: 'details', label: 'Details', icon: Briefcase },
];

interface Client {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}

interface Property {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  community_id: string | null;
  community?: { name: string };
}

interface ProjectCreateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (projectId: string) => void;
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

  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Property
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isNewProperty, setIsNewProperty] = useState(false);
  const [newPropertyData, setNewPropertyData] = useState({
    address_line1: '',
    address_line2: '',
    city: '',
    state: 'TX',
    zip: '',
  });

  // QBO Class
  const [selectedQboClass, setSelectedQboClass] = useState<QboClass | null>(null);

  // Mutations
  const createProject = useCreateProject();

  // Fetch clients for search
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: async () => {
      if (!clientSearch || clientSearch.length < 2) return [];

      const { data, error } = await supabase
        .from('clients')
        .select('id, name, company_name, email, phone')
        .or(`name.ilike.%${clientSearch}%,company_name.ilike.%${clientSearch}%`)
        .limit(10);

      if (error) throw error;
      return data as Client[];
    },
    enabled: clientSearch.length >= 2,
  });

  // Fetch properties for selected client
  const { data: clientProperties = [] } = useQuery({
    queryKey: ['client-properties', selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient?.id) return [];

      const { data, error } = await supabase
        .from('properties')
        .select(`
          id, address_line1, address_line2, city, state, zip, community_id,
          community:communities(name)
        `)
        .eq('client_id', selectedClient.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Property[];
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
  const { data: territories = [] } = useTerritories({});

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('client');
      setFormData(initialData || {});
      setSelectedClient(null);
      setSelectedProperty(null);
      setSelectedQboClass(null);
      setClientSearch('');
      setIsNewProperty(false);
      setNewPropertyData({
        address_line1: '',
        address_line2: '',
        city: '',
        state: 'TX',
        zip: '',
      });
    }
  }, [isOpen, initialData]);

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
        return selectedProperty || (isNewProperty && newPropertyData.address_line1);
      case 'business_unit':
        return !!selectedQboClass;
      case 'details':
        return !!formData.name;
      default:
        return false;
    }
  };

  // Handle project creation
  const handleCreate = async () => {
    if (!selectedClient) return;

    let propertyId = selectedProperty?.id;
    let communityId = selectedProperty?.community_id;
    let territoryId = formData.territory_id;

    // If new property, create it first
    if (isNewProperty && newPropertyData.address_line1) {
      const { data: newProp, error: propError } = await supabase
        .from('properties')
        .insert({
          client_id: selectedClient.id,
          address_line1: newPropertyData.address_line1,
          address_line2: newPropertyData.address_line2 || null,
          city: newPropertyData.city,
          state: newPropertyData.state,
          zip: newPropertyData.zip,
        })
        .select()
        .single();

      if (propError) {
        console.error('Failed to create property:', propError);
        return;
      }

      propertyId = newProp.id;
      territoryId = detectTerritory(newPropertyData.zip) || undefined;
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
        onComplete(result.id);
      },
    });
  };

  if (!isOpen) return null;

  return (
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
          {/* Step 1: Client Selection */}
          {currentStep === 'client' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Select or Create Client</h3>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setSelectedClient(null);
                  }}
                  placeholder="Search clients by name..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Results */}
              {clients.length > 0 && !selectedClient && (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSelectedClient(client);
                        setClientSearch(client.company_name || client.name);
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">
                          {client.company_name || client.name}
                        </p>
                        {client.company_name && (
                          <p className="text-sm text-gray-500">{client.name}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Client */}
              {selectedClient && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">
                        {selectedClient.company_name || selectedClient.name}
                      </p>
                      {selectedClient.company_name && (
                        <p className="text-sm text-blue-700">{selectedClient.name}</p>
                      )}
                      {selectedClient.email && (
                        <p className="text-sm text-blue-600">{selectedClient.email}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedClient(null);
                        setClientSearch('');
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Create New Client Link */}
              <p className="text-sm text-gray-500">
                Can't find the client?{' '}
                <button className="text-blue-600 hover:underline">
                  Create new client
                </button>
              </p>
            </div>
          )}

          {/* Step 2: Property Selection */}
          {currentStep === 'property' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">Select or Add Property</h3>

              {/* Existing Properties */}
              {clientProperties.length > 0 && !isNewProperty && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">
                    Select an existing property:
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
                          {prop.community && (
                            <p className="text-xs text-blue-600">
                              {prop.community.name}
                            </p>
                          )}
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

              {/* New Property Form */}
              {isNewProperty && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={newPropertyData.address_line1}
                    onChange={(e) =>
                      setNewPropertyData({ ...newPropertyData, address_line1: e.target.value })
                    }
                    placeholder="Street Address"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newPropertyData.address_line2}
                    onChange={(e) =>
                      setNewPropertyData({ ...newPropertyData, address_line2: e.target.value })
                    }
                    placeholder="Unit/Suite (optional)"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="text"
                      value={newPropertyData.city}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, city: e.target.value })
                      }
                      placeholder="City"
                      className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={newPropertyData.state}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, state: e.target.value })
                      }
                      placeholder="State"
                      className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={newPropertyData.zip}
                      onChange={(e) =>
                        setNewPropertyData({ ...newPropertyData, zip: e.target.value })
                      }
                      placeholder="ZIP"
                      className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
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

              <div className="grid grid-cols-2 gap-3">
                {qboClasses.map((qbo) => (
                  <button
                    key={qbo.id}
                    onClick={() => setSelectedQboClass(qbo)}
                    className={`p-4 border rounded-lg text-left ${
                      selectedQboClass?.id === qbo.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-gray-400'
                    }`}
                  >
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
                  <p>
                    <span className="text-gray-500">Address:</span>{' '}
                    {selectedProperty?.address_line1 || newPropertyData.address_line1}
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
  );
}

export default ProjectCreateWizard;
