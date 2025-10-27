import { TimePeriod } from "../hooks/useAnalyticsData";

export function getTimePeriodLabel(period: TimePeriod): string {
  switch (period) {
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "3m":
      return "Last 3 months";
    case "1y":
      return "Last year";
    default:
      return "Last 30 days";
  }
}

export function getPeriodDisplayName(period: TimePeriod): string {
  switch (period) {
    case "7d":
      return "day";
    case "30d":
      return "day";
    case "3m":
      return "week";
    case "1y":
      return "month";
    default:
      return "day";
  }
}

export function formatTooltipDate(dateStr: string, period: TimePeriod): string {
  const date = new Date(dateStr);
  switch (period) {
    case "7d":
      return date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    case "30d":
      return date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    case "3m":
      {
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(date.getDate() + 6);
        return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      }
      const weekStart = new Date(date);
      const weekEnd = new Date(date);
      weekEnd.setDate(date.getDate() + 6);
      return `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
    case "1y":
      return date.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });
    default:
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
  }
}

export function formatXAxisLabel(
  dateStr: string,
  period: TimePeriod,
  index: number,
  total: number
): string {
  const date = new Date(dateStr);
  switch (period) {
    case "7d":
      return date.toLocaleDateString("en-GB", { weekday: "short" });
    case "30d":
      if (index % 5 === 0 || index === total - 1) {
        return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      }
      return "";
    case "3m":
      if (index % 4 === 0 || index === total - 1) {
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(date.getDate() + 6);
        return `${weekStart.getDate()}-${weekEnd.getDate()} ${weekStart.toLocaleDateString("en-GB", { month: "short" })}`;
      }
      return "";
    case "1y":
      if (index % 2 === 0 || index === total - 1) {
        return date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      }
      return "";
    default:
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
}
