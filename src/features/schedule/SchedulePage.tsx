import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  ClipboardList,
  Briefcase,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

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

interface ScheduleEvent {
  id: string;
  date: Date;
  time: string;
  title: string;
  type: 'assessment' | 'job';
  address: string;
  assignee?: string;
  entityId: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface SchedulePageProps {
  onBack?: () => void;
  onNavigateToRequest?: (requestId: string) => void;
  onNavigateToJob?: (jobId: string) => void;
}

export default function SchedulePage({
  onNavigateToRequest,
  onNavigateToJob,
}: SchedulePageProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());

  // Calculate date range for the current month view
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

  // Fetch scheduled assessments
  const { data: assessments = [] } = useQuery({
    queryKey: ['schedule', 'assessments', currentYear, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          id,
          request_number,
          contact_name,
          address_line1,
          city,
          assessment_scheduled_at,
          assessment_rep:sales_reps!service_requests_assessment_rep_id_fkey(name),
          assigned_rep:sales_reps!service_requests_assigned_rep_id_fkey(name)
        `)
        .not('assessment_scheduled_at', 'is', null)
        .gte('assessment_scheduled_at', monthStart.toISOString())
        .lte('assessment_scheduled_at', monthEnd.toISOString())
        .order('assessment_scheduled_at');

      if (error) {
        console.error('Error fetching assessments:', error);
        return [];
      }
      return data || [];
    },
  });

  // Fetch scheduled jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ['schedule', 'jobs', currentYear, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          job_number,
          job_address,
          scheduled_date,
          scheduled_time_start,
          assigned_crew:crews(name),
          client:clients(name)
        `)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', monthStart.toISOString().split('T')[0])
        .lte('scheduled_date', monthEnd.toISOString().split('T')[0])
        .order('scheduled_date');

      if (error) {
        console.error('Error fetching jobs:', error);
        return [];
      }
      return data || [];
    },
  });

  // Transform data into calendar events
  const events: ScheduleEvent[] = useMemo(() => {
    const result: ScheduleEvent[] = [];

    // Add assessments
    assessments.forEach((assessment: any) => {
      if (assessment.assessment_scheduled_at) {
        const date = new Date(assessment.assessment_scheduled_at);
        result.push({
          id: `assessment-${assessment.id}`,
          date,
          time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
          title: `Assessment - ${assessment.contact_name || assessment.request_number}`,
          type: 'assessment',
          address: assessment.address_line1
            ? `${assessment.address_line1}${assessment.city ? `, ${assessment.city}` : ''}`
            : 'No address',
          assignee: assessment.assessment_rep?.name || assessment.assigned_rep?.name,
          entityId: assessment.id,
        });
      }
    });

    // Add jobs
    jobs.forEach((job: any) => {
      if (job.scheduled_date) {
        const date = new Date(job.scheduled_date);
        // Add time if available
        if (job.scheduled_time_start) {
          const [hours, minutes] = job.scheduled_time_start.split(':');
          date.setHours(parseInt(hours), parseInt(minutes));
        }
        result.push({
          id: `job-${job.id}`,
          date,
          time: job.scheduled_time_start
            ? new Date(`2000-01-01T${job.scheduled_time_start}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : 'TBD',
          title: `Install - ${job.client?.name || job.job_number}`,
          type: 'job',
          address: job.job_address?.line1
            ? `${job.job_address.line1}${job.job_address.city ? `, ${job.job_address.city}` : ''}`
            : 'No address',
          assignee: job.assigned_crew?.name,
          entityId: job.id,
        });
      }
    });

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [assessments, jobs]);

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
    return events.filter(e => {
      return e.date.getDate() === day &&
        e.date.getMonth() === currentMonth &&
        e.date.getFullYear() === currentYear;
    });
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const handleEventClick = (event: ScheduleEvent) => {
    if (event.type === 'assessment' && onNavigateToRequest) {
      onNavigateToRequest(event.entityId);
    } else if (event.type === 'job' && onNavigateToJob) {
      onNavigateToJob(event.entityId);
    }
  };

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
              Assessments and job schedules
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-gray-600">Assessment</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600">Job</span>
              </div>
            </div>
          </div>
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
                  const dayEvents = day ? getEventsForDay(day) : [];
                  const isToday = day === today.getDate() &&
                    currentMonth === today.getMonth() &&
                    currentYear === today.getFullYear();
                  const isSelected = day === selectedDay;

                  return (
                    <button
                      key={idx}
                      onClick={() => day && setSelectedDay(day)}
                      disabled={!day}
                      className={`
                        min-h-[80px] p-2 rounded-lg text-left transition-colors
                        ${!day ? 'bg-gray-50' : 'hover:bg-gray-50'}
                        ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''}
                        ${isToday && !isSelected ? 'bg-amber-50' : ''}
                      `}
                    >
                      {day && (
                        <>
                          <span className={`
                            text-sm font-medium
                            ${isToday ? 'text-blue-600' : 'text-gray-900'}
                          `}>
                            {day}
                          </span>
                          {dayEvents.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {dayEvents.slice(0, 2).map(event => (
                                <div
                                  key={event.id}
                                  className={`
                                    text-xs px-1.5 py-0.5 rounded truncate
                                    ${event.type === 'assessment'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-green-100 text-green-700'}
                                  `}
                                >
                                  {event.time}
                                </div>
                              ))}
                              {dayEvents.length > 2 && (
                                <div className="text-xs text-gray-500 px-1">
                                  +{dayEvents.length - 2} more
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

          {/* Day Details Sidebar */}
          <div className="w-80 bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              {selectedDay ? (
                <>
                  {MONTHS[currentMonth]} {selectedDay}, {currentYear}
                </>
              ) : (
                'Select a day'
              )}
            </h3>

            {selectedDayEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">No events scheduled</p>
            ) : (
              <div className="space-y-3">
                {selectedDayEvents.map(event => (
                  <button
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className={`
                      w-full p-3 rounded-lg border text-left transition-colors hover:shadow-sm
                      ${event.type === 'assessment'
                        ? 'border-blue-200 hover:border-blue-300 bg-blue-50/50'
                        : 'border-green-200 hover:border-green-300 bg-green-50/50'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`
                        p-2 rounded-lg
                        ${event.type === 'assessment' ? 'bg-blue-100' : 'bg-green-100'}
                      `}>
                        {event.type === 'assessment' ? (
                          <ClipboardList className={`w-4 h-4 text-blue-600`} />
                        ) : (
                          <Briefcase className={`w-4 h-4 text-green-600`} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">
                          {event.title}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                          <Clock className="w-3 h-3" />
                          {event.time}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          {event.address}
                        </div>
                        {event.assignee && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                            <User className="w-3 h-3" />
                            {event.assignee}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
