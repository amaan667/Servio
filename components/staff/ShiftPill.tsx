'use client';

import React, { memo } from 'react';
import { Shift, ShiftSegment, isOvernight, formatTime, getRoleColor } from '@/lib/calendar-utils';

interface ShiftPillProps {
  segment: ShiftSegment;
  view: 'month' | 'week' | 'day';
  laneIndex?: number;
  laneCount?: number;
  slotIndex?: number;
  maxSlots?: number;
  onOverflowClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

const ShiftPill = memo(function ShiftPill({
  segment,
  view,
  laneIndex = 0,
  laneCount = 1,
  slotIndex = 0,
  maxSlots = 4,
  onOverflowClick,
  style,
  className = ''
}: ShiftPillProps) {
  const { shift } = segment;
  const overnight = isOvernight(shift);
  const roleColor = getRoleColor(shift.role);
  
  // Calculate positioning based on view
  const getPositioning = () => {
    if (view === 'month') {
      return {
        top: slotIndex * 26, // 24px height + 2px gap
        left: 0,
        right: 0,
        width: '100%',
        height: 24
      };
    } else {
      // Week/Day view with lanes
      const left = (laneIndex / laneCount) * 100;
      const width = (1 / laneCount) * 100;
      return {
        left: `${left}%`,
        width: `${width}%`,
        height: 'auto'
      };
    }
  };

  const positioning = getPositioning();
  
  // Check if this is an overflow indicator
  if (slotIndex >= maxSlots) {
    return (
      <div
        className="calendar-overflow"
        onClick={onOverflowClick}
        style={positioning}
      >
        +{slotIndex - maxSlots + 1} more
      </div>
    );
  }

  const baseClasses = [
    'calendar-shift',
    'calendar-pill',
    view === 'month' ? 'calendar-month-pill' : 
    view === 'week' ? 'calendar-week-pill' : 'calendar-day-pill',
    overnight ? 'overnight' : '',
    className
  ].filter(Boolean).join(' ');

  const pillStyle: React.CSSProperties = {
    ...positioning,
    ...style,
    borderLeftColor: roleColor,
    zIndex: 10
  };

  const getContent = () => {
    if (view === 'month') {
      return (
        <div className="title">
          {overnight && <span className="mr-1">🌙</span>}
          {shift.staffName}
        </div>
      );
    } else {
      return (
        <div className="space-y-1">
          <div className="title font-semibold">
            {overnight && <span className="mr-1">🌙</span>}
            {shift.staffName}
          </div>
          <div className="text-xs opacity-75">
            {formatTime(segment.start)} - {formatTime(segment.end)}
          </div>
          <div className="text-xs opacity-60">
            {shift.role}
          </div>
        </div>
      );
    }
  };

  const getTooltip = () => {
    const parts = [
      `${shift.staffName} (${shift.role})`,
      `${formatTime(segment.start)} - ${formatTime(segment.end)}`,
      overnight ? 'Overnight Shift' : ''
    ].filter(Boolean);
    
    if (overnight && !segment.isFirst) {
      parts.push(`Continues from ${new Date(shift.startsAt).toLocaleDateString()}`);
    }
    if (overnight && !segment.isLast) {
      parts.push(`Continues to ${new Date(shift.endsAt).toLocaleDateString()}`);
    }
    
    return parts.join(' - ');
  };

  return (
    <div
      className={baseClasses}
      style={pillStyle}
      data-role={shift.role}
      title={getTooltip()}
      onClick={() => {
        console.log('[AUTH DEBUG] Shift clicked:', shift);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          console.log('[AUTH DEBUG] Shift activated:', shift);
        }
      }}
      tabIndex={0}
      role="button"
    >
      {getContent()}
    </div>
  );
});

export default ShiftPill;
