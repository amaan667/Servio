"use client";

import { Clock } from "lucide-react";

interface EmptyStateProps {

}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-gray-900">
      <Clock className="h-12 w-12 text-gray-700 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-700">{description}</p>
    </div>
  );
}
