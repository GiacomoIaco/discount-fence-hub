import { useState, useMemo } from 'react';
import { Search, Zap, MessageSquare, Truck, DollarSign, Calendar, CheckCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { QuickReply, QuickReplyCategory } from '../types';

interface QuickReplyPickerProps {
  replies: QuickReply[];
  onSelect: (reply: QuickReply) => void;
  onClose: () => void;
}

const CATEGORY_CONFIG: Record<QuickReplyCategory, { label: string; icon: React.ReactNode; color: string }> = {
  greeting: { label: 'Greetings', icon: <MessageSquare className="w-4 h-4" />, color: 'blue' },
  field: { label: 'Field', icon: <Truck className="w-4 h-4" />, color: 'green' },
  sales: { label: 'Sales', icon: <DollarSign className="w-4 h-4" />, color: 'purple' },
  scheduling: { label: 'Scheduling', icon: <Calendar className="w-4 h-4" />, color: 'orange' },
  completion: { label: 'Completion', icon: <CheckCircle className="w-4 h-4" />, color: 'teal' },
  payment: { label: 'Payment', icon: <DollarSign className="w-4 h-4" />, color: 'emerald' },
  general: { label: 'General', icon: <Zap className="w-4 h-4" />, color: 'gray' },
};

export function QuickReplyPicker({ replies, onSelect, onClose }: QuickReplyPickerProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<QuickReplyCategory | 'all'>('all');

  // Filter replies
  const filteredReplies = useMemo(() => {
    return replies.filter(reply => {
      const matchesSearch = !search ||
        reply.title.toLowerCase().includes(search.toLowerCase()) ||
        reply.shortcut?.toLowerCase().includes(search.toLowerCase()) ||
        reply.body.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || reply.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [replies, search, selectedCategory]);

  // Group by category
  const groupedReplies = useMemo(() => {
    const groups: Record<string, QuickReply[]> = {};
    filteredReplies.forEach(reply => {
      const cat = reply.category || 'general';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(reply);
    });
    return groups;
  }, [filteredReplies]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(replies.map(r => r.category || 'general'));
    return ['all', ...Array.from(cats)] as (QuickReplyCategory | 'all')[];
  }, [replies]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-xl border max-h-96 overflow-hidden flex flex-col z-50">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          Quick Replies
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Category Filters */}
        <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors',
                selectedCategory === cat
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {cat === 'all' ? 'All' : CATEGORY_CONFIG[cat]?.label || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Replies List */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(groupedReplies).length === 0 ? (
          <div className="text-center text-gray-500 py-8 text-sm">
            No templates found
          </div>
        ) : (
          Object.entries(groupedReplies).map(([category, categoryReplies]) => (
            <div key={category} className="mb-3">
              {selectedCategory === 'all' && (
                <div className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-1 px-2">
                  {CATEGORY_CONFIG[category as QuickReplyCategory]?.icon}
                  {CATEGORY_CONFIG[category as QuickReplyCategory]?.label || category}
                </div>
              )}
              {categoryReplies.map(reply => (
                <button
                  key={reply.id}
                  onClick={() => {
                    onSelect(reply);
                    onClose();
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{reply.title}</span>
                    {reply.shortcut && (
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {reply.shortcut}
                      </code>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {reply.body}
                  </p>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t bg-gray-50 text-xs text-gray-500">
        Type <code className="bg-gray-200 px-1 rounded">/shortcut</code> in the composer to use directly
      </div>
    </div>
  );
}
