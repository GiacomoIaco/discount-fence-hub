import { useState, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import RoadmapLayout from './RoadmapLayout';
import RoadmapWorkspace from './components/RoadmapWorkspace';
import { supabase } from '../../lib/supabase';
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
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHubs, setSelectedHubs] = useState<Set<HubKey>>(new Set(Object.keys(HUB_CONFIG) as HubKey[]));
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Check screen size
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load items
  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('roadmap_items')
        .select('*')
        .order('importance', { ascending: false });

      if (error) throw error;
      setItems(data || []);
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
  };

  // Desktop-only check
  if (!isDesktop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Desktop Required</h1>
          <p className="text-gray-600 mb-6">
            The Roadmap Hub is optimized for desktop use and requires a larger screen.
          </p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <RoadmapLayout
      selectedHubs={selectedHubs}
      onToggleHub={toggleHub}
      onSelectAll={selectAllHubs}
      onClearAll={clearAllHubs}
      stats={stats}
      onBack={onBack}
    >
      <RoadmapWorkspace
        items={filteredItems}
        loading={loading}
        onRefresh={loadItems}
        selectedHubs={selectedHubs}
      />
    </RoadmapLayout>
  );
}
