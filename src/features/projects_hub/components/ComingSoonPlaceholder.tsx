import { Construction } from 'lucide-react';

interface ComingSoonPlaceholderProps {
  title: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function ComingSoonPlaceholder({
  title,
  description,
  icon: Icon = Construction
}: ComingSoonPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <div className="bg-gray-100 rounded-full p-6 mb-6">
        <Icon className="w-12 h-12 text-gray-400" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 text-center max-w-md">{description}</p>
      <div className="mt-6 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
        Coming Soon
      </div>
    </div>
  );
}
