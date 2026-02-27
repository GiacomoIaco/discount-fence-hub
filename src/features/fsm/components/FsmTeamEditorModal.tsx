import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import {
  useCreateFsmTeamProfile,
  useUpdateFsmTeamProfile,
  useFsmTeamProfile,
  useTerritories,
  useProjectTypes,
  useCrews,
} from '../hooks';
import type {
  FsmTeamMember,
  FsmTeamProfileFormData,
  FsmRole,
  DayOfWeek,
  SkillProficiency,
} from '../types';
import {
  FSM_ROLE_LABELS,
  DAY_LABELS,
  DAY_SHORT_LABELS,
  PROFICIENCY_LABELS,
} from '../types';
import { useQboClasses } from '../../client_hub/hooks/useQboClasses';
import { useTeamMembers } from '../../settings/hooks/useTeamMembers';

interface FsmTeamEditorModalProps {
  member: FsmTeamMember | null;
  onClose: () => void;
}

const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const ALL_ROLES: FsmRole[] = ['rep', 'project_manager', 'crew_lead', 'dispatcher', 'manager'];
const ALL_PROFICIENCIES: SkillProficiency[] = ['trainee', 'basic', 'standard', 'expert'];

export default function FsmTeamEditorModal({ member, onClose }: FsmTeamEditorModalProps) {
  const { data: qboClasses } = useQboClasses(true); // Only show selectable classes
  const { data: territories } = useTerritories();
  const { data: projectTypes } = useProjectTypes();
  const { data: crews } = useCrews();
  const { data: existingProfile } = useFsmTeamProfile(member?.user_id);
  const { data: teamMembers } = useTeamMembers();

  const createMutation = useCreateFsmTeamProfile();
  const updateMutation = useUpdateFsmTeamProfile();

  const [formData, setFormData] = useState<FsmTeamProfileFormData>({
    user_id: '',
    fsm_roles: [],
    assigned_qbo_class_ids: [],
    max_daily_assessments: 4,
    crew_id: '',
    is_active: true,
    territory_coverage: [],
    work_schedule: [],
    skills: [],
    jobber_salesperson_names: [],
  });

  const [activeSection, setActiveSection] = useState<'basic' | 'territories' | 'schedule' | 'skills'>('basic');

  useEffect(() => {
    if (member && existingProfile) {
      setFormData({
        user_id: member.user_id,
        fsm_roles: member.fsm_roles,
        assigned_qbo_class_ids: member.assigned_qbo_class_ids || [],
        max_daily_assessments: member.max_daily_assessments,
        crew_id: member.crew_id || '',
        is_active: member.is_active,
        territory_coverage: existingProfile.territories?.map(t => ({
          territory_id: t.territory_id,
          coverage_days: t.coverage_days || [],
          is_primary: t.is_primary,
        })) || [],
        work_schedule: existingProfile.schedule?.map(s => ({
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
        })) || [],
        skills: existingProfile.skills?.map(s => ({
          project_type_id: s.project_type_id,
          proficiency: s.proficiency,
        })) || [],
        jobber_salesperson_names: member.jobber_salesperson_names || [],
      });
    }
  }, [member, existingProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.user_id || formData.fsm_roles.length === 0) {
      return;
    }

    try {
      if (member) {
        await updateMutation.mutateAsync({ userId: member.user_id, data: formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onClose();
    } catch {
      // Error handled by mutation
    }
  };

  const toggleRole = (role: FsmRole) => {
    setFormData(prev => ({
      ...prev,
      fsm_roles: prev.fsm_roles.includes(role)
        ? prev.fsm_roles.filter(r => r !== role)
        : [...prev.fsm_roles, role],
    }));
  };

  const toggleQboClass = (qboClassId: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_qbo_class_ids: prev.assigned_qbo_class_ids.includes(qboClassId)
        ? prev.assigned_qbo_class_ids.filter(id => id !== qboClassId)
        : [...prev.assigned_qbo_class_ids, qboClassId],
    }));
  };

  const addTerritory = () => {
    setFormData(prev => ({
      ...prev,
      territory_coverage: [...prev.territory_coverage, { territory_id: '', coverage_days: [], is_primary: false }],
    }));
  };

  const removeTerritory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      territory_coverage: prev.territory_coverage.filter((_, i) => i !== index),
    }));
  };

  const updateTerritory = (index: number, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      territory_coverage: prev.territory_coverage.map((t, i) =>
        i === index ? { ...t, [field]: value } : t
      ),
    }));
  };

  const toggleWorkDay = (day: DayOfWeek) => {
    setFormData(prev => {
      const existing = prev.work_schedule.find(s => s.day_of_week === day);
      if (existing) {
        return {
          ...prev,
          work_schedule: prev.work_schedule.filter(s => s.day_of_week !== day),
        };
      }
      return {
        ...prev,
        work_schedule: [...prev.work_schedule, { day_of_week: day, start_time: '08:00', end_time: '18:00' }],
      };
    });
  };

  const updateWorkTime = (day: DayOfWeek, field: 'start_time' | 'end_time', value: string) => {
    setFormData(prev => ({
      ...prev,
      work_schedule: prev.work_schedule.map(s =>
        s.day_of_week === day ? { ...s, [field]: value } : s
      ),
    }));
  };

  const addSkill = () => {
    setFormData(prev => ({
      ...prev,
      skills: [...prev.skills, { project_type_id: '', proficiency: 'standard' as SkillProficiency }],
    }));
  };

  const removeSkill = (index: number) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  const updateSkill = (index: number, field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      ),
    }));
  };

  // Filter out users who already have FSM profiles (except current member)
  const availableUsers = teamMembers?.filter(tm =>
    !member || tm.user_id === member.user_id
  ) || [];

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">
            {member ? 'Edit FSM Profile' : 'New FSM Team Member'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 px-4 pt-3 border-b flex-shrink-0">
          {(['basic', 'territories', 'schedule', 'skills'] as const).map(section => (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 -mb-px ${
                activeSection === section
                  ? 'border-green-600 text-green-700 bg-green-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {section === 'basic' && 'Basic Info'}
              {section === 'territories' && `Territories (${formData.territory_coverage.length})`}
              {section === 'schedule' && `Schedule (${formData.work_schedule.length})`}
              {section === 'skills' && `Skills (${formData.skills.length})`}
            </button>
          ))}
        </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-4">
            {/* Basic Info Section */}
            {activeSection === 'basic' && (
              <div className="space-y-4">
                {/* User Selection */}
                {!member && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Member *
                    </label>
                    <select
                      value={formData.user_id}
                      onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="">Select team member...</option>
                      {availableUsers.map(tm => (
                        <option key={tm.user_id} value={tm.user_id}>
                          {tm.full_name || tm.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* FSM Roles */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    FSM Roles *
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_ROLES.map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => toggleRole(role)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          formData.fsm_roles.includes(role)
                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {FSM_ROLE_LABELS[role]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* QBO Classes (Business Units) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    QBO Classes
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {qboClasses?.map(qc => (
                      <button
                        key={qc.id}
                        type="button"
                        onClick={() => toggleQboClass(qc.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          formData.assigned_qbo_class_ids.includes(qc.id)
                            ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {qc.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Crew (for crew_lead role) */}
                {formData.fsm_roles.includes('crew_lead') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assigned Crew
                    </label>
                    <select
                      value={formData.crew_id}
                      onChange={(e) => setFormData({ ...formData, crew_id: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select crew...</option>
                      {crews?.map(crew => (
                        <option key={crew.id} value={crew.id}>
                          {crew.name} ({crew.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Max Daily Assessments (for rep role) */}
                {formData.fsm_roles.includes('rep') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max Daily Assessments
                    </label>
                    <input
                      type="number"
                      value={formData.max_daily_assessments}
                      onChange={(e) => setFormData({ ...formData, max_daily_assessments: parseInt(e.target.value) || 4 })}
                      min={1}
                      max={20}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}

                {/* Active */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Active
                  </label>
                </div>
              </div>
            )}

            {/* Territories Section */}
            {activeSection === 'territories' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">
                  Assign territories this person covers. Optionally restrict to specific days.
                </p>

                {formData.territory_coverage.map((tc, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 space-y-2">
                      <select
                        value={tc.territory_id}
                        onChange={(e) => updateTerritory(index, 'territory_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Select territory...</option>
                        {territories?.map(t => (
                          <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">Days:</span>
                        {ALL_DAYS.map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const days = tc.coverage_days || [];
                              const newDays = days.includes(day)
                                ? days.filter(d => d !== day)
                                : [...days, day];
                              updateTerritory(index, 'coverage_days', newDays);
                            }}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              tc.coverage_days?.includes(day)
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {DAY_SHORT_LABELS[day]}
                          </button>
                        ))}
                        <span className="text-xs text-gray-400 ml-2">
                          (empty = all days)
                        </span>
                      </div>

                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={tc.is_primary}
                          onChange={(e) => updateTerritory(index, 'is_primary', e.target.checked)}
                          className="w-3 h-3 rounded border-gray-300 text-green-600"
                        />
                        Primary territory
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeTerritory(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addTerritory}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Territory
                </button>
              </div>
            )}

            {/* Schedule Section */}
            {activeSection === 'schedule' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">
                  Set working hours for each day.
                </p>

                <div className="space-y-2">
                  {ALL_DAYS.map(day => {
                    const schedule = formData.work_schedule.find(s => s.day_of_week === day);
                    return (
                      <div key={day} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                        <button
                          type="button"
                          onClick={() => toggleWorkDay(day)}
                          className={`w-20 text-left px-2 py-1 rounded text-sm font-medium ${
                            schedule
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {DAY_LABELS[day]}
                        </button>

                        {schedule ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={schedule.start_time}
                              onChange={(e) => updateWorkTime(day, 'start_time', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <span className="text-gray-400">to</span>
                            <input
                              type="time"
                              value={schedule.end_time}
                              onChange={(e) => updateWorkTime(day, 'end_time', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Not working</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skills Section */}
            {activeSection === 'skills' && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">
                  Assign project type skills with proficiency levels.
                </p>

                {formData.skills.map((skill, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <select
                      value={skill.project_type_id}
                      onChange={(e) => updateSkill(index, 'project_type_id', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">Select project type...</option>
                      {projectTypes?.map(pt => (
                        <option key={pt.id} value={pt.id}>
                          {pt.name} ({pt.code})
                        </option>
                      ))}
                    </select>

                    <select
                      value={skill.proficiency}
                      onChange={(e) => updateSkill(index, 'proficiency', e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {ALL_PROFICIENCIES.map(p => (
                        <option key={p} value={p}>{PROFICIENCY_LABELS[p]}</option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => removeSkill(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSkill}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Skill
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 p-4 border-t flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.user_id || formData.fsm_roles.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : member ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
