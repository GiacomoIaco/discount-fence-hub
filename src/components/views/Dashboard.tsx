import { Ticket, CheckCircle, DollarSign } from 'lucide-react';

type UserRole = 'sales' | 'operations' | 'sales-manager' | 'admin' | 'yard';

interface DashboardProps {
  userRole: UserRole;
}

export default function Dashboard({ userRole }: DashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Ticket className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Requests</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-green-100 p-2 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">45</p>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-gray-200 p-6 rounded-xl">
          <div className="flex items-center space-x-3 mb-2">
            <div className="bg-orange-100 p-2 rounded-lg">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">$127K</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-100 border-2 border-gray-300 p-8 rounded-xl text-center">
        <p className="text-gray-600">Dashboard metrics will be displayed here based on role: <span className="font-semibold capitalize">{userRole}</span></p>
      </div>
    </div>
  );
}
