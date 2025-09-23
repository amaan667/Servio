'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type LegacyShift = { 
  id: string; 
  staff_id: string; 
  start_time: string; 
  end_time: string; 
  area?: string;
  staff_name: string;
  staff_role: string;
};

interface SimpleStaffGridProps {
  shifts: LegacyShift[];
  venueId: string;
}

type CalendarView = 'today' | 'week' | 'month';

const SimpleStaffGrid: React.FC<SimpleStaffGridProps> = ({ shifts, venueId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('today');

  // Filter shifts based on current view
  const visibleShifts = useMemo(() => {
    if (calendarView === 'today') {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      return shifts.filter(shift => {
        const shiftStart = new Date(shift.start_time);
        const shiftEnd = new Date(shift.end_time);
        return shiftEnd >= dayStart && shiftStart <= dayEnd;
      });
    }
    
    if (calendarView === 'week') {
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // End of week (Saturday)
      weekEnd.setHours(23, 59, 59, 999);
      
      return shifts.filter(shift => {
        const shiftStart = new Date(shift.start_time);
        const shiftEnd = new Date(shift.end_time);
        return shiftEnd >= weekStart && shiftStart <= weekEnd;
      });
    }
    
    // Month view
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    return shifts.filter(shift => {
      const shiftStart = new Date(shift.start_time);
      const shiftEnd = new Date(shift.end_time);
      return shiftEnd >= startOfMonth && shiftStart <= endOfMonth;
    });
  }, [shifts, calendarView, currentDate, currentMonth]);

  // Group shifts by date for grid display
  const shiftsByDate = useMemo(() => {
    const grouped: Record<string, LegacyShift[]> = {};
    
    visibleShifts.forEach(shift => {
      const date = new Date(shift.start_time).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(shift);
    });
    
    return grouped;
  }, [visibleShifts]);

  // Get dates to display based on view
  const displayDates = useMemo(() => {
    if (calendarView === 'today') {
      return [currentDate];
    }
    
    if (calendarView === 'week') {
      const dates = [];
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek); // Start of week (Sunday)
      
      for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        dates.push(date);
      }
      return dates;
    }
    
    // Month view - show all days in the month
    const dates = [];
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }, [calendarView, currentDate, currentMonth]);

  // Navigation functions
  const goBack = () => {
    if (calendarView === 'today') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 1));
    } else if (calendarView === 'week') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
    } else {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const goForward = () => {
    if (calendarView === 'today') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 1));
    } else if (calendarView === 'week') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
    } else {
      setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Get display title based on view
  const getDisplayTitle = () => {
    if (calendarView === 'today') {
      return currentDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
    
    if (calendarView === 'week') {
      const weekStart = new Date(currentDate);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const isShiftActive = (shift: LegacyShift) => {
    const now = new Date();
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    return now >= start && now <= end;
  };

  const isOvernightShift = (shift: LegacyShift) => {
    const start = new Date(shift.start_time);
    const end = new Date(shift.end_time);
    return start.toDateString() !== end.toDateString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Staff Schedule</CardTitle>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="hidden sm:flex rounded-md border overflow-hidden">
              <button
                className={`px-3 py-1 text-sm ${calendarView === 'today' ? 'bg-purple-600 text-white' : 'bg-background'}`}
                onClick={() => setCalendarView('today')}
              >
                Today
              </button>
              <button
                className={`px-3 py-1 text-sm border-l ${calendarView === 'week' ? 'bg-purple-600 text-white' : 'bg-background'}`}
                onClick={() => setCalendarView('week')}
              >
                Week
              </button>
              <button
                className={`px-3 py-1 text-sm border-l ${calendarView === 'month' ? 'bg-purple-600 text-white' : 'bg-background'}`}
                onClick={() => setCalendarView('month')}
              >
                Month
              </button>
            </div>
            
            {/* Navigation */}
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={goBack}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goForward}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="text-2xl font-bold text-center">{getDisplayTitle()}</div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Grid Header */}
            <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${displayDates.length}, 1fr)` }}>
              {displayDates.map((date, index) => (
                <div key={index} className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-600">
                    {date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </div>
                  <div className="text-lg font-bold">
                    {date.getDate()}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Grid Content */}
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${displayDates.length}, 1fr)` }}>
              {displayDates.map((date, index) => {
                const dateString = date.toDateString();
                const dayShifts = shiftsByDate[dateString] || [];
                
                return (
                  <div key={index} className="min-h-[200px] p-2 border rounded-lg bg-white">
                    <div className="space-y-2">
                      {dayShifts.length === 0 ? (
                        <div className="text-center text-gray-400 text-sm py-8">
                          No shifts
                        </div>
                      ) : (
                        dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="group relative p-2 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors cursor-pointer"
                            title={`${shift.staff_name} - ${shift.staff_role}\n${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}${shift.area ? `\n${shift.area}` : ''}${isOvernightShift(shift) ? '\n🌙 Overnight Shift' : ''}${isShiftActive(shift) ? '\n🟢 Active Now' : ''}`}
                          >
                            <div className="text-sm font-medium text-purple-800">
                              {shift.staff_name}
                            </div>
                            <div className="text-xs text-purple-600">
                              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                            </div>
                            {shift.area && (
                              <div className="text-xs text-gray-500">
                                {shift.area}
                              </div>
                            )}
                            
                            {/* Status badges */}
                            <div className="flex gap-1 mt-1">
                              {isShiftActive(shift) && (
                                <Badge className="bg-green-500 text-white text-xs">
                                  Active
                                </Badge>
                              )}
                              {isOvernightShift(shift) && (
                                <Badge variant="outline" className="border-orange-300 text-orange-700 bg-orange-100 text-xs">
                                  🌙
                                </Badge>
                              )}
                            </div>
                            
                            {/* Hover tooltip */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                              <div className="font-medium">{shift.staff_name}</div>
                              <div>{shift.staff_role}</div>
                              <div>{formatTime(shift.start_time)} - {formatTime(shift.end_time)}</div>
                              {shift.area && <div>{shift.area}</div>}
                              {isOvernightShift(shift) && <div>🌙 Overnight Shift</div>}
                              {isShiftActive(shift) && <div>🟢 Active Now</div>}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleStaffGrid;
