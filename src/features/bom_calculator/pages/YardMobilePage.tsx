import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  MapPin,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Camera,
  ChevronDown,
  Layers,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Clipboard,
  Play,
  RotateCcw,
  User,
  Eye,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { fetchAndGeneratePickListPDF } from '../components/PickListPDF';
import CrewSignoffModal from '../components/CrewSignoffModal';
import PickListViewer from '../components/PickListViewer';

// Types (same as YardSchedulePage)
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
  picking_started_at: string | null;
  pick_progress: { total: number; picked: number } | null;
}

// Status configuration with mobile-friendly colors
const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  sent_to_yard: { label: 'UNCLAIMED', bgColor: 'bg-amber-500', textColor: 'text-white', icon: <Clock className="w-5 h-5" /> },
  picking: { label: 'PICKING', bgColor: 'bg-orange-500', textColor: 'text-white', icon: <Play className="w-5 h-5" /> },
  staged: { label: 'STAGED', bgColor: 'bg-blue-500', textColor: 'text-white', icon: <MapPin className="w-5 h-5" /> },
  loaded: { label: 'LOADED', bgColor: 'bg-green-500', textColor: 'text-white', icon: <Truck className="w-5 h-5" /> },
  completed: { label: 'DONE', bgColor: 'bg-gray-500', textColor: 'text-white', icon: <CheckCircle2 className="w-5 h-5" /> },
  ready: { label: 'READY', bgColor: 'bg-purple-500', textColor: 'text-white', icon: <Package className="w-5 h-5" /> },
};

interface YardMobilePageProps {
  onBack?: () => void;
}

