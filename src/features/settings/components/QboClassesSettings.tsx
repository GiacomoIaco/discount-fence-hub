import { useState } from 'react';
import { RefreshCw, Check, X, ChevronRight, ExternalLink } from 'lucide-react';
import { useQboClasses, useSyncQboClasses, useUpdateQboClassSelectable, useUpdateQboClassDefaultRateSheet } from '../../client_hub/hooks/useQboClasses';
import { useRateSheets } from '../../client_hub/hooks/useRateSheets';

export default function QboClassesSettings() {
  const { data: classes, isLoading } = useQboClasses();
  const { data: rateSheets } = useRateSheets({ is_active: true });
  const syncMutation = useSyncQboClasses();
  const updateSelectableMutation = useUpdateQboClassSelectable();
  const updateDefaultRateSheetMutation = useUpdateQboClassDefaultRateSheet();
  const [expandedParent, setExpandedParent] = useState<string | null>(null);

  // Group classes by parent
  const rootClasses = classes?.filter(c => !c.parent_id) || [];
  const childrenByParent = classes?.reduce((acc, c) => {
    if (c.parent_id) {
      if (!acc[c.parent_id]) acc[c.parent_id] = [];
      acc[c.parent_id].push(c);
    }
    return acc;
  }, {} as Record<string, typeof classes>) || {};

  const handleToggleSelectable = (id: string, current: boolean) => {
    updateSelectableMutation.mutate({ id, isSelectable: !current });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">QuickBooks Classes</h2>
          <p className="text-sm text-gray-500">
            Sync classes from QuickBooks and choose which appear in Client Hub dropdowns.
          </p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync from QBO'}
        </button>
      </div>

      {/* Classes List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 mt-4">Loading classes...</p>
          </div>
        ) : !classes || classes.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-4">No QBO Classes synced yet.</p>
            <p className="text-sm text-gray-500 mb-6">
              Click "Sync from QBO" to fetch classes from QuickBooks.
            </p>
            <a
              href="/.netlify/functions/qbo-auth"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ExternalLink className="w-4 h-4" />
              Connect to QuickBooks first
            </a>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table Header */}
            <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-600">
              <div className="flex-1">Class Name</div>
              <div className="w-56 text-center">Default Rate Sheet</div>
              <div className="w-32 text-center">Selectable</div>
            </div>

            {/* Root Classes */}
            {rootClasses.map(rootClass => {
              const children = childrenByParent[rootClass.id] || [];
              const hasChildren = children.length > 0;
              const isExpanded = expandedParent === rootClass.id;

              return (
                <div key={rootClass.id}>
                  {/* Parent Row */}
                  <div
                    className={`flex items-center gap-4 px-4 py-3 ${hasChildren ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => hasChildren && setExpandedParent(isExpanded ? null : rootClass.id)}
                  >
                    <div className="flex-1 flex items-center gap-2">
                      {hasChildren && (
                        <ChevronRight
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        />
                      )}
                      {!hasChildren && <div className="w-4" />}
                      <span className="font-medium text-gray-900">{rootClass.name}</span>
                      {hasChildren && (
                        <span className="text-xs text-gray-400">({children.length} sub-classes)</span>
                      )}
                    </div>
                    {/* Default Rate Sheet Dropdown */}
                    <div className="w-56">
                      <select
                        value={rootClass.default_rate_sheet_id || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateDefaultRateSheetMutation.mutate({
                            id: rootClass.id,
                            defaultRateSheetId: e.target.value || null,
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        disabled={updateDefaultRateSheetMutation.isPending}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">No default</option>
                        {rateSheets?.map((rs) => (
                          <option key={rs.id} value={rs.id}>
                            {rs.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="w-32 flex justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelectable(rootClass.id, rootClass.is_selectable);
                        }}
                        disabled={updateSelectableMutation.isPending}
                        className={`p-1.5 rounded-lg transition-colors ${
                          rootClass.is_selectable
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                        title={rootClass.is_selectable ? 'Click to hide from dropdowns' : 'Click to show in dropdowns'}
                      >
                        {rootClass.is_selectable ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Children (if expanded) */}
                  {hasChildren && isExpanded && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      {children.map(child => (
                        <div
                          key={child.id}
                          className="flex items-center gap-4 px-4 py-2.5 pl-12 border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex-1">
                            <span className="text-gray-700">{child.name}</span>
                          </div>
                          {/* Default Rate Sheet Dropdown for child */}
                          <div className="w-56">
                            <select
                              value={child.default_rate_sheet_id || ''}
                              onChange={(e) => {
                                updateDefaultRateSheetMutation.mutate({
                                  id: child.id,
                                  defaultRateSheetId: e.target.value || null,
                                });
                              }}
                              disabled={updateDefaultRateSheetMutation.isPending}
                              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                              <option value="">No default</option>
                              {rateSheets?.map((rs) => (
                                <option key={rs.id} value={rs.id}>
                                  {rs.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="w-32 flex justify-center">
                            <button
                              onClick={() => handleToggleSelectable(child.id, child.is_selectable)}
                              disabled={updateSelectableMutation.isPending}
                              className={`p-1.5 rounded-lg transition-colors ${
                                child.is_selectable
                                  ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                              }`}
                              title={child.is_selectable ? 'Click to hide from dropdowns' : 'Click to show in dropdowns'}
                            >
                              {child.is_selectable ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Standalone Classes (no parent, showing for completeness) */}
            {classes.filter(c => c.parent_id && !rootClasses.find(r => r.id === c.parent_id)).map(orphan => (
              <div
                key={orphan.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="flex-1 flex items-center gap-2">
                  <div className="w-4" />
                  <span className="text-gray-700">{orphan.fully_qualified_name || orphan.name}</span>
                </div>
                {/* Default Rate Sheet Dropdown for orphan */}
                <div className="w-56">
                  <select
                    value={orphan.default_rate_sheet_id || ''}
                    onChange={(e) => {
                      updateDefaultRateSheetMutation.mutate({
                        id: orphan.id,
                        defaultRateSheetId: e.target.value || null,
                      });
                    }}
                    disabled={updateDefaultRateSheetMutation.isPending}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">No default</option>
                    {rateSheets?.map((rs) => (
                      <option key={rs.id} value={rs.id}>
                        {rs.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-32 flex justify-center">
                  <button
                    onClick={() => handleToggleSelectable(orphan.id, orphan.is_selectable)}
                    disabled={updateSelectableMutation.isPending}
                    className={`p-1.5 rounded-lg transition-colors ${
                      orphan.is_selectable
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {orphan.is_selectable ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Classes from QuickBooks are used for P&L tracking and reporting</li>
          <li>• <strong>Default Rate Sheet</strong>: Select the fallback pricing for each BU. When a client/community doesn't have a specific rate sheet, this default is used.</li>
          <li>• <strong>Selectable</strong>: Toggle to control which classes appear in Client Hub dropdowns</li>
          <li>• Parent classes (like "Residential") can be hidden if you only want leaf classes visible</li>
          <li>• Syncing will preserve your choices while updating class names</li>
        </ul>
      </div>
    </div>
  );
}
