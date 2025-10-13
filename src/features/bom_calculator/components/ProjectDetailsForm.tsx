import type { ProjectDetails } from '../types';
import type { BusinessUnit } from '../database.types';

interface ProjectDetailsFormProps {
  projectDetails: ProjectDetails;
  onChange: (details: ProjectDetails) => void;
  businessUnits: BusinessUnit[];
  disabled?: boolean;
}

export function ProjectDetailsForm({ projectDetails, onChange, businessUnits, disabled = false }: ProjectDetailsFormProps) {
  const handleChange = (field: keyof ProjectDetails, value: string) => {
    onChange({ ...projectDetails, [field]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Project Details</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Customer Name */}
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
            Customer Name <span className="text-red-600">*</span>
          </label>
          <input
            id="customerName"
            type="text"
            value={projectDetails.customerName}
            onChange={(e) => handleChange('customerName', e.target.value)}
            disabled={disabled}
            placeholder="Enter customer name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Project Name (Optional) */}
        <div>
          <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
            Project Name
          </label>
          <input
            id="projectName"
            type="text"
            value={projectDetails.projectName || ''}
            onChange={(e) => handleChange('projectName', e.target.value)}
            disabled={disabled}
            placeholder="Optional project name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Business Unit */}
        <div>
          <label htmlFor="businessUnit" className="block text-sm font-medium text-gray-700 mb-1">
            Business Unit <span className="text-red-600">*</span>
          </label>
          <select
            id="businessUnit"
            value={projectDetails.businessUnit}
            onChange={(e) => handleChange('businessUnit', e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Select Business Unit...</option>
            {businessUnits.map((bu) => (
              <option key={bu.id} value={bu.id}>
                {bu.code} - {bu.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
