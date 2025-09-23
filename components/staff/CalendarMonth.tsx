'use client';

import React, { useMemo, useState } from 'react';
import { Shift, ShiftSegment, getShiftSegments, getDaysInMonth } from '@/lib/calendar-utils';
import ShiftPill from './ShiftPill';

interface CalendarMonthProps {
  date: Date;
  shifts: Shift[];
  maxSlots?: number;
}

interface OverflowPopoverProps {
  shifts: ShiftSegment[];
  isOpen: boolean;
  onClose: () => void;
  position: { top: number; left: number };
}

const OverflowPopover: React.FC<OverflowPopoverProps> = ({ 
  shifts, 
  isOpen, 
  onClose, 
  position 
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Popover */}
      <div
        className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs"
        style={{
          top: position.top,
          left: position.left,
          transform: 'translateY(-100%)'
        }}
      >
        <div className="space-y-2">
          {shifts.map(shift => (
            <div key={shift.id} className="text-sm">
              <div className="font-medium">{shift.shift.staffName}</div>
              <div className="text-gray-600 text-xs">
                {shift.shift.role} • {new Date(shift.start).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })} - {new Date(shift.end).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

const CalendarMonth: React.FC<CalendarMonthProps> = ({ 
  date, 
  shifts, 
  maxSlots = 4 
}) => {
  const [overflowPopover, setOverflowPopover] = useState<{
    isOpen: boolean;
    shifts: ShiftSegment[];
    position: { top: number; left: number };
  }>({
    isOpen: false,
    shifts: [],
    position: { top: 0, left: 0 }
  });

  const days = useMemo(() => getDaysInMonth(date), [date]);

  // Get all shift segments for the month
  const monthSegments = useMemo(() => {
    const allSegments: Array<ShiftSegment & { dayIndex: number }> = [];
    
    days.forEach((day, dayIndex) => {
      const daySegments = shifts.flatMap(shift => 
        getShiftSegments(shift, day.date).map(segment => ({
          ...segment,
          dayIndex
        }))
      );
      allSegments.push(...daySegments);
    });
    
    return allSegments;
  }, [shifts, days]);

  // Group segments by day and calculate slot positions
  const { daySegments } = useMemo(() => {
    const daySegments: Record<number, ShiftSegment[]> = {};
    
    monthSegments.forEach(segment => {
      if (!daySegments[segment.dayIndex]) {
        daySegments[segment.dayIndex] = [];
      }
      daySegments[segment.dayIndex].push(segment);
    });
    
    // Sort segments within each day by start time
    Object.keys(daySegments).forEach(dayIndex => {
      daySegments[parseInt(dayIndex)].sort((a, b) => 
        a.start.getTime() - b.start.getTime()
      );
    });
    
    return { daySegments };
  }, [monthSegments]);

  const handleOverflowClick = (dayIndex: number, event: React.MouseEvent) => {
    const segments = daySegments[dayIndex] || [];
    const overflowShifts = segments.slice(maxSlots);
    
    if (overflowShifts.length === 0) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setOverflowPopover({
      isOpen: true,
      shifts: overflowShifts,
      position: {
        top: rect.top,
        left: rect.left
      }
    });
  };

  const closeOverflowPopover = () => {
    setOverflowPopover(prev => ({ ...prev, isOpen: false }));
  };

  return (
    <>
      <div className="grid grid-cols-7 gap-2">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-2 text-center text-sm font-semibold text-gray-600">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {days.map((day, dayIndex) => {
          const segments = daySegments[dayIndex] || [];
          const visibleSegments = segments.slice(0, maxSlots);
          const hasOverflow = segments.length > maxSlots;
          
          return (
            <div
              key={dayIndex}
              className={`calendar-month-cell border ${
                day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              } ${day.isToday ? 'ring-2 ring-purple-500' : ''}`}
            >
              {/* Date number */}
              <div className={`text-xs p-1 text-right ${
                day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
              } ${day.isToday ? 'font-bold' : ''}`}>
                {day.date.getDate()}
              </div>
              
              {/* Shift stack */}
              <div className="calendar-month-stack">
                {visibleSegments.map((segment, slotIndex) => (
                  <ShiftPill
                    key={segment.id}
                    segment={segment}
                    view="month"
                    slotIndex={slotIndex}
                    maxSlots={maxSlots}
                  />
                ))}
                
                {/* Overflow indicator */}
                {hasOverflow && (
                  <div
                    className="calendar-overflow"
                    onClick={(e) => handleOverflowClick(dayIndex, e)}
                  >
                    +{segments.length - maxSlots} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Overflow popover */}
      <OverflowPopover
        shifts={overflowPopover.shifts}
        isOpen={overflowPopover.isOpen}
        onClose={closeOverflowPopover}
        position={overflowPopover.position}
      />
    </>
  );
};

export default CalendarMonth;
