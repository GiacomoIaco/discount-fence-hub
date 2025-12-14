import {
  Bot,
  BookOpen,
  Image,
  Calculator,
  FileText,
  TrendingUp,
  Target,
  Award
} from 'lucide-react';
import type { SalesHubView } from '../types';

interface SalesDashboardProps {
  onNavigate: (view: SalesHubView) => void;
}

export default function SalesDashboard({ onNavigate }: SalesDashboardProps) {
  const tools = [
    {
      title: 'AI Sales Coach',
      description: 'Get personalized coaching, objection handling tips, and closing strategies',
      icon: Bot,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-50',
      textColor: 'text-purple-700',
      view: 'sales-coach' as SalesHubView,
    },
    {
      title: 'Client Presentation',
      description: 'Beautiful product catalogs and presentations for customer meetings',
      icon: BookOpen,
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-50',
      textColor: 'text-blue-700',
      view: 'presentation' as SalesHubView,
    },
    {
      title: 'Photo Galleries',
      description: 'Browse and share our portfolio of completed fence installations',
      icon: Image,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-50',
      textColor: 'text-green-700',
      view: 'photo-gallery' as SalesHubView,
    },
    {
      title: 'Pre-Stain Calculator',
      description: 'Calculate stain requirements and pricing for wood fences',
      icon: Calculator,
      color: 'bg-amber-500',
      hoverColor: 'hover:bg-amber-50',
      textColor: 'text-amber-700',
      view: 'stain-calculator' as SalesHubView,
    },
    {
      title: 'Sales Resources',
      description: 'Training materials, product guides, and sales documentation',
      icon: FileText,
      color: 'bg-red-500',
      hoverColor: 'hover:bg-red-50',
      textColor: 'text-red-700',
      view: 'sales-resources' as SalesHubView,
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Tools</h1>
        <p className="text-gray-500 mt-1">
          Everything you need to close more deals and delight customers
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm font-medium text-amber-100">Monthly Goal</p>
              <p className="text-2xl font-bold">$125,000</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm font-medium text-green-100">Current Sales</p>
              <p className="text-2xl font-bold">$89,450</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl p-5 text-white">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 opacity-80" />
            <div>
              <p className="text-sm font-medium text-purple-100">Close Rate</p>
              <p className="text-2xl font-bold">68%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.view}
              onClick={() => onNavigate(tool.view)}
              className={`bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all text-left ${tool.hoverColor}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${tool.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className={`font-semibold ${tool.textColor}`}>{tool.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">{tool.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
