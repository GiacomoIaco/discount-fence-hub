import { Calendar } from 'lucide-react';
import type { DateRange } from '../hooks/useAnalytics';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const options: { value: DateRange; label: string }[] = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' },
  ];

  return (
    <div className="flex items-center gap-2">
      <Calendar className="w-4 h-4 text-gray-500" />
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              value === option.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function getDateFilterFromRange(range: DateRange): string {
  if (range === 'all') return '';

  const now = new Date();
  const days = range === '7days' ? 7 : range === '30days' ? 30 : 90;
  const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}
