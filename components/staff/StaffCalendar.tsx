'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shift, getWeekDays } from '@/lib/calendar-utils';
import CalendarDay from './CalendarDay';
import CalendarWeek from './CalendarWeek';
import CalendarMonth from './CalendarMonth';

interface StaffCalendarProps {
  shifts: Shift[];
  venueId: string;
}

type CalendarView = 'today' | 'week' | 'month';

const StaffCalendar: React.FC<StaffCalendarProps> = ({ shifts, venueId }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('month');

  // Filter shifts based on current view
  const visibleShifts = useMemo(() => {
    if (calendarView === 'today') {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      return shifts.filter(shift => {
        const shiftStart = new Date(shift.startsAt);
        const shiftEnd = new Date(shift.endsAt);
        return shiftEnd >= dayStart && shiftStart <= dayEnd;
      });
    }
    
    if (calendarView === 'week') {
      const weekDays = getWeekDays(currentDate);
      const weekStart = weekDays[0];
      const weekEnd = new Date(weekDays[6]);
      weekEnd.setHours(23, 59, 59, 999);
      
      return shifts.filter(shift => {
        const shiftStart = new Date(shift.startsAt);
        const shiftEnd = new Date(shift.endsAt);
        return shiftEnd >= weekStart && shiftStart <= weekEnd;
      });
    }
    
    // Month view
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    return shifts.filter(shift => {
      const shiftStart = new Date(shift.startsAt);
      const shiftEnd = new Date(shift.endsAt);
      return shiftEnd >= startOfMonth && shiftStart <= endOfMonth;
    });
  }, [shifts, calendarView, currentDate, currentMonth]);

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
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0];
      const end = weekDays[6];
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const renderCalendar = () => {
    switch (calendarView) {
      case 'today':
        return (
          <CalendarDay 
            date={currentDate} 
            shifts={visibleShifts}
            pxPerMinute={1.2}
          />
        );
      case 'week':
        return (
          <CalendarWeek 
            date={currentDate} 
            shifts={visibleShifts}
            pxPerMinute={1}
          />
        );
      case 'month':
        return (
          <CalendarMonth 
            date={currentMonth} 
            shifts={visibleShifts}
            maxSlots={4}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Staff Calendar</CardTitle>
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
        <div className="relative">
          {renderCalendar()}
        </div>
      </CardContent>
    </Card>
  );
};

export default StaffCalendar;
