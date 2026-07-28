import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

export function monthGrid(month: Date, weekStartsOn:0|1=1): Date[] {
  const start=startOfWeek(startOfMonth(month),{weekStartsOn});
  const end=endOfWeek(endOfMonth(month),{weekStartsOn});
  return eachDayOfInterval({start,end});
}
