import { useState, useMemo } from 'react';
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
  Search,
  Layers,
  Users,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { showSuccess, showError } from '../../../lib/toast';
import { fetchAndGeneratePickListPDF } from '../components/PickListPDF';
import CrewSignoffModal from '../components/CrewSignoffModal';

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
}

// Status configuration with mobile-friendly colors
const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string; icon: React.ReactNode }> = {
  sent_to_yard: { label: 'TO STAGE', bgColor: 'bg-amber-500', textColor: 'text-white', icon: <Clock className="w-5 h-5" /> },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedPickupId, setExpandedPickupId] = useState<string | null>(null);
  const [signoffPickup, setSignoffPickup] = useState<ScheduledPickup | null>(null);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

      // Get today's pickups plus any staged/loaded from previous days
      const { data, error } = await supabase
        .from('v_yard_schedule')
        .select('*')
        .eq('yard_id', selectedYardId)
        .or(`expected_pickup_date.eq.${todayStr},status.in.(staged,loaded)`)
        .order('status')
        .order('expected_pickup_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data as ScheduledPickup[];
    },
    enabled: !!selectedYardId,
    refetchInterval: 30000, // Refresh every 30 seconds
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
      action_needed: [] as ScheduledPickup[], // sent_to_yard, staged
      done: [] as ScheduledPickup[], // loaded, completed
    };

    filteredPickups.forEach(p => {
      if (p.status === 'loaded' || p.status === 'completed') {
        groups.done.push(p);
      } else {
        groups.action_needed.push(p);
      }
    });

    return groups;
  }, [filteredPickups]);

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
      showSuccess('Updated');
    },
    onError: (err: Error) => {
      showError(err.message || 'Failed');
    },
  });

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

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-200" />
          <input
            type="text"
            placeholder="Search project code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/20 rounded-lg text-white placeholder-amber-200 text-lg focus:bg-white/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        ) : filteredPickups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Package className="w-16 h-16 mb-4" />
            <p className="text-xl font-medium">No pickups found</p>
            <p className="text-sm">Check back later</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Action Needed Section */}
            {groupedPickups.action_needed.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Action Needed ({groupedPickups.action_needed.length})
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
