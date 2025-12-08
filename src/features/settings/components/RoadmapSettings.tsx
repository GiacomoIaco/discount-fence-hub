import { useState, useEffect } from 'react';
import { Plus, Search, Filter, ChevronDown, ChevronUp, Lightbulb, CheckCircle2, Clock, PlayCircle, XCircle, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { useAuth } from '../../../contexts/AuthContext';

interface RoadmapItem {
  id: string;
  code: string;
  hub: string;
  title: string;
  raw_idea: string | null;
  claude_analysis: string | null;
  status: 'idea' | 'researched' | 'approved' | 'in_progress' | 'done' | 'wont_do';
  importance: number | null;
  complexity: 'S' | 'M' | 'L' | 'XL' | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  session_notes: string | null;
}

const HUB_OPTIONS = [
  { value: 'ops-hub', label: 'Ops Hub', prefix: 'O' },
  { value: 'requests', label: 'Requests', prefix: 'R' },
  { value: 'chat', label: 'Chat', prefix: 'C' },
  { value: 'analytics', label: 'Analytics', prefix: 'A' },
  { value: 'settings', label: 'Settings', prefix: 'S' },
  { value: 'general', label: 'General', prefix: 'G' },
  { value: 'leadership', label: 'Leadership', prefix: 'L' },
];

const STATUS_OPTIONS = [
  { value: 'idea', label: 'Idea', icon: Lightbulb, color: 'text-yellow-600 bg-yellow-50' },
  { value: 'researched', label: 'Researched', icon: Sparkles, color: 'text-purple-600 bg-purple-50' },
  { value: 'approved', label: 'Approved', icon: CheckCircle2, color: 'text-blue-600 bg-blue-50' },
  { value: 'in_progress', label: 'In Progress', icon: PlayCircle, color: 'text-orange-600 bg-orange-50' },
  { value: 'done', label: 'Done', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  { value: 'wont_do', label: "Won't Do", icon: XCircle, color: 'text-gray-600 bg-gray-50' },
];

export default function RoadmapSettings() {
  const { user } = useAuth();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterHub, setFilterHub] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New item form
  const [newItem, setNewItem] = useState({
    hub: 'general',
    title: '',
    raw_idea: '',
    importance: 3,
    complexity: 'M' as 'S' | 'M' | 'L' | 'XL',
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('roadmap_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error loading roadmap items:', error);
      showError('Failed to load roadmap items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.title.trim()) {
      showError('Title is required');
      return;
    }

    try {
      const { error } = await supabase
        .from('roadmap_items')
        .insert({
          hub: newItem.hub,
          title: newItem.title.trim(),
          raw_idea: newItem.raw_idea.trim() || null,
          importance: newItem.importance,
          complexity: newItem.complexity,
          created_by: user?.id,
        });

      if (error) throw error;

      showSuccess('Idea added to roadmap');
      setShowAddModal(false);
      setNewItem({ hub: 'general', title: '', raw_idea: '', importance: 3, complexity: 'M' });
      loadItems();
    } catch (error) {
      console.error('Error adding item:', error);
      showError('Failed to add item');
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('roadmap_items')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      showSuccess('Status updated');
      loadItems();
    } catch (error) {
      console.error('Error updating status:', error);
      showError('Failed to update status');
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.raw_idea?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesHub = filterHub === 'all' || item.hub === filterHub;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

    return matchesSearch && matchesHub && matchesStatus;
  });

  // Group by status for summary
  const statusCounts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getStatusConfig = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

  const getHubLabel = (hub: string) => {
    return HUB_OPTIONS.find(h => h.value === hub)?.label || hub;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <div className="text-gray-600">Loading roadmap...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Roadmap</h2>
            <p className="text-sm text-gray-600 mt-1">
              Track ideas, planned features, and completed work. Reference items by code (e.g., O-001).
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Idea
          </button>
        </div>

        {/* Status Summary */}
        <div className="flex gap-4 flex-wrap">
          {STATUS_OPTIONS.filter(s => s.value !== 'wont_do').map(status => {
            const Icon = status.icon;
            const count = statusCounts[status.value] || 0;
            return (
              <button
                key={status.value}
                onClick={() => setFilterStatus(filterStatus === status.value ? 'all' : status.value)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                  filterStatus === status.value ? status.color + ' ring-2 ring-offset-1' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{count}</span>
                <span className="text-sm">{status.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-4 flex-wrap items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code, title, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Hub Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterHub}
              onChange={(e) => setFilterHub(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Hubs</option>
              {HUB_OPTIONS.map(hub => (
                <option key={hub.value} value={hub.value}>{hub.label}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters */}
          {(filterHub !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterHub('all');
                setFilterStatus('all');
                setSearchQuery('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Items List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No items found</p>
            <p className="text-sm text-gray-500 mt-1">Add your first idea to get started</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const statusConfig = getStatusConfig(item.status);
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Header Row */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Code Badge */}
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-900 text-white font-mono text-sm font-bold">
                        {item.code}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{item.title}</h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {getHubLabel(item.hub)}
                        </span>
                      </div>
                      {item.raw_idea && (
                        <p className="text-sm text-gray-600 line-clamp-2">{item.raw_idea}</p>
                      )}
                    </div>

                    {/* Status & Scores */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {item.importance && (
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Imp</div>
                          <div className="font-bold text-gray-900">{item.importance}</div>
                        </div>
                      )}
                      {item.complexity && (
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Size</div>
                          <div className="font-bold text-gray-900">{item.complexity}</div>
                        </div>
                      )}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusConfig.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{statusConfig.label}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Raw Idea */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Raw Idea</h4>
                        <div className="bg-white rounded-lg border border-gray-200 p-3 min-h-[100px]">
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {item.raw_idea || 'No description yet'}
                          </p>
                        </div>
                      </div>

                      {/* Claude Analysis */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          Claude Analysis
                        </h4>
                        <div className="bg-white rounded-lg border border-gray-200 p-3 min-h-[100px]">
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">
                            {item.claude_analysis || 'Not yet analyzed. Ask Claude to expand on this idea.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Session Notes */}
                    {item.session_notes && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Session Notes</h4>
                        <div className="bg-white rounded-lg border border-gray-200 p-3">
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.session_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Status:</span>
                        <select
                          value={item.status}
                          onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                          className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        >
                          {STATUS_OPTIONS.map(status => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        Created {new Date(item.created_at).toLocaleDateString()}
                        {item.completed_at && (
                          <span className="text-green-600">
                            | Completed {new Date(item.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Add New Idea</h3>
              <p className="text-sm text-gray-600 mt-1">Capture a quick idea - you can expand it later</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Hub */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hub/Section</label>
                <select
                  value={newItem.hub}
                  onChange={(e) => setNewItem({ ...newItem, hub: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  {HUB_OPTIONS.map(hub => (
                    <option key={hub.value} value={hub.value}>
                      {hub.prefix} - {hub.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  placeholder="Brief title for the idea"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Raw Idea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea
                  value={newItem.raw_idea}
                  onChange={(e) => setNewItem({ ...newItem, raw_idea: e.target.value })}
                  placeholder="Quick brain dump - don't worry about formatting"
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Importance & Complexity */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Importance (1-5)</label>
                  <select
                    value={newItem.importance}
                    onChange={(e) => setNewItem({ ...newItem, importance: parseInt(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 - Nice to have</option>
                    <option value={2}>2 - Low</option>
                    <option value={3}>3 - Medium</option>
                    <option value={4}>4 - High</option>
                    <option value={5}>5 - Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Complexity</label>
                  <select
                    value={newItem.complexity}
                    onChange={(e) => setNewItem({ ...newItem, complexity: e.target.value as 'S' | 'M' | 'L' | 'XL' })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="S">S - Hours</option>
                    <option value="M">M - Day</option>
                    <option value="L">L - Days</option>
                    <option value="XL">XL - Week+</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Idea
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
