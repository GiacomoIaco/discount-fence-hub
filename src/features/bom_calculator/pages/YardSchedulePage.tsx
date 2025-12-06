import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Search,
  Loader2,
  Package,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Camera,
  MoreVertical,
  Users,
  Layers,
  Eye,
  RotateCcw,
  Copy,
  Play,
  User,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { fetchAndGeneratePickListPDF } from '../components/PickListPDF';
import CrewSignoffModal from '../components/CrewSignoffModal';
import PickListViewer from '../components/PickListViewer';

// Types
interface Yard {
  id: string;
  code: string;
  name: string;
  city: string;
}

interface YardSpot {
  id: string;
  yard_id: string;
  spot_code: string;
  spot_name: string | null;
  is_occupied: boolean;
  occupied_by_project_id: string | null;
}

interface YardWorker {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface ScheduledPickup {
  id: string;
  project_code: string;
  project_name: string;
  customer_name: string | null;
  customer_address: string | null;
  expected_pickup_date: string | null;
  status: string;
  crew_name: string | null;
  is_bundle: boolean;
  bundle_name: string | null;
  partial_pickup: boolean;
  partial_pickup_notes: string | null;
  yard_spot_id: string | null;
  total_linear_feet: number | null;
  yard_id: string | null;
  yard_code: string | null;
  yard_name: string | null;
  spot_code: string | null;
  spot_name: string | null;
  bundle_project_count: number | null;
  bundle_projects: Array<{
    id: string;
    project_code: string;
    project_name: string;
    customer_name: string | null;
  }> | null;
  // Claim fields
  claimed_by: string | null;
  claimed_at: string | null;
  claimed_by_name: string | null;
  claimed_by_email: string | null;
  picking_started_at: string | null;
  pick_progress: { total: number; picked: number } | null;
}

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ReactNode }> = {
  sent_to_yard: { label: 'To Stage', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: <Clock className="w-4 h-4" /> },
  picking: { label: 'Picking', color: 'text-orange-700', bgColor: 'bg-orange-100', icon: <Play className="w-4 h-4" /> },
  staged: { label: 'Staged', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: <MapPin className="w-4 h-4" /> },
  loaded: { label: 'Loaded', color: 'text-green-700', bgColor: 'bg-green-100', icon: <Truck className="w-4 h-4" /> },
  completed: { label: 'Complete', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: <CheckCircle2 className="w-4 h-4" /> },
  ready: { label: 'Ready', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: <Package className="w-4 h-4" /> },
};

// Date filter options
const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'week', label: 'This Week' },
  { value: 'all', label: 'All Scheduled' },
];