export default function YardMobilePage({ onBack }: YardMobilePageProps) {
  const queryClient = useQueryClient();
  const [selectedYardId, setSelectedYardId] = useState<string>('');
  const [searchQuery] = useState('');
  const [expandedPickupId, setExpandedPickupId] = useState<string | null>(null);
  const [signoffPickup, setSignoffPickup] = useState<ScheduledPickup | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Claim workflow state
  const [codeInput, setCodeInput] = useState('');
  const [claimModalData, setClaimModalData] = useState<{
    project: ScheduledPickup | null;
    status: 'searching' | 'found' | 'claimed' | 'error';
    error?: string;
    claimedByName?: string;
  } | null>(null);
  const [pickListViewerProject, setPickListViewerProject] = useState<ScheduledPickup | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

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
      // Auto-select first yard
      if (data.length > 0 && !selectedYardId) {
        setSelectedYardId(data[0].id);
      }
      return data as Yard[];
    },
  });

  // Fetch yard spots
  const { data: yardSpots = [] } = useQuery({
    queryKey: ['yard-spots', selectedYardId],
    queryFn: async () => {
      if (!selectedYardId) return [];
      const { data, error } = await supabase
        .from('yard_spots')
        .select('*')
        .eq('yard_id', selectedYardId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as YardSpot[];
    },
    enabled: !!selectedYardId,
  });

  // Fetch today's pickups
  const { data: pickups = [], isLoading, refetch } = useQuery({
    queryKey: ['yard-mobile-schedule', selectedYardId],
    queryFn: async () => {
      if (!selectedYardId) return [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Get all active pickups: sent_to_yard, picking, staged, loaded
      // Include all sent_to_yard regardless of date so workers can see upcoming jobs
      const { data, error } = await supabase
        .from('v_yard_schedule')
        .select('*')
        .eq('yard_id', selectedYardId)
        .in('status', ['sent_to_yard', 'picking', 'staged', 'loaded'])
        .order('expected_pickup_date', { ascending: true, nullsFirst: false })
        .order('status');

      if (error) throw error;
      return data as ScheduledPickup[];
    },
    enabled: !!selectedYardId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch MY claimed jobs (across all yards)
  const { data: myClaimedJobs = [] } = useQuery({
    queryKey: ['my-claimed-jobs', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];

      const { data, error } = await supabase
        .from('v_yard_schedule')
        .select('*')
        .eq('claimed_by', currentUserId)
        .in('status', ['picking', 'staged'])
        .order('claimed_at', { ascending: false });

      if (error) throw error;
      return data as ScheduledPickup[];
    },
    enabled: !!currentUserId,
    refetchInterval: 30000,
  });

  // Filter by search
  const filteredPickups = useMemo(() => {
    if (!searchQuery.trim()) return pickups;
    const q = searchQuery.toLowerCase();
    return pickups.filter(p =>
      p.project_code?.toLowerCase().includes(q) ||
      p.project_name?.toLowerCase().includes(q) ||
      p.customer_name?.toLowerCase().includes(q)
    );
  }, [pickups, searchQuery]);

  // Group pickups by status
  const groupedPickups = useMemo(() => {
    const groups = {
      my_jobs: [] as ScheduledPickup[], // Jobs claimed by me
      unclaimed: [] as ScheduledPickup[], // sent_to_yard (unclaimed)
      others_picking: [] as ScheduledPickup[], // Claimed by others
      action_needed: [] as ScheduledPickup[], // staged
      done: [] as ScheduledPickup[], // loaded, completed
    };

    filteredPickups.forEach(p => {
      if (p.status === 'loaded' || p.status === 'completed') {
        groups.done.push(p);
      } else if (p.status === 'picking') {
        if (p.claimed_by === currentUserId) {
          groups.my_jobs.push(p);
        } else {
          groups.others_picking.push(p);
        }
      } else if (p.status === 'sent_to_yard' && !p.claimed_by) {
        groups.unclaimed.push(p);
      } else if (p.status === 'staged') {
        if (p.claimed_by === currentUserId) {
          groups.my_jobs.push(p);
        } else {
          groups.action_needed.push(p);
        }
      } else {
        groups.action_needed.push(p);
      }
    });

    return groups;
  }, [filteredPickups, currentUserId]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    showSuccess('Refreshed');
  };

  // Handle print
  const handlePrint = async (projectId: string) => {
    setPrintingId(projectId);
    try {
      await fetchAndGeneratePickListPDF(projectId, supabase, 3);
      showSuccess('PDF generated');
    } catch (err: any) {
      showError(err.message || 'Failed');
    } finally {
      setPrintingId(null);
    }
  };

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ projectId, newStatus, spotId }: { projectId: string; newStatus: string; spotId?: string }) => {
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === 'staged' && spotId) {
        updates.yard_spot_id = spotId;
        await supabase.rpc('assign_project_to_spot', {
          p_project_id: projectId,
          p_spot_id: spotId,
        });
        updates.staged_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('bom_projects')
        .update(updates)
        .eq('id', projectId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yard-mobile-schedule'] });
      queryClient.invalidateQueries({ queryKey: ['yard-spots'] });
      queryClient.invalidateQueries({ queryKey: ['my-claimed-jobs'] });
      showSuccess('Updated');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed');
    },
  });

  // Claim project mutation
  const claimProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!currentUserId) throw new Error('Not logged in');

      const { data, error } = await supabase.rpc('claim_project', {
        p_project_id: projectId,
        p_user_id: currentUserId,
      });

      if (error) throw error;
      return data as { success: boolean; message?: string; error?: string; claimed_by_name?: string };
    },
    onSuccess: (data, projectId) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['yard-mobile-schedule'] });
        queryClient.invalidateQueries({ queryKey: ['my-claimed-jobs'] });
        // Find the project and open the pick list
        const project = pickups.find(p => p.id === projectId) || claimModalData?.project;
        if (project) {
          setClaimModalData(null);
          setPickListViewerProject(project);
        }
        showSuccess('Job claimed!');
      } else if (data.error === 'already_claimed') {
        setClaimModalData(prev => prev ? {
          ...prev,
          status: 'error',
          error: 'already_claimed',
          claimedByName: data.claimed_by_name,
        } : null);
      } else {
        showError(data.error || 'Failed to claim');
      }
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to claim');
    },
  });

  // Release project mutation
  const releaseProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      if (!currentUserId) throw new Error('Not logged in');

      const { data, error } = await supabase.rpc('release_project', {
        p_project_id: projectId,
        p_user_id: currentUserId,
      });

      if (error) throw error;
      return data as { success: boolean; error?: string };
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['yard-mobile-schedule'] });
        queryClient.invalidateQueries({ queryKey: ['my-claimed-jobs'] });
        setPickListViewerProject(null);
        showSuccess('Job released');
      } else {
        showError(data.error || 'Failed to release');
      }
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed to release');
    },
  });

  // Handle code entry to claim a project
  const handleClaimCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;

    setClaimModalData({ project: null, status: 'searching' });

    try {
      // Search for project by code
      const { data, error } = await supabase
        .from('v_yard_schedule')
        .select('*')
        .eq('project_code', code)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setClaimModalData({
          project: null,
          status: 'error',
          error: 'Project not found',
        });
        return;
      }

      const project = data as ScheduledPickup;

      // Check if already claimed by someone else
      if (project.claimed_by && project.claimed_by !== currentUserId) {
        setClaimModalData({
          project,
          status: 'error',
          error: 'already_claimed',
          claimedByName: project.claimed_by_name || 'Someone',
        });
        return;
      }

      // Check if already claimed by me (just continue)
      if (project.claimed_by === currentUserId) {
        setClaimModalData(null);
        setCodeInput('');
        setPickListViewerProject(project);
        return;
      }

      // Found and unclaimed - show confirmation
      setClaimModalData({
        project,
        status: 'found',
      });
    } catch (err: any) {
      setClaimModalData({
        project: null,
        status: 'error',
        error: err.message || 'Failed to search',
      });
    }
  };

  const selectedYard = yards.find(y => y.id === selectedYardId);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header - Large touch targets */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white px-4 py-3 sticky top-0 z-10 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 -ml-2 hover:bg-white/10 rounded-lg"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold">Yard View</h1>
              <p className="text-amber-100 text-sm">{selectedYard?.name || 'Select yard'}</p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-3 hover:bg-white/10 rounded-lg"
          >
            <RefreshCw className={`w-6 h-6 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Yard Selector */}
        <div className="mt-3 flex gap-2">
          {yards.map(yard => (
            <button
              key={yard.id}
              onClick={() => setSelectedYardId(yard.id)}
              className={`flex-1 py-3 rounded-lg font-bold text-lg transition-all ${
                selectedYardId === yard.id
                  ? 'bg-white text-amber-600 shadow-lg'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
            >
              {yard.code}
            </button>
          ))}
        </div>

        {/* Code Entry - Primary Action */}
        <div className="mt-3 bg-white/10 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clipboard className="w-5 h-5" />
            <span className="font-medium">Enter Project Code from Pick List</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="AAA-000"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleClaimCode()}
              className="flex-1 px-4 py-3 bg-white rounded-lg text-gray-900 font-mono text-xl font-bold text-center placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              maxLength={7}
            />
            <button
              onClick={handleClaimCode}
              disabled={!codeInput.trim()}
              className="px-6 py-3 bg-white text-amber-600 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-50 active:bg-amber-100"
            >
              GO
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* MY JOBS Section - Always show first */}
            {(groupedPickups.my_jobs.length > 0 || myClaimedJobs.length > 0) && (
              <div>
                <h2 className="text-lg font-bold text-green-700 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  My Jobs ({groupedPickups.my_jobs.length || myClaimedJobs.length})
                </h2>
                <div className="space-y-3">
                  {(groupedPickups.my_jobs.length > 0 ? groupedPickups.my_jobs : myClaimedJobs).map(pickup => (
                    <MyJobCard
                      key={pickup.id}
                      pickup={pickup}
                      yardSpots={yardSpots}
                      onOpenPickList={() => setPickListViewerProject(pickup)}
                      onRelease={() => releaseProjectMutation.mutate(pickup.id)}
                      onPrint={() => handlePrint(pickup.id)}
                      onStatusChange={(newStatus, spotId) => {
                        updateStatusMutation.mutate({ projectId: pickup.id, newStatus, spotId });
                      }}
                      isUpdating={updateStatusMutation.isPending}
                      isPrinting={printingId === pickup.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Unclaimed Section */}
            {groupedPickups.unclaimed.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-amber-700 mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Available to Claim ({groupedPickups.unclaimed.length})
                </h2>
                <div className="space-y-3">
                  {groupedPickups.unclaimed.map(pickup => (
                    <UnclaimedCard
                      key={pickup.id}
                      pickup={pickup}
                      onClaim={() => claimProjectMutation.mutate(pickup.id)}
                      onView={() => setPickListViewerProject(pickup)}
                      isClaiming={claimProjectMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Others Picking Section */}
            {groupedPickups.others_picking.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-orange-600 mb-3 flex items-center gap-2">
                  <Play className="w-5 h-5" />
                  Being Picked by Others ({groupedPickups.others_picking.length})
                </h2>
                <div className="space-y-2 opacity-75">
                  {groupedPickups.others_picking.map(pickup => (
                    <div
                      key={pickup.id}
                      className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                          <span className="font-mono font-bold text-orange-600 text-sm">
                            {pickup.project_code}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">{pickup.project_name}</p>
                          <p className="text-sm text-orange-600 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {pickup.claimed_by_name || 'Someone'}
                          </p>
                        </div>
                      </div>
                      <div className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                        PICKING
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Staged Section (Action Needed) */}
            {groupedPickups.action_needed.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-blue-700 mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Staged ({groupedPickups.action_needed.length})
                </h2>
                <div className="space-y-3">
                  {groupedPickups.action_needed.map(pickup => (
                    <PickupCard
                      key={pickup.id}
                      pickup={pickup}
                      yardSpots={yardSpots}
                      isExpanded={expandedPickupId === pickup.id}
                      onToggleExpand={() => setExpandedPickupId(
                        expandedPickupId === pickup.id ? null : pickup.id
                      )}
                      onPrint={() => handlePrint(pickup.id)}
                      onSignoff={() => setSignoffPickup(pickup)}
                      onView={() => setPickListViewerProject(pickup)}
                      onStatusChange={(newStatus, spotId) => {
                        updateStatusMutation.mutate({ projectId: pickup.id, newStatus, spotId });
                      }}
                      isPrinting={printingId === pickup.id}
                      isUpdating={updateStatusMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Done Section */}
            {groupedPickups.done.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Completed Today ({groupedPickups.done.length})
                </h2>
                <div className="space-y-2 opacity-60">
                  {groupedPickups.done.map(pickup => (
                    <div
                      key={pickup.id}
                      className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <span className="font-mono font-bold text-gray-500 text-sm">
                            {pickup.project_code}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-600 line-through">{pickup.project_name}</p>
                          {pickup.crew_name && (
                            <p className="text-sm text-gray-400">{pickup.crew_name}</p>
                          )}
                        </div>
                      </div>
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sign-off Modal */}
      {signoffPickup && (
        <CrewSignoffModal
          projectId={signoffPickup.id}
          projectCode={signoffPickup.project_code}
          projectName={signoffPickup.project_name}
          onClose={() => setSignoffPickup(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['yard-mobile-schedule'] });
          }}
        />
      )}

      {/* Claim Confirmation Modal */}
      {claimModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            {claimModalData.status === 'searching' && (
              <div className="p-8 flex flex-col items-center">
                <Loader2 className="w-12 h-12 animate-spin text-amber-500 mb-4" />
                <p className="text-lg font-medium text-gray-700">Searching...</p>
              </div>
            )}

            {claimModalData.status === 'found' && claimModalData.project && (
              <div className="p-6">
                <div className="text-center mb-6">
                  <div className="w-20 h-16 bg-gray-900 rounded-xl mx-auto mb-4 flex items-center justify-center">
                    <span className="text-white font-mono font-bold text-xl">
                      {claimModalData.project.project_code}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{claimModalData.project.project_name}</h3>
                  {claimModalData.project.customer_name && (
                    <p className="text-gray-500">{claimModalData.project.customer_name}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-2">
                    {claimModalData.project.total_linear_feet} LF
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setClaimModalData(null);
                      setCodeInput('');
                    }}
                    className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold text-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => claimProjectMutation.mutate(claimModalData.project!.id)}
                    disabled={claimProjectMutation.isPending}
                    className="flex-1 py-4 bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {claimProjectMutation.isPending ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Play className="w-6 h-6" />
                        Claim & Pick
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {claimModalData.status === 'error' && (
              <div className="p-6">
                <div className="text-center mb-6">
                  {claimModalData.error === 'already_claimed' ? (
                    <>
                      <div className="w-16 h-16 bg-orange-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <User className="w-8 h-8 text-orange-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Already Claimed</h3>
                      <p className="text-gray-600 mt-2">
                        This job is being picked by<br />
                        <span className="font-bold text-orange-600">{claimModalData.claimedByName}</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Not Found</h3>
                      <p className="text-gray-600 mt-2">{claimModalData.error}</p>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    setClaimModalData(null);
                    setCodeInput('');
                  }}
                  className="w-full py-4 bg-gray-200 text-gray-700 rounded-xl font-bold text-lg"
                >
                  Try Another
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pick List Viewer */}
      {pickListViewerProject && (
        <PickListViewer
          projectId={pickListViewerProject.id}
          projectCode={pickListViewerProject.project_code}
          projectName={pickListViewerProject.project_name}
          isBundle={pickListViewerProject.is_bundle}
          onClose={() => setPickListViewerProject(null)}
        />
      )}
    </div>
  );
}

// Pickup Card Component
interface PickupCardProps {
  pickup: ScheduledPickup;
  yardSpots: YardSpot[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPrint: () => void;
  onSignoff: () => void;
  onView: () => void;
  onStatusChange: (newStatus: string, spotId?: string) => void;
  isPrinting: boolean;
  isUpdating: boolean;
}

function PickupCard({
  pickup,
  yardSpots,
  isExpanded,
  onToggleExpand,
  onPrint,
  onSignoff,
  onView,
  onStatusChange,
  isPrinting,
  isUpdating,
}: PickupCardProps) {
  const [selectedSpot, setSelectedSpot] = useState('');
  const statusConfig = STATUS_CONFIG[pickup.status] || STATUS_CONFIG.ready;
  const availableSpots = yardSpots.filter(s => !s.is_occupied);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Main card - tap to expand */}
      <div
        onClick={onToggleExpand}
        className="p-4 flex items-center gap-4 cursor-pointer active:bg-gray-50"
      >
        {/* Large Project Code */}
        <div className="w-20 h-16 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-white font-mono font-bold text-lg">
            {pickup.project_code || '---'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-lg truncate">{pickup.project_name}</h3>
            {pickup.is_bundle && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {pickup.bundle_project_count}
              </span>
            )}
          </div>
          {pickup.customer_name && (
            <p className="text-gray-500 truncate">{pickup.customer_name}</p>
          )}
          {pickup.spot_code && (
            <p className="text-blue-600 font-medium text-sm mt-1 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Spot {pickup.spot_code}
            </p>
          )}
        </div>

        {/* Status & Expand */}
        <div className="flex flex-col items-end gap-2">
          <div className={`px-3 py-2 rounded-lg ${statusConfig.bgColor} ${statusConfig.textColor} flex items-center gap-1`}>
            {statusConfig.icon}
            <span className="font-bold text-sm">{statusConfig.label}</span>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Expanded Actions */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onView(); }}
              className="flex-1 py-4 bg-amber-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:bg-amber-600"
            >
              <Eye className="w-6 h-6" />
              View
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onPrint(); }}
              disabled={isPrinting}
              className="flex-1 py-4 bg-blue-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:bg-blue-600 disabled:opacity-50"
            >
              {isPrinting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
              Print
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onSignoff(); }}
              className="flex-1 py-4 bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:bg-green-600"
            >
              <Camera className="w-6 h-6" />
              Sign-off
            </button>
          </div>

          {/* Status Change Actions */}
          {pickup.status === 'sent_to_yard' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-600">Assign spot & mark staged:</label>
              <div className="flex gap-2">
                <select
                  value={selectedSpot}
                  onChange={(e) => setSelectedSpot(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select spot...</option>
                  {availableSpots.map(spot => (
                    <option key={spot.id} value={spot.id}>
                      {spot.spot_code} {spot.spot_name ? `- ${spot.spot_name}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedSpot) {
                      onStatusChange('staged', selectedSpot);
                    }
                  }}
                  disabled={!selectedSpot || isUpdating}
                  className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold disabled:bg-gray-300 active:bg-blue-600"
                >
                  {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Stage'}
                </button>
              </div>
            </div>
          )}

          {pickup.status === 'staged' && (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange('loaded'); }}
              disabled={isUpdating}
              className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:bg-green-600 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Truck className="w-6 h-6" />}
              Mark as Loaded
            </button>
          )}

          {/* Partial Pickup Warning */}
          {pickup.partial_pickup && (
            <div className="p-3 bg-amber-100 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-800">Partial Pickup</p>
                {pickup.partial_pickup_notes && (
                  <p className="text-sm text-amber-700">{pickup.partial_pickup_notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Bundle Details */}
          {pickup.is_bundle && pickup.bundle_projects && (
            <div className="p-3 bg-purple-50 rounded-xl">
              <p className="font-bold text-purple-800 mb-2 flex items-center gap-1">
                <Layers className="w-4 h-4" />
                Bundle includes:
              </p>
              <div className="space-y-1">
                {pickup.bundle_projects.map(p => (
                  <div key={p.id} className="text-sm text-purple-700">
                    <span className="font-mono font-medium">{p.project_code}</span> - {p.project_name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// My Job Card Component - For claimed jobs
interface MyJobCardProps {
  pickup: ScheduledPickup;
  yardSpots: YardSpot[];
  onOpenPickList: () => void;
  onRelease: () => void;
  onPrint: () => void;
  onStatusChange: (newStatus: string, spotId?: string) => void;
  isUpdating: boolean;
  isPrinting: boolean;
}

function MyJobCard({
  pickup,
  yardSpots,
  onOpenPickList,
  onRelease,
  onPrint,
  onStatusChange,
  isUpdating,
  isPrinting,
}: MyJobCardProps) {
  const [selectedSpot, setSelectedSpot] = useState('');
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const availableSpots = yardSpots.filter(s => !s.is_occupied);
  const progress = pickup.pick_progress;
  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.picked / progress.total) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border-2 border-green-200">
      {/* Header with progress */}
      <div className="bg-green-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-16 h-12 bg-green-600 rounded-lg flex items-center justify-center shadow">
            <span className="text-white font-mono font-bold text-sm">
              {pickup.project_code}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">{pickup.project_name}</h3>
            {pickup.customer_name && (
              <p className="text-sm text-gray-500">{pickup.customer_name}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-green-700">
            {progress ? `${progress.picked}/${progress.total}` : '0/0'}
          </div>
          <div className="text-xs text-green-600">items picked</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-green-100">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Actions */}
      <div className="p-4 space-y-3">
        {/* Primary action: Open Pick List */}
        <button
          onClick={onOpenPickList}
          className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:bg-green-600"
        >
          <Clipboard className="w-6 h-6" />
          Open Pick List
        </button>

        {/* Secondary actions */}
        <div className="flex gap-2">
          <button
            onClick={onPrint}
            disabled={isPrinting}
            className="flex-1 py-3 bg-blue-100 text-blue-700 rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
            Print
          </button>
          <button
            onClick={() => setShowReleaseConfirm(true)}
            className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Release
          </button>
        </div>

        {/* Assign Spot (if picking status) */}
        {pickup.status === 'picking' && (
          <div className="pt-2 border-t border-gray-100">
            <label className="text-sm font-medium text-gray-600 mb-2 block">
              Assign spot when done:
            </label>
            <div className="flex gap-2">
              <select
                value={selectedSpot}
                onChange={(e) => setSelectedSpot(e.target.value)}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select spot...</option>
                {availableSpots.map(spot => (
                  <option key={spot.id} value={spot.id}>
                    {spot.spot_code} {spot.spot_name ? `- ${spot.spot_name}` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (selectedSpot) {
                    onStatusChange('staged', selectedSpot);
                  }
                }}
                disabled={!selectedSpot || isUpdating}
                className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold disabled:bg-gray-300"
              >
                {isUpdating ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Stage'}
              </button>
            </div>
          </div>
        )}

        {/* Spot info if staged */}
        {pickup.status === 'staged' && pickup.spot_code && (
          <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-600">
              <MapPin className="w-5 h-5" />
              <span className="font-medium">Staged at Spot {pickup.spot_code}</span>
            </div>
            <button
              onClick={() => onStatusChange('loaded')}
              disabled={isUpdating}
              className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold disabled:opacity-50 flex items-center gap-2"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Mark Loaded
            </button>
          </div>
        )}
      </div>

      {/* Release Confirmation Modal */}
      {showReleaseConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Release Job?</h3>
            <p className="text-gray-600 mb-6">
              Your progress will be saved. Another worker can continue picking.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReleaseConfirm(false)}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
              >
                Keep
              </button>
              <button
                onClick={() => {
                  setShowReleaseConfirm(false);
                  onRelease();
                }}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold"
              >
                Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Unclaimed Card Component
interface UnclaimedCardProps {
  pickup: ScheduledPickup;
  onClaim: () => void;
  onView: () => void;
  isClaiming: boolean;
}

function UnclaimedCard({ pickup, onClaim, onView, isClaiming }: UnclaimedCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div className="w-16 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
          <span className="font-mono font-bold text-amber-700 text-sm">
            {pickup.project_code}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{pickup.project_name}</h3>
          {pickup.customer_name && (
            <p className="text-sm text-gray-500 truncate">{pickup.customer_name}</p>
          )}
          <p className="text-xs text-gray-400">{pickup.total_linear_feet} LF</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onView}
            className="px-3 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold flex items-center gap-1 active:bg-gray-200"
          >
            <Eye className="w-5 h-5" />
          </button>
          <button
            onClick={onClaim}
            disabled={isClaiming}
            className="px-4 py-3 bg-amber-500 text-white rounded-xl font-bold flex items-center gap-2 disabled:opacity-50 active:bg-amber-600"
          >
            {isClaiming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5" />
                Claim
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
