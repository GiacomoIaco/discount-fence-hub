import { useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, User, MapPin, Wrench, Clock, Building2, Users, Check, X, ChevronDown } from 'lucide-react';
import { useFsmTeamFull, useDeleteFsmTeamProfile, useUpdateAssignedBUs } from '../hooks';
import { useCrews, useAllRepCrewAlignments, useSetRepCrewAlignments } from '../hooks';
import type { FsmTeamMember, FsmRole, Crew } from '../types';
import { FSM_ROLE_LABELS, DAY_SHORT_LABELS, PROFICIENCY_COLORS } from '../types';
import FsmTeamEditorModal from './FsmTeamEditorModal';
import { useBusinessUnits } from '../../settings/hooks/useBusinessUnits';

interface EditingState {
  userId: string;
  field: 'bus' | 'crews';
  selectedIds: string[];
}

export default function FsmTeamList() {
  const { data: teamMembers, isLoading } = useFsmTeamFull();
  const { data: businessUnits } = useBusinessUnits();
  const { data: crews } = useCrews();
  const { data: allAlignments } = useAllRepCrewAlignments();
  const deleteMutation = useDeleteFsmTeamProfile();
  const updateBUsMutation = useUpdateAssignedBUs();
  const setCrewAlignmentsMutation = useSetRepCrewAlignments();

  const [showEditor, setShowEditor] = useState(false);
  const [editingMember, setEditingMember] = useState<FsmTeamMember | null>(null);
  const [filterRole, setFilterRole] = useState<FsmRole | ''>('');
  const [filterBU, setFilterBU] = useState<string>('');
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get aligned crews for a rep
  const getAlignedCrews = useCallback((userId: string): Crew[] => {
    if (!allAlignments || !crews) return [];
    const alignments = allAlignments.filter(a => a.rep_user_id === userId);
    return alignments
      .map(a => crews.find(c => c.id === a.crew_id))
      .filter((c): c is Crew => c !== undefined);
  }, [allAlignments, crews]);

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

  // Start inline editing
  const startEditing = (userId: string, field: 'bus' | 'crews') => {
    if (field === 'bus') {
      const member = teamMembers?.find(m => m.user_id === userId);
      setEditing({
        userId,
        field,
        selectedIds: member?.assigned_qbo_class_ids || [],
      });
    } else {
      const alignedCrews = getAlignedCrews(userId);
      setEditing({
        userId,
        field,
        selectedIds: alignedCrews.map(c => c.id),
      });
    }
    setDropdownOpen(false);
  };

  // Toggle selection in editing mode
  const toggleSelection = (id: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      selectedIds: editing.selectedIds.includes(id)
        ? editing.selectedIds.filter(s => s !== id)
        : [...editing.selectedIds, id],
    });
  };

  // Save inline edit
  const saveEdit = async () => {
    if (!editing) return;

    if (editing.field === 'bus') {
      await updateBUsMutation.mutateAsync({
        userId: editing.userId,
        assignedQboClassIds: editing.selectedIds,
      });
    } else {
      await setCrewAlignmentsMutation.mutateAsync({
        repUserId: editing.userId,
        crewIds: editing.selectedIds,
      });
    }
    setEditing(null);
    setDropdownOpen(false);
  };

  // Cancel inline edit
  const cancelEdit = () => {
    setEditing(null);
    setDropdownOpen(false);
  };

  // Filter team members
  const filteredMembers = teamMembers?.filter(m => {
    if (filterRole && !m.fsm_roles.includes(filterRole)) return false;
    if (filterBU && !m.business_unit_ids.includes(filterBU)) return false;
    return true;
  });

  // Check if member is a rep (can have crew alignments)
  const isRep = (member: FsmTeamMember) => member.fsm_roles.includes('rep');

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
            Team members with roles, BU assignments, and crew alignments
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

      {/* Table */}
      {filteredMembers && filteredMembers.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team Member
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned BUs
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Aligned Crews
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.map((member) => {
                const alignedCrews = getAlignedCrews(member.user_id);
                const isEditingBUs = editing?.userId === member.user_id && editing?.field === 'bus';
                const isEditingCrews = editing?.userId === member.user_id && editing?.field === 'crews';
                const memberIsRep = isRep(member);

                return (
                  <tr key={member.user_id} className="hover:bg-gray-50">
                    {/* Team Member */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{member.name}</div>
                          <div className="text-xs text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Roles */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
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
                    </td>

                    {/* Assigned BUs - Inline Editable */}
                    <td className="px-4 py-3">
                      {isEditingBUs ? (
                        <div className="relative">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {editing.selectedIds.map(id => {
                              const bu = businessUnits?.find(b => b.id === id);
                              return bu ? (
                                <span
                                  key={id}
                                  className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded inline-flex items-center gap-1"
                                >
                                  {bu.name}
                                  <button
                                    onClick={() => toggleSelection(id)}
                                    className="hover:text-purple-900"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ) : null;
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="w-full text-left text-xs border border-gray-300 rounded px-2 py-1 flex items-center justify-between bg-white"
                              >
                                <span className="text-gray-500">Add BU...</span>
                                <ChevronDown className="w-3 h-3 text-gray-400" />
                              </button>
                              {dropdownOpen && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                                  {businessUnits?.filter(bu => !editing.selectedIds.includes(bu.id)).map(bu => (
                                    <button
                                      key={bu.id}
                                      onClick={() => {
                                        toggleSelection(bu.id);
                                        setDropdownOpen(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                                    >
                                      {bu.name}
                                    </button>
                                  ))}
                                  {businessUnits?.filter(bu => !editing.selectedIds.includes(bu.id)).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-500">All BUs selected</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={saveEdit}
                              disabled={updateBUsMutation.isPending}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="group flex flex-wrap gap-1 cursor-pointer min-h-[24px] rounded p-1 -m-1 hover:bg-gray-100"
                          onClick={() => startEditing(member.user_id, 'bus')}
                        >
                          {(member.assigned_qbo_class_ids || []).length > 0 ? (
                            (member.assigned_qbo_class_ids || []).map(id => {
                              const bu = businessUnits?.find(b => b.id === id);
                              return bu ? (
                                <span
                                  key={id}
                                  className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded"
                                >
                                  {bu.name}
                                </span>
                              ) : null;
                            })
                          ) : (
                            <span className="text-xs text-gray-400 group-hover:text-gray-600">
                              Click to assign...
                            </span>
                          )}
                          <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 ml-1" />
                        </div>
                      )}
                    </td>

                    {/* Aligned Crews - Inline Editable (only for reps) */}
                    <td className="px-4 py-3">
                      {!memberIsRep ? (
                        <span className="text-xs text-gray-400">N/A</span>
                      ) : isEditingCrews ? (
                        <div className="relative">
                          <div className="flex flex-wrap gap-1 mb-2">
                            {editing.selectedIds.map(id => {
                              const crew = crews?.find(c => c.id === id);
                              return crew ? (
                                <span
                                  key={id}
                                  className={`text-xs px-2 py-0.5 rounded inline-flex items-center gap-1 ${
                                    crew.is_subcontractor
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {crew.name}
                                  <button
                                    onClick={() => toggleSelection(id)}
                                    className="hover:opacity-75"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ) : null;
                            })}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <button
                                onClick={() => setDropdownOpen(!dropdownOpen)}
                                className="w-full text-left text-xs border border-gray-300 rounded px-2 py-1 flex items-center justify-between bg-white"
                              >
                                <span className="text-gray-500">Add crew...</span>
                                <ChevronDown className="w-3 h-3 text-gray-400" />
                              </button>
                              {dropdownOpen && (
                                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                                  {crews?.filter(c => c.is_active && !editing.selectedIds.includes(c.id)).map(crew => (
                                    <button
                                      key={crew.id}
                                      onClick={() => {
                                        toggleSelection(crew.id);
                                        setDropdownOpen(false);
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                                    >
                                      {crew.is_subcontractor ? (
                                        <Wrench className="w-3.5 h-3.5 text-blue-500" />
                                      ) : (
                                        <Users className="w-3.5 h-3.5 text-amber-500" />
                                      )}
                                      {crew.name}
                                    </button>
                                  ))}
                                  {crews?.filter(c => c.is_active && !editing.selectedIds.includes(c.id)).length === 0 && (
                                    <div className="px-3 py-2 text-sm text-gray-500">All crews selected</div>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={saveEdit}
                              disabled={setCrewAlignmentsMutation.isPending}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="group flex flex-wrap gap-1 cursor-pointer min-h-[24px] rounded p-1 -m-1 hover:bg-gray-100"
                          onClick={() => startEditing(member.user_id, 'crews')}
                        >
                          {alignedCrews.length > 0 ? (
                            alignedCrews.map(crew => (
                              <span
                                key={crew.id}
                                className={`text-xs px-2 py-0.5 rounded ${
                                  crew.is_subcontractor
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}
                              >
                                {crew.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 group-hover:text-gray-600">
                              Click to align...
                            </span>
                          )}
                          <Edit2 className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 ml-1" />
                        </div>
                      )}
                    </td>

                    {/* Details */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                        {/* Territories */}
                        {member.territories.length > 0 && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            {member.territories.length === 1
                              ? member.territories[0].territory_name
                              : `${member.territories.length} territories`}
                          </span>
                        )}

                        {/* Crew (if crew lead) */}
                        {member.crew_name && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-amber-500" />
                            {member.crew_name}
                          </span>
                        )}

                        {/* Skills */}
                        {member.skills.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Wrench className="w-3.5 h-3.5 text-purple-500" />
                            {member.skills.length} skills
                          </span>
                        )}

                        {/* Work Schedule */}
                        {member.work_schedule.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            {member.work_schedule.map(s => DAY_SHORT_LABELS[s.day]).join(', ')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEdit(member)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit Full Profile"
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
