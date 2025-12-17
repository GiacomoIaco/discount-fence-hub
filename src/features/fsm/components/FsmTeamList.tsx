import { useState } from 'react';
import { Plus, Edit2, Trash2, User, MapPin, Wrench, Clock, Building2, Users } from 'lucide-react';
import { useFsmTeamFull, useDeleteFsmTeamProfile } from '../hooks';
import type { FsmTeamMember, FsmRole } from '../types';
import { FSM_ROLE_LABELS, DAY_SHORT_LABELS, PROFICIENCY_COLORS } from '../types';
import FsmTeamEditorModal from './FsmTeamEditorModal';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';

export default function FsmTeamList() {
  const { data: teamMembers, isLoading } = useFsmTeamFull();
  const { data: businessUnits } = useBusinessUnits();
  const deleteMutation = useDeleteFsmTeamProfile();

  const [showEditor, setShowEditor] = useState(false);
  const [editingMember, setEditingMember] = useState<FsmTeamMember | null>(null);
  const [filterRole, setFilterRole] = useState<FsmRole | ''>('');
  const [filterBU, setFilterBU] = useState<string>('');

  const handleEdit = (member: FsmTeamMember) => {
    setEditingMember(member);
    setShowEditor(true);
  };

  const handleDelete = async (member: FsmTeamMember) => {
    if (!confirm(`Remove FSM profile for "${member.name}"? This won't delete the user.`)) return;
    await deleteMutation.mutateAsync(member.user_id);
  };

  const handleClose = () => {
    setShowEditor(false);
    setEditingMember(null);
  };

  // Filter team members
  const filteredMembers = teamMembers?.filter(m => {
    if (filterRole && !m.fsm_roles.includes(filterRole)) return false;
    if (filterBU && !m.business_unit_ids.includes(filterBU)) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">FSM Team</h3>
          <p className="text-sm text-gray-500">
            Team members with roles, territories, skills, and schedules
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as FsmRole | '')}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">All Roles</option>
            {Object.entries(FSM_ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* BU Filter */}
          {businessUnits && businessUnits.length > 1 && (
            <select
              value={filterBU}
              onChange={(e) => setFilterBU(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">All BUs</option>
              {businessUnits.map(bu => (
                <option key={bu.id} value={bu.id}>{bu.name}</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowEditor(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Team Member
          </button>
        </div>
      </div>

      {/* List */}
      {filteredMembers && filteredMembers.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 divide-y">
          {filteredMembers.map((member) => (
            <div
              key={member.user_id}
              className="p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    {/* Name and Roles */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{member.name}</span>
                      {member.fsm_roles.map(role => (
                        <span
                          key={role}
                          className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded"
                        >
                          {FSM_ROLE_LABELS[role]}
                        </span>
                      ))}
                      {!member.is_active && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded">
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Email and Crew */}
                    <div className="text-sm text-gray-500 mt-0.5">
                      {member.email}
                      {member.crew_name && (
                        <span className="ml-2 inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {member.crew_name}
                        </span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      {/* Territories */}
                      {member.territories.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-blue-500" />
                          {member.territories.length === 1
                            ? member.territories[0].territory_name
                            : `${member.territories.length} territories`}
                          {member.territories.some(t => t.coverage_days) && (
                            <span className="text-gray-400">
                              ({member.territories
                                .filter(t => t.coverage_days)
                                .map(t => t.coverage_days?.map(d => DAY_SHORT_LABELS[d]).join(', '))
                                .join('; ')})
                            </span>
                          )}
                        </span>
                      )}

                      {/* Skills */}
                      {member.skills.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3.5 h-3.5 text-purple-500" />
                          {member.skills.map((s, i) => (
                            <span key={s.project_type_id}>
                              {i > 0 && ', '}
                              <span className={`px-1 rounded ${PROFICIENCY_COLORS[s.proficiency]}`}>
                                {s.project_type_name}
                              </span>
                            </span>
                          ))}
                        </span>
                      )}

                      {/* Work Schedule */}
                      {member.work_schedule.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-amber-500" />
                          {member.work_schedule.map(s => DAY_SHORT_LABELS[s.day]).join(', ')}
                        </span>
                      )}

                      {/* Business Units */}
                      {member.business_unit_ids.length > 0 && businessUnits && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {member.business_unit_ids
                            .map(id => businessUnits.find(bu => bu.id === id)?.name)
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(member)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remove FSM Profile"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">
            {filterRole || filterBU
              ? 'No team members match the filters'
              : 'No FSM team profiles configured yet'}
          </p>
          <button
            onClick={() => setShowEditor(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            Add First Team Member
          </button>
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <FsmTeamEditorModal
          member={editingMember}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
