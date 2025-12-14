import { useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
} from 'lucide-react';

// Generate calendar days for a month
function generateCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPadding = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const days: (number | null)[] = [];

  // Add padding for days before the 1st
  for (let i = 0; i < startPadding; i++) {
    days.push(null);
  }

  // Add actual days
  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

  return days;
}

// Mock scheduled events
const mockEvents = [
  { id: 1, day: 15, time: '9:00 AM', title: 'Assessment - Johnson', type: 'assessment', address: '123 Oak St' },
  { id: 2, day: 15, time: '2:00 PM', title: 'Install - Smith', type: 'job', address: '456 Pine Ave' },
  { id: 3, day: 18, time: '10:00 AM', title: 'Assessment - Williams', type: 'assessment', address: '789 Elm Dr' },
  { id: 4, day: 20, time: '8:00 AM', title: 'Install - Garcia', type: 'job', address: '321 Maple Ln' },
  { id: 5, day: 20, time: '1:00 PM', title: 'Assessment - Brown', type: 'assessment', address: '654 Cedar Ct' },
  { id: 6, day: 22, time: '9:00 AM', title: 'Install - Davis', type: 'job', address: '987 Birch Way' },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SchedulePageProps {
  onBack?: () => void;
}

export default function SchedulePage({ onBack: _onBack }: SchedulePageProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  const calendarDays = generateCalendarDays(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDay(today.getDate());
  };

  const getEventsForDay = (day: number) => {
    return mockEvents.filter(e => e.day === day);
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-blue-600" />
              Schedule
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage assessments and job schedules
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Schedule Event
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="flex gap-6">
          {/* Calendar */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border">
            {/* Month Navigation */}
            <div className="flex items-center justify-between p-4 border-b">
              <button
                onClick={prevMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-semibold">
                  {MONTHS[currentMonth]} {currentYear}
                </h2>
                <button
                  onClick={goToToday}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Today
                </button>
              </div>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map(day => (
                  <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const events = day ? getEventsForDay(day) : [];
                  const isToday = day === today.getDate() &&
                    currentMonth === today.getMonth() &&
                    currentYear === today.getFullYear();
                  const isSelected = day === selectedDay;

                  return (
                    <button
                      key={idx}
                      onClick={() => day && setSelectedDay(day)}
                      disabled={!day}
                      className={`min-h-[80px] p-2 rounded-lg text-left transition-all ${
                        !day
                          ? 'bg-gray-50'
                          : isSelected
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-white hover:bg-gray-50 border border-gray-100'
                      }`}
                    >
                      {day && (
                        <>
                          <div className={`text-sm font-medium mb-1 ${
                            isToday
                              ? 'w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center'
                              : 'text-gray-700'
                          }`}>
                            {day}
                          </div>
                          {events.length > 0 && (
                            <div className="space-y-1">
                              {events.slice(0, 2).map(event => (
                                <div
                                  key={event.id}
                                  className={`text-xs px-1.5 py-0.5 rounded truncate ${
                                    event.type === 'assessment'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-green-100 text-green-700'
                                  }`}
                                >
                                  {event.time}
                                </div>
                              ))}
                              {events.length > 2 && (
                                <div className="text-xs text-gray-500">
                                  +{events.length - 2} more
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Day Detail Panel */}
          <div className="w-80 bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                {selectedDay
                  ? `${MONTHS[currentMonth]} ${selectedDay}, ${currentYear}`
                  : 'Select a day'}
              </h3>
              <p className="text-sm text-gray-500">
                {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''} scheduled
              </p>
            </div>

            <div className="p-4 space-y-3 max-h-[500px] overflow-auto">
              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Clock className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No events scheduled</p>
                </div>
              ) : (
                selectedDayEvents.map(event => (
                  <div
                    key={event.id}
                    className={`p-3 rounded-lg border-l-4 ${
                      event.type === 'assessment'
                        ? 'bg-purple-50 border-purple-500'
                        : 'bg-green-50 border-green-500'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{event.title}</p>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                          <Clock className="w-3 h-3" />
                          {event.time}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {event.address}
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        event.type === 'assessment'
                          ? 'bg-purple-200 text-purple-800'
                          : 'bg-green-200 text-green-800'
                      }`}>
                        {event.type === 'assessment' ? 'Assessment' : 'Install'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedDay && (
              <div className="p-4 border-t">
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Plus className="w-4 h-4" />
                  Add Event
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded"></div>
            <span>Assessment</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>Installation</span>
          </div>
        </div>
      </div>
    </div>
  );
}
