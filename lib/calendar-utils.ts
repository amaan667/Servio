export type Shift = {
  id: string;
  staffName: string;
  role: 'Kitchen' | 'Front of House' | 'Bar' | string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  color?: string;   // optional role color
  isOvernight?: boolean; // derived
};

export type ShiftSegment = {
  id: string;
  shift: Shift;
  day: Date;
  start: Date;
  end: Date;
  isFirst: boolean;
  isLast: boolean;
};

export function isOvernight(shift: Shift): boolean {
  const startDate = new Date(shift.startsAt);
  const endDate = new Date(shift.endsAt);
  return startDate.toDateString() !== endDate.toDateString();
}

export function clampToDay(shift: Shift, day: Date): { start: Date; end: Date } {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  
  const shiftStart = new Date(shift.startsAt);
  const shiftEnd = new Date(shift.endsAt);
  
  return {
    start: shiftStart < dayStart ? dayStart : shiftStart,
    end: shiftEnd > dayEnd ? dayEnd : shiftEnd
  };
}

export function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
}

export function getShiftSegments(shift: Shift, day: Date): ShiftSegment[] {
  const segments: ShiftSegment[] = [];
  const shiftStart = new Date(shift.startsAt);
  const shiftEnd = new Date(shift.endsAt);
  
  // Check if shift overlaps with this day
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(day);
  dayEnd.setHours(23, 59, 59, 999);
  
  if (shiftEnd < dayStart || shiftStart > dayEnd) {
    return segments; // No overlap
  }
  
  const clamped = clampToDay(shift, day);
  const isFirst = shiftStart.toDateString() === day.toDateString();
  const isLast = shiftEnd.toDateString() === day.toDateString();
  
  segments.push({
    id: `${shift.id}-${day.toISOString().split('T')[0]}`,
    shift,
    day,
    start: clamped.start,
    end: clamped.end,
    isFirst,
    isLast
  });
  
  return segments;
}

export function layoutLanes(segments: Array<{id: string; start: number; end: number}>): {
  laneOf: Record<string, number>;
  groups: Array<{ids: string[]; laneCount: number}>;
} {
  // start/end in minutes from midnight for that day
  segments.sort((a, b) => a.start - b.start || a.end - b.end);
  const lanes: number[] = []; // end time per lane
  const placed: Record<string, number> = {}; // shiftId -> laneIndex
  let groups: Array<{ids: string[]; laneCount: number}> = [];

  let currentGroup: string[] = [];
  let groupEnd = -1;

  for (const seg of segments) {
    // assign lane
    let laneIndex = lanes.findIndex(end => end <= seg.start);
    if (laneIndex === -1) { 
      laneIndex = lanes.length; 
      lanes.push(seg.end); 
    } else { 
      lanes[laneIndex] = seg.end; 
    }

    placed[seg.id] = laneIndex;

    // group tracking
    if (seg.start > groupEnd) {
      if (currentGroup.length) {
        groups.push({ ids: currentGroup, laneCount: lanes.length });
      }
      currentGroup = [seg.id];
      groupEnd = seg.end;
      lanes.length = 0; 
      lanes.push(seg.end);
    } else {
      currentGroup.push(seg.id);
      groupEnd = Math.max(groupEnd, seg.end);
    }
  }
  
  if (currentGroup.length) {
    groups.push({ 
      ids: currentGroup, 
      laneCount: Math.max(...Object.values(placed)) + 1 
    });
  }

  return { laneOf: placed, groups };
}

export function getRoleColor(role: string): string {
  switch (role) {
    case 'Kitchen':
      return '#10b981';
    case 'Front of House':
      return '#6366f1';
    case 'Bar':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
}

export function getDaysInMonth(date: Date): Array<{date: Date; isCurrentMonth: boolean; isToday: boolean}> {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  const days = [];
  
  // Add previous month's days to fill the first week
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(year, month, -i);
    days.push({ date: prevDate, isCurrentMonth: false, isToday: false });
  }
  
  // Add current month's days
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(year, month, i);
    const today = new Date();
    const isToday = currentDate.toDateString() === today.toDateString();
    days.push({ date: currentDate, isCurrentMonth: true, isToday });
  }
  
  // Add next month's days to fill the last week
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let i = 1; i <= remainingDays; i++) {
    const nextDate = new Date(year, month + 1, i);
    days.push({ date: nextDate, isCurrentMonth: false, isToday: false });
  }
  
  return days;
}

export function getWeekDays(date: Date): Date[] {
  const startOfWeek = new Date(date);
  const day = startOfWeek.getDay();
  startOfWeek.setDate(startOfWeek.getDate() - day);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek);
    day.setDate(startOfWeek.getDate() + i);
    days.push(day);
  }
  return days;
}
