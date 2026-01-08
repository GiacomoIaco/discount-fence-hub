/**
 * ProjectEditorModal - Edit project details
 *
 * Editable fields:
 * - Name (optional project name/description)
 * - Client (searchable dropdown)
 * - Community (filtered by client if applicable)
 * - Property (filtered by client/community)
 * - Business Unit (QBO Class)
 * - Assigned Rep
 * - Status
 */

import { useState, useEffect } from 'react';
import { X, Building2, MapPin, Briefcase, User, Tag, Loader2 } from 'lucide-react';
import { useUpdateProject, type UpdateProjectData } from '../../hooks/useProjects';
import { useClients } from '../../../client_hub/hooks/useClients';
import { useCommunities } from '../../../client_hub/hooks/useCommunities';
import { useClientProperties, useProperties } from '../../../client_hub/hooks/useProperties';
import { useQboClasses } from '../../../client_hub/hooks/useQboClasses';
import { useSalesReps } from '../../hooks/useSalesReps';
import type { Project, ProjectStatus } from '../../types';

const PROJECT_STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'warranty', label: 'Warranty' },
];

interface ProjectEditorModalProps {
  project: Project;
  onClose: () => void;
  onSaved?: () => void;
}

export default function ProjectEditorModal({
  project,
  onClose,
  onSaved,
}: ProjectEditorModalProps) {
  const updateMutation = useUpdateProject();

  // Data queries
  const { data: clients = [] } = useClients();
  const { data: qboClasses = [] } = useQboClasses(true); // Only selectable
  const { data: reps = [] } = useSalesReps();

  // Form state
  const [formData, setFormData] = useState<UpdateProjectData>({
    name: project.name || '',
    status: project.status,
    client_id: project.client_id,
    community_id: project.community_id,
    property_id: project.property_id,
    qbo_class_id: project.qbo_class_id,
    assigned_rep_user_id: project.assigned_rep_user_id,
  });

  // Communities filtered by selected client
  const { data: communities = [] } = useCommunities(
    formData.client_id ? { client_id: formData.client_id } : undefined
  );

  // Properties from client (includes properties from their communities)
  const { data: clientProperties = [] } = useClientProperties(formData.client_id || null);

  // Properties from specific community (if selected)
  const { data: communityProperties = [] } = useProperties(formData.community_id || null);

  // Use community properties if community selected, otherwise all client properties
  const properties = formData.community_id ? communityProperties : clientProperties;

  // When client changes, reset community and property if they don't belong
  useEffect(() => {
    if (formData.client_id !== project.client_id) {
      // Check if current community belongs to new client
      const communityBelongs = communities.some(c => c.id === formData.community_id);
      if (!communityBelongs && formData.community_id) {
        setFormData(prev => ({
          ...prev,
          community_id: null,
          property_id: null,
        }));
      }
    }
  }, [formData.client_id, communities, project.client_id, formData.community_id]);

  // When community changes, reset property if it doesn't belong
  useEffect(() => {
    if (formData.community_id !== project.community_id) {
      const propertyBelongs = properties.some(p => p.id === formData.property_id);
      if (!propertyBelongs && formData.property_id) {
        setFormData(prev => ({ ...prev, property_id: null }));
      }
    }
  }, [formData.community_id, properties, project.community_id, formData.property_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateMutation.mutateAsync({
        id: project.id,
        data: formData,
      });
      onSaved?.();
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const hasChanges =
    formData.name !== (project.name || '') ||
    formData.status !== project.status ||
    formData.client_id !== project.client_id ||
    formData.community_id !== project.community_id ||
    formData.property_id !== project.property_id ||
    formData.qbo_class_id !== project.qbo_class_id ||
    formData.assigned_rep_user_id !== project.assigned_rep_user_id;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Edit Project</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Tag className="w-4 h-4 inline mr-1 text-gray-400" />
              Project Name
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value || null }))}
              placeholder="Optional - defaults to client/address"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as ProjectStatus }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PROJECT_STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1 text-gray-400" />
              Client
            </label>
            <select
              value={formData.client_id || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                client_id: e.target.value || null,
              }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select client...</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.company_name || client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Community (if available) */}
          {communities.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Community
              </label>
              <select
                value={formData.community_id || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  community_id: e.target.value || null,
                }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No community</option>
                {communities.map(community => (
                  <option key={community.id} value={community.id}>
                    {community.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Property */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1 text-gray-400" />
              Property Address
            </label>
            <select
              value={formData.property_id || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                property_id: e.target.value || null,
              }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select property...</option>
              {properties.map(prop => (
                <option key={prop.id} value={prop.id}>
                  {prop.address_line1}
                  {prop.city && `, ${prop.city}`}
                  {prop.zip && ` ${prop.zip}`}
                </option>
              ))}
            </select>
            {properties.length === 0 && formData.client_id && (
              <p className="text-xs text-gray-500 mt-1">
                No properties found for this client
              </p>
            )}
          </div>

          {/* Business Unit (QBO Class) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Briefcase className="w-4 h-4 inline mr-1 text-gray-400" />
              Business Unit
            </label>
            <select
              value={formData.qbo_class_id || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                qbo_class_id: e.target.value || null,
              }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select business unit...</option>
              {qboClasses.map(qbo => (
                <option key={qbo.id} value={qbo.id}>
                  {qbo.labor_code ? `${qbo.labor_code} - ${qbo.name}` : qbo.name}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Rep */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1 text-gray-400" />
              Assigned Rep
            </label>
            <select
              value={formData.assigned_rep_user_id || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                assigned_rep_user_id: e.target.value || null,
              }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No rep assigned</option>
              {reps.map(rep => (
                <option key={rep.user_id} value={rep.user_id}>
                  {rep.name}
                </option>
              ))}
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!hasChanges || updateMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
