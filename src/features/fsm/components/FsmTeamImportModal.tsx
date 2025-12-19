import { useState, useCallback } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { useTeamMembers } from '../../settings/hooks/useTeamMembers';
import type { FsmRole } from '../types';
import { FSM_ROLE_LABELS } from '../types';

interface Props {
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  email: string;
  roles: FsmRole[];
  maxAssessments: number;
  isActive: boolean;
  // Validation state
  isValid: boolean;
  errors: string[];
  existingUserId?: string;
}

const VALID_ROLES: FsmRole[] = ['rep', 'project_manager', 'crew_lead', 'dispatcher', 'manager'];

export default function FsmTeamImportModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const { data: existingMembers } = useTeamMembers();

  const [step, setStep] = useState<'input' | 'preview' | 'importing' | 'done'>('input');
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  });

  // Parse roles from comma-separated string
  const parseRoles = (roleStr: string): FsmRole[] => {
    if (!roleStr) return ['rep']; // Default role
    const roles = roleStr.toLowerCase().split(/[,;]/).map(r => r.trim());
    return roles
      .map(r => {
        // Normalize role names
        if (r === 'sales rep' || r === 'sales' || r === 'rep') return 'rep';
        if (r === 'pm' || r === 'project manager' || r === 'project_manager') return 'project_manager';
        if (r === 'crew lead' || r === 'lead' || r === 'crew_lead') return 'crew_lead';
        if (r === 'dispatch' || r === 'dispatcher') return 'dispatcher';
        if (r === 'manager' || r === 'mgr') return 'manager';
        return r as FsmRole;
      })
      .filter(r => VALID_ROLES.includes(r));
  };

  // Parse CSV/TSV text
  const parseText = useCallback((text: string): ParsedRow[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Detect delimiter (tab or comma)
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    // Check if first row is header
    const firstRowLower = firstLine.toLowerCase();
    const hasHeader = firstRowLower.includes('name') || firstRowLower.includes('email');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    // Create email lookup for existing members
    const existingByEmail = new Map(
      (existingMembers || []).map(m => [m.email.toLowerCase(), m])
    );

    return dataLines.map(line => {
      const cols = line.split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));

      const name = cols[0] || '';
      const email = cols[1] || '';
      const rolesStr = cols[2] || '';
      const maxAssessments = parseInt(cols[3] || '5', 10) || 5;
      const isActive = cols[4]?.toLowerCase() !== 'false' && cols[4]?.toLowerCase() !== 'no';

      const roles = parseRoles(rolesStr);
      const errors: string[] = [];

      // Validation
      if (!name.trim()) errors.push('Name is required');
      if (!email.trim()) errors.push('Email is required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
      if (roles.length === 0) errors.push('At least one valid role is required');

      // Check for existing user
      const existingUser = existingByEmail.get(email.toLowerCase());

      return {
        name,
        email,
        roles,
        maxAssessments,
        isActive,
        isValid: errors.length === 0,
        errors,
        existingUserId: existingUser?.user_id,
      };
    });
  }, [existingMembers]);

  // Handle file drop/select
  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRawText(text);
      const rows = parseText(text);
      setParsedRows(rows);
      setStep('preview');
    };
    reader.readAsText(file);
  }, [parseText]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      handleFile(file);
    }
  }, [handleFile]);

  const handleParse = () => {
    const rows = parseText(rawText);
    setParsedRows(rows);
    setStep('preview');
  };

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      const validRows = rows.filter(r => r.isValid);
      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (const row of validRows) {
        try {
          let userId = row.existingUserId;

          // If no existing user, create one
          if (!userId) {
            const { data: newUser, error: userError } = await supabase
              .from('user_profiles')
              .insert({
                email: row.email.toLowerCase(),
                full_name: row.name,
                role: 'team_member',
                is_active: row.isActive,
              })
              .select('id')
              .single();

            if (userError) {
              if (userError.code === '23505') {
                // Duplicate email - try to find existing
                const { data: existing } = await supabase
                  .from('user_profiles')
                  .select('id')
                  .eq('email', row.email.toLowerCase())
                  .single();
                if (existing) {
                  userId = existing.id;
                } else {
                  throw userError;
                }
              } else {
                throw userError;
              }
            } else {
              userId = newUser.id;
            }
          }

          // Check if FSM profile already exists
          const { data: existingProfile } = await supabase
            .from('fsm_team_profiles')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

          if (existingProfile) {
            // Update existing profile
            const { error: updateError } = await supabase
              .from('fsm_team_profiles')
              .update({
                fsm_roles: row.roles,
                max_daily_assessments: row.maxAssessments,
                is_active: row.isActive,
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', userId);

            if (updateError) throw updateError;
          } else {
            // Create new FSM profile
            const { error: profileError } = await supabase
              .from('fsm_team_profiles')
              .insert({
                user_id: userId,
                fsm_roles: row.roles,
                assigned_qbo_class_ids: [],
                max_daily_assessments: row.maxAssessments,
                is_active: row.isActive,
              });

            if (profileError) throw profileError;
          }

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${row.email}: ${error.message || 'Unknown error'}`);
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setImportResults(results);
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['fsm_team_profiles'] });
      queryClient.invalidateQueries({ queryKey: ['fsm_team_full'] });
      queryClient.invalidateQueries({ queryKey: ['team_members'] });
      if (results.success > 0) {
        showSuccess(`Imported ${results.success} team member(s)`);
      }
    },
    onError: (error: Error) => {
      showError(error.message || 'Import failed');
    },
  });

  const handleImport = () => {
    setStep('importing');
    importMutation.mutate(parsedRows);
  };

  const validCount = parsedRows.filter(r => r.isValid).length;
  const invalidCount = parsedRows.filter(r => !r.isValid).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Import Team Members</h2>
              <p className="text-sm text-gray-500">Upload CSV or paste data</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'input' && (
            <div className="space-y-6">
              {/* Format info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Expected Format</h3>
                <p className="text-sm text-blue-700 mb-2">
                  CSV or tab-separated with columns: Name, Email, Roles, Max Assessments, Active
                </p>
                <div className="bg-white rounded p-2 text-xs font-mono text-gray-600">
                  <div>John Smith, john@company.com, rep, 5, true</div>
                  <div>Jane Doe, jane@company.com, "rep, project_manager", 3, true</div>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Roles: rep, project_manager, crew_lead, dispatcher, manager
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 hover:bg-green-50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Drop a CSV file here or click to browse</p>
                <p className="text-sm text-gray-400">Supports .csv and .txt files</p>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {/* Or paste */}
              <div className="relative">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="px-3 text-sm text-gray-400 bg-white">or paste data</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your data here..."
                className="w-full h-40 px-4 py-3 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />

              <button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Parse & Preview
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">{validCount} valid</span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">{invalidCount} with errors</span>
                  </div>
                )}
              </div>

              {/* Preview table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Email</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Roles</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">Max Assess.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className={row.isValid ? '' : 'bg-red-50'}>
                        <td className="px-4 py-2">
                          {row.isValid ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              {row.existingUserId ? 'Update' : 'New'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600" title={row.errors.join(', ')}>
                              <AlertCircle className="w-4 h-4" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-medium">{row.name || '-'}</td>
                        <td className="px-4 py-2 text-gray-600">{row.email || '-'}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {row.roles.map(role => (
                              <span key={role} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                {FSM_ROLE_LABELS[role]}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-gray-600">{row.maxAssessments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    setStep('input');
                    setParsedRows([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={validCount === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Import {validCount} Team Member{validCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mb-4" />
              <p className="text-gray-600">Importing team members...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6">
              {/* Results summary */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <User className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Complete</h3>
                <p className="text-gray-600">
                  Successfully imported {importResults.success} team member{importResults.success !== 1 ? 's' : ''}
                  {importResults.failed > 0 && `, ${importResults.failed} failed`}
                </p>
              </div>

              {/* Errors if any */}
              {importResults.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-2">Errors</h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {importResults.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
