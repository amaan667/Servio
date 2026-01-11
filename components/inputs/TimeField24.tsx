"use client";

import { useMemo } from "react";

export type TimeValue24 = { hour: number | null; minute: number | null };

export function TimeField24({
  value,
  onChange,
  disabled,
  className,
}: {
  value: TimeValue24;
  onChange: (v: TimeValue24) => void;
  disabled?: boolean;
  className?: string;
}) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []); // 0..23
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []); // 0,5,..55

  const setHour = (h: string) => onChange({ ...value, hour: h ? Number(h) : null });
  const setMinute = (m: string) => onChange({ ...value, minute: m ? Number(m) : null });

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <select
          className="w-20 rounded-md border px-2 py-2"
          value={value.hour ?? ""}
          onChange={(e) => setHour(e.target.value)}
          disabled={disabled}
        >
          <option value="">HH</option>
          {hours.map((h) => (
            <option key={h} value={h}>
              {h.toString().padStart(2, "0")}
            </option>
          ))}
        </select>
        <span>:</span>
        <select
          className="w-20 rounded-md border px-2 py-2"
          value={value.minute ?? ""}
          onChange={(e) => setMinute(e.target.value)}
          disabled={disabled}
        >
          <option value="">MM</option>
          {minutes.map((m) => (
            <option key={m} value={m}>
              {m.toString().padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default TimeField24;
