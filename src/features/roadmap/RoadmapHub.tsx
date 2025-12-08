import { useState, useEffect } from 'react';
import RoadmapLayout from './RoadmapLayout';
import RoadmapWorkspace from './components/RoadmapWorkspace';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { RoadmapItem } from './types';

// Hub configuration with colors
export const HUB_CONFIG = {
  'ops-hub': { label: 'Ops Hub', prefix: 'O', color: 'bg-blue-500', textColor: 'text-blue-600', bgLight: 'bg-blue-50', border: 'border-blue-200' },
  'requests': { label: 'Requests', prefix: 'R', color: 'bg-purple-500', textColor: 'text-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-200' },
  'chat': { label: 'Chat', prefix: 'C', color: 'bg-green-500', textColor: 'text-green-600', bgLight: 'bg-green-50', border: 'border-green-200' },
  'analytics': { label: 'Analytics', prefix: 'A', color: 'bg-orange-500', textColor: 'text-orange-600', bgLight: 'bg-orange-50', border: 'border-orange-200' },
  'settings': { label: 'Settings', prefix: 'S', color: 'bg-gray-500', textColor: 'text-gray-600', bgLight: 'bg-gray-50', border: 'border-gray-200' },
  'general': { label: 'General', prefix: 'G', color: 'bg-indigo-500', textColor: 'text-indigo-600', bgLight: 'bg-indigo-50', border: 'border-indigo-200' },
  'leadership': { label: 'Leadership', prefix: 'L', color: 'bg-yellow-500', textColor: 'text-yellow-600', bgLight: 'bg-yellow-50', border: 'border-yellow-200' },
  'future': { label: 'Future', prefix: 'F', color: 'bg-pink-500', textColor: 'text-pink-600', bgLight: 'bg-pink-50', border: 'border-pink-200' },
} as const;

export type HubKey = keyof typeof HUB_CONFIG;

interface RoadmapHubProps {
  onBack?: () => void;
}

export default function RoadmapHub({ onBack }: RoadmapHubProps) {
  const { profile } = useAuth();
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHubs, setSelectedHubs] = useState<Set<HubKey>>(new Set(Object.keys(HUB_CONFIG) as HubKey[]));

  // Check if user is admin (can change statuses)
  const isAdmin = profile?.role === 'admin';

  // Load items
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      // Join with user_profiles to get creator name
      const { data, error } = await supabase
        .from('roadmap_items')
        .select(`
          *,
          creator:user_profiles!created_by(full_name)
        `)
        .order('importance', { ascending: false });

      if (error) throw error;

      // Map creator name to flat structure
      const itemsWithCreator = (data || []).map(item => ({
        ...item,
        creator_name: item.creator?.full_name || null,
        creator: undefined // Remove nested object
      }));

      setItems(itemsWithCreator);
    } catch (error) {
      console.error('Error loading roadmap items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleHub = (hub: HubKey) => {
    setSelectedHubs(prev => {
      const next = new Set(prev);
      if (next.has(hub)) {
        next.delete(hub);
      } else {
        next.add(hub);
      }
      return next;
    });
  };

  const selectAllHubs = () => {
    setSelectedHubs(new Set(Object.keys(HUB_CONFIG) as HubKey[]));
  };

  const clearAllHubs = () => {
    setSelectedHubs(new Set());
  };

  // Filter items by selected hubs
  const filteredItems = items.filter(item => selectedHubs.has(item.hub as HubKey));

  // Calculate stats for selected hubs
  const stats = {
    total: filteredItems.length,
    ideas: filteredItems.filter(i => i.status === 'idea').length,
    inProgress: filteredItems.filter(i => i.status === 'in_progress').length,
    done: filteredItems.filter(i => i.status === 'done').length,
    approved: filteredItems.filter(i => i.status === 'approved').length,
    researched: filteredItems.filter(i => i.status === 'researched').length,
    parked: filteredItems.filter(i => i.status === 'parked').length,
  };

  // Calculate per-hub counts for sidebar
  const hubCounts = (Object.keys(HUB_CONFIG) as HubKey[]).reduce((acc, hub) => {
    const hubItems = items.filter(i => i.hub === hub);
    acc[hub] = {
      ideasAndResearched: hubItems.filter(i => i.status === 'idea' || i.status === 'researched').length,
      approved: hubItems.filter(i => i.status === 'approved').length,
    };
    return acc;
  }, {} as Record<HubKey, { ideasAndResearched: number; approved: number }>);

  return (
    <RoadmapLayout
      selectedHubs={selectedHubs}
      onToggleHub={toggleHub}
      onSelectAll={selectAllHubs}
      onClearAll={clearAllHubs}
      stats={stats}
      hubCounts={hubCounts}
      onBack={onBack}
    >
      <RoadmapWorkspace
        items={filteredItems}
        loading={loading}
        onRefresh={loadItems}
        selectedHubs={selectedHubs}
        isAdmin={isAdmin}
      />
    </RoadmapLayout>
  );
}
