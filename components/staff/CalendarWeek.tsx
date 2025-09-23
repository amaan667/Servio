'use client';

import React, { useMemo } from 'react';
import { Shift, ShiftSegment, getShiftSegments, layoutLanes, minutesFromMidnight, minutesBetween, getWeekDays } from '@/lib/calendar-utils';
import ShiftPill from './ShiftPill';

interface CalendarWeekProps {
  date: Date;
  shifts: Shift[];
  pxPerMinute?: number;
}

const CalendarWeek: React.FC<CalendarWeekProps> = ({ 
  date, 
  shifts, 
  pxPerMinute = 1 
}) => {
  const weekDays = useMemo(() => getWeekDays(date), [date]);

  // Get all shift segments for the week
  const weekSegments = useMemo(() => {
    const allSegments: Array<ShiftSegment & { dayIndex: number }> = [];
    
    weekDays.forEach((day, dayIndex) => {
      const daySegments = shifts.flatMap(shift => 
        getShiftSegments(shift, day).map(segment => ({
          ...segment,
          dayIndex
        }))
      );
      allSegments.push(...daySegments);
    });
    
    return allSegments;
  }, [shifts, weekDays]);

  // Calculate positioning for each day
  const { positionedSegments, nowLinePosition } = useMemo(() => {
    const positionedSegments: Array<ShiftSegment & { 
      dayIndex: number; 
      top: number; 
      height: number; 
      laneIndex: number; 
      laneCount: number; 
    }> = [];

    // Process each day separately for lane calculation
    weekDays.forEach((day, dayIndex) => {
      const daySegments = weekSegments.filter(seg => seg.dayIndex === dayIndex);
      
      if (daySegments.length === 0) return;
      
      const timeSegments = daySegments.map(segment => ({
        id: segment.id,
        start: minutesFromMidnight(segment.start),
        end: minutesFromMidnight(segment.end)
      }));

      const { laneOf, groups } = layoutLanes(timeSegments);
      
      daySegments.forEach(segment => {
        const startMinutes = minutesFromMidnight(segment.start);
        const endMinutes = minutesFromMidnight(segment.end);
        const duration = minutesBetween(segment.start, segment.end);
        
        const top = startMinutes * pxPerMinute;
        const height = Math.max(20, duration * pxPerMinute);
        
        const laneIndex = laneOf[segment.id] || 0;
        const group = groups.find(g => g.ids.includes(segment.id));
        const laneCount = group?.laneCount || 1;
        
        positionedSegments.push({
          ...segment,
          dayIndex,
          top,
          height,
          laneIndex,
          laneCount
        });
      });
    });

    // Calculate "now" line position for today
    const now = new Date();
    const todayIndex = weekDays.findIndex(day => day.toDateString() === now.toDateString());
    const nowLinePosition = todayIndex >= 0 ? {
      dayIndex: todayIndex,
      top: minutesFromMidnight(now) * pxPerMinute
    } : null;

    return { positionedSegments, nowLinePosition };
  }, [weekSegments, weekDays, pxPerMinute]);

  // Generate time ruler lines
  const timeLines = useMemo(() => {
    const lines = [];
    for (let hour = 0; hour < 24; hour++) {
      const top = hour * 60 * pxPerMinute;
      
      // Major line every hour
      lines.push(
        <div
          key={`hour-${hour}`}
          className="calendar-time-line major"
          style={{ top }}
        >
          <div className="calendar-time-label" style={{ top: '50%' }}>
            {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
          </div>
        </div>
      );
      
      // Minor line every 30 minutes
      if (hour < 23) {
        lines.push(
          <div
            key={`half-${hour}`}
            className="calendar-time-line"
            style={{ top: top + (30 * pxPerMinute) }}
          />
        );
      }
    }
    return lines;
  }, [pxPerMinute]);

  return (
    <div className="calendar-time-grid flex">
      {/* Time ruler */}
      <div className="calendar-time-ruler">
        {timeLines}
      </div>
      
      {/* Day columns */}
      {weekDays.map((day, dayIndex) => (
        <div key={day.toISOString()} className="calendar-day-column flex-1">
          <div className="calendar-stack relative">
            {positionedSegments
              .filter(seg => seg.dayIndex === dayIndex)
              .map(segment => (
                <ShiftPill
                  key={segment.id}
                  segment={segment}
                  view="week"
                  laneIndex={segment.laneIndex}
                  laneCount={segment.laneCount}
                  style={{
                    top: segment.top,
                    height: segment.height
                  }}
                />
              ))}
            
            {/* Now line for today */}
            {nowLinePosition?.dayIndex === dayIndex && (
              <div
                className="calendar-now-line"
                style={{ top: nowLinePosition.top }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CalendarWeek;
