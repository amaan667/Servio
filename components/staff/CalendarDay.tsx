'use client';

import React, { useMemo } from 'react';
import { Shift, ShiftSegment, getShiftSegments, layoutLanes, minutesFromMidnight, minutesBetween } from '@/lib/calendar-utils';
import ShiftPill from './ShiftPill';

interface CalendarDayProps {
  date: Date;
  shifts: Shift[];
  pxPerMinute?: number;
}

const CalendarDay: React.FC<CalendarDayProps> = ({ 
  date, 
  shifts, 
  pxPerMinute = 1 
}) => {
  // Get all shift segments for this day
  const segments = useMemo(() => {
    return shifts.flatMap(shift => getShiftSegments(shift, date));
  }, [shifts, date]);

  // Calculate time-based positioning and lanes
  const { positionedSegments, nowLinePosition } = useMemo(() => {
    const timeSegments = segments.map(segment => ({
      id: segment.id,
      start: minutesFromMidnight(segment.start),
      end: minutesFromMidnight(segment.end)
    }));

    const { laneOf, groups } = layoutLanes(timeSegments);
    
    const positionedSegments = segments.map(segment => {
      const startMinutes = minutesFromMidnight(segment.start);
      const endMinutes = minutesFromMidnight(segment.end);
      const duration = minutesBetween(segment.start, segment.end);
      
      const top = startMinutes * pxPerMinute;
      const height = Math.max(20, duration * pxPerMinute); // minimum 20px height
      
      const laneIndex = laneOf[segment.id] || 0;
      const group = groups.find(g => g.ids.includes(segment.id));
      const laneCount = group?.laneCount || 1;
      
      return {
        ...segment,
        top,
        height,
        laneIndex,
        laneCount
      };
    });

    // Calculate "now" line position
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const nowLinePosition = isToday ? minutesFromMidnight(now) * pxPerMinute : null;

    return { positionedSegments, nowLinePosition };
  }, [segments, pxPerMinute, date]);

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
    <div className="calendar-day-column flex-1">
      <div className="calendar-time-ruler">
        {timeLines}
      </div>
      
      <div className="calendar-stack relative" style={{ marginLeft: '40px' }}>
        {positionedSegments.map(segment => (
          <ShiftPill
            key={segment.id}
            segment={segment}
            view="day"
            laneIndex={segment.laneIndex}
            laneCount={segment.laneCount}
            style={{
              top: segment.top,
              height: segment.height
            }}
          />
        ))}
        
        {/* Now line */}
        {nowLinePosition !== null && (
          <div
            className="calendar-now-line"
            style={{ top: nowLinePosition }}
          />
        )}
      </div>
    </div>
  );
};

export default CalendarDay;