export default function YardSchedulePage() {
  const queryClient = useQueryClient();
  const [selectedYardId, setSelectedYardId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [signoffPickup, setSignoffPickup] = useState<ScheduledPickup | null>(null);
  const [viewerPickup, setViewerPickup] = useState<ScheduledPickup | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle print pick list
  const handlePrintPickList = async (projectId: string) => {
    setPrintingId(projectId);
    try {
      await fetchAndGeneratePickListPDF(projectId, supabase, 3);
      showSuccess('Pick list PDF generated (3 copies)');
    } catch (err: any) {
      showError(err.message || 'Failed to generate pick list');
    } finally {
      setPrintingId(null);
    }
  };

  // Fetch yards
  const { data: yards = [] } = useQuery({
    queryKey: ['yards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yards')
        .select('*')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data as Yard[];
    },
  });

  // Fetch yard spots for assignment
  const { data: yardSpots = [] } = useQuery({
    queryKey: ['yard-spots', selectedYardId],
    queryFn: async () => {
      let query = supabase
        .from('yard_spots')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (selectedYardId !== 'all') {
        query = query.eq('yard_id', selectedYardId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as YardSpot[];
    },
  });

  // Fetch yard workers for assignment (operations role or all active users)
  const { data: yardWorkers = [] } = useQuery({
    queryKey: ['yard-workers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      return data as YardWorker[];
    },
  });

  // Fetch scheduled pickups from the view
  const { data: pickups = [], isLoading: loadingPickups } = useQuery({
    queryKey: ['yard-schedule', selectedYardId, dateFilter],
    queryFn: async () => {
      let query = supabase
        .from('v_yard_schedule')
        .select('*')
        .order('expected_pickup_date', { ascending: true, nullsFirst: false })
        .order('project_code');

      // Filter by yard
      if (selectedYardId !== 'all') {
        query = query.eq('yard_id', selectedYardId);
      }

      // Filter by date
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      switch (dateFilter) {
        case 'today':
          query = query.eq('expected_pickup_date', todayStr);
          break;
        case 'tomorrow':
          query = query.eq('expected_pickup_date', tomorrowStr);
          break;
        case 'week':
          query = query.gte('expected_pickup_date', todayStr).lte('expected_pickup_date', weekEndStr);
          break;
        // 'all' - no date filter
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ScheduledPickup[];
    },
  });

  // Filter pickups by status and search
  const filteredPickups = useMemo(() => {
    let filtered = pickups;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.project_code?.toLowerCase().includes(q) ||
        p.project_name?.toLowerCase().includes(q) ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.crew_name?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [pickups, statusFilter, searchQuery]);

  // Group by status for summary
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      sent_to_yard: 0,
      picking: 0,
      staged: 0,
      loaded: 0,
      ready: 0,
    };
    pickups.forEach(p => {
      if (counts[p.status] !== undefined) {
        counts[p.status]++;
      }
    });
    return counts;
  }, [pickups]);

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ projectId, newStatus, spotId }: { projectId: string; newStatus: string; spotId?: string }) => {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'staged' && spotId) {
        updates.yard_spot_id = spotId;
        // Also update the spot
        await supabase.rpc('assign_project_to_spot', {
          p_project_id: projectId,
          p_spot_id: spotId,
        });
      }

      if (newStatus === 'staged') {
        updates.staged_at = new Date().toISOString();
      } else if (newStatus === 'loaded') {
        updates.loaded_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bom_projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['yard-spots'] });
      showSuccess('Status updated');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to update status');
    },
  });

  // Assign worker mutation
  const assignWorkerMutation = useMutation({
    mutationFn: async ({ projectId, workerId }: { projectId: string; workerId: string | null }) => {
      const updates: Record<string, unknown> = {
        claimed_by: workerId,
        claimed_at: workerId ? new Date().toISOString() : null,
        status: workerId ? 'picking' : 'sent_to_yard',
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('bom_projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-schedule'] });
      showSuccess('Worker assigned');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to assign worker');
    },
  });

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Not scheduled';
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) return 'Today';
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Pick Lists</h1>
              <p className="text-xs text-gray-500">Manage scheduled material pickups</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-2">
            {Object.entries(STATUS_CONFIG).slice(0, 4).map(([status, config]) => (
              <div
                key={status}
                className={`px-3 py-1.5 rounded-lg ${config.bgColor} flex items-center gap-2`}
              >
                <span className={config.color}>{config.icon}</span>
                <span className={`text-sm font-semibold ${config.color}`}>
                  {statusCounts[status] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex items-center gap-3 mt-3">
          {/* Yard Filter */}
          <select
            value={selectedYardId}
            onChange={(e) => setSelectedYardId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="all">All Yards</option>
            {yards.map(yard => (
              <option key={yard.id} value={yard.id}>{yard.code} - {yard.name}</option>
            ))}
          </select>

          {/* Date Filter */}
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            {DATE_FILTERS.map(filter => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  dateFilter === filter.value
                    ? 'bg-amber-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([status, config]) => (
              <option key={status} value={status}>{config.label}</option>
            ))}
          </select>

          {/* Search */}
          <div className="flex-1 max-w-xs relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loadingPickups ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
          </div>
        ) : filteredPickups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Package className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-lg font-medium">No pickups found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredPickups.map(pickup => {
              const statusConfig = STATUS_CONFIG[pickup.status] || STATUS_CONFIG.ready;

              return (
                <div
                  key={pickup.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      {/* Left: Project Info */}
                      <div className="flex items-start gap-4">
                        {/* Large Project Code */}
                        <div className="w-24 h-16 bg-gray-900 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-white font-mono font-bold text-lg tracking-wider">
                            {pickup.project_code || '---'}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{pickup.project_name}</h3>
                            {pickup.is_bundle && (
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                Bundle ({pickup.bundle_project_count})
                              </span>
                            )}
                          </div>
                          {pickup.customer_name && (
                            <p className="text-sm text-gray-600">{pickup.customer_name}</p>
                          )}
                          {pickup.customer_address && (
                            <p className="text-xs text-gray-400 mt-0.5">{pickup.customer_address}</p>
                          )}

                          {/* Bundle projects list */}
                          {pickup.is_bundle && pickup.bundle_projects && (
                            <div className="mt-2 text-xs text-gray-500">
                              <span className="font-medium">Includes: </span>
                              {pickup.bundle_projects.map(p => p.project_code).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Status & Actions */}
                      <div className="flex items-start gap-3">
                        {/* Metadata */}
                        <div className="text-right text-sm">
                          <div className="flex items-center gap-1 text-gray-600 justify-end">
                            <CalendarDays className="w-4 h-4" />
                            <span>{formatDate(pickup.expected_pickup_date)}</span>
                          </div>
                          {pickup.crew_name && (
                            <div className="flex items-center gap-1 text-gray-500 justify-end mt-1">
                              <Users className="w-3.5 h-3.5" />
                              <span className="text-xs">{pickup.crew_name}</span>
                            </div>
                          )}
                          {pickup.claimed_by_name && (
                            <div className="flex items-center gap-1 text-orange-600 justify-end mt-1">
                              <User className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">{pickup.claimed_by_name}</span>
                              {pickup.pick_progress && pickup.pick_progress.total > 0 && (
                                <span className="text-xs">
                                  ({pickup.pick_progress.picked}/{pickup.pick_progress.total})
                                </span>
                              )}
                            </div>
                          )}
                          {pickup.spot_code && (
                            <div className="flex items-center gap-1 text-blue-600 justify-end mt-1">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="text-xs font-medium">Spot {pickup.spot_code}</span>
                            </div>
                          )}
                          {pickup.total_linear_feet && (
                            <div className="text-xs text-gray-400 mt-1">
                              {pickup.total_linear_feet.toLocaleString()} LF
                            </div>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className={`px-3 py-1.5 rounded-lg ${statusConfig.bgColor} flex items-center gap-1.5`}>
                          <span className={statusConfig.color}>{statusConfig.icon}</span>
                          <span className={`text-sm font-medium ${statusConfig.color}`}>
                            {statusConfig.label}
                          </span>
                        </div>

                        {/* Actions Menu */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewerPickup(pickup)}
                            className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="View Pick List"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintPickList(pickup.id)}
                            disabled={printingId === pickup.id}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Print Pick List (3 copies)"
                          >
                            {printingId === pickup.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Printer className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setSignoffPickup(pickup)}
                            className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Capture Sign-off"
                          >
                            <Camera className="w-4 h-4" />
                          </button>

                          {/* 3-dot menu */}
                          <div className="relative" ref={openMenuId === pickup.id ? menuRef : undefined}>
                            <button
                              onClick={() => setOpenMenuId(openMenuId === pickup.id ? null : pickup.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {openMenuId === pickup.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                <button
                                  onClick={() => {
                                    setViewerPickup(pickup);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Eye className="w-4 h-4" />
                                  View Pick List
                                </button>
                                <button
                                  onClick={() => {
                                    handlePrintPickList(pickup.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Printer className="w-4 h-4" />
                                  Print PDF (3 copies)
                                </button>
                                <button
                                  onClick={() => {
                                    setSignoffPickup(pickup);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Camera className="w-4 h-4" />
                                  Crew Sign-off
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(pickup.project_code || '');
                                    showSuccess('Project code copied');
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  <Copy className="w-4 h-4" />
                                  Copy Project Code
                                </button>
                                {pickup.status === 'completed' && (
                                  <button
                                    onClick={() => {
                                      updateStatusMutation.mutate({ projectId: pickup.id, newStatus: 'loaded' });
                                      setOpenMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                    Revert to Loaded
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Change Buttons */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                      {/* Assign Worker - available for sent_to_yard and picking status */}
                      {(pickup.status === 'sent_to_yard' || pickup.status === 'picking') && (
                        <select
                          value={pickup.claimed_by || ''}
                          onChange={(e) => {
                            assignWorkerMutation.mutate({
                              projectId: pickup.id,
                              workerId: e.target.value || null,
                            });
                          }}
                          className="px-2 py-1 text-xs border border-orange-300 rounded bg-orange-50 text-orange-800"
                        >
                          <option value="">Assign worker...</option>
                          {yardWorkers.map(worker => (
                            <option key={worker.id} value={worker.id}>
                              {worker.full_name || worker.email}
                            </option>
                          ))}
                        </select>
                      )}

                      {pickup.status === 'sent_to_yard' && (
                        <select
                          className="px-2 py-1 text-xs border border-gray-300 rounded"
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) {
                              updateStatusMutation.mutate({
                                projectId: pickup.id,
                                newStatus: 'staged',
                                spotId: e.target.value,
                              });
                            }
                          }}
                        >
                          <option value="">Assign spot & mark staged...</option>
                          {yardSpots
                            .filter(s => s.yard_id === pickup.yard_id && !s.is_occupied)
                            .map(spot => (
                              <option key={spot.id} value={spot.id}>
                                Spot {spot.spot_code} {spot.spot_name ? `(${spot.spot_name})` : ''}
                              </option>
                            ))}
                        </select>
                      )}
                      {pickup.status === 'staged' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ projectId: pickup.id, newStatus: 'loaded' })}
                          className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors flex items-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Mark Loaded
                        </button>
                      )}
                      {pickup.status === 'loaded' && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ projectId: pickup.id, newStatus: 'completed' })}
                          className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Complete
                        </button>
                      )}

                      {pickup.partial_pickup && (
                        <span className="ml-auto px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Partial Pickup
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crew Sign-off Modal */}
      {signoffPickup && (
        <CrewSignoffModal
          projectId={signoffPickup.id}
          projectCode={signoffPickup.project_code}
          projectName={signoffPickup.project_name}
          onClose={() => setSignoffPickup(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['yard-schedule'] });
          }}
        />
      )}

      {/* Pick List Viewer Modal */}
      {viewerPickup && (
        <PickListViewer
          projectId={viewerPickup.id}
          projectCode={viewerPickup.project_code || '---'}
          projectName={viewerPickup.project_name}
          isBundle={viewerPickup.is_bundle}
          onClose={() => setViewerPickup(null)}
        />
      )}
    </div>
  );
}
