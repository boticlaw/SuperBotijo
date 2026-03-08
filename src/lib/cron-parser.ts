/**
 * Cron Parser Utilities
 * Parses cron expressions and calculates next run times
 */

interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Parse a cron expression into its parts
 */
function parseCron(expr: string): CronParts | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

/**
 * Convert a cron expression to human-readable text
 * Examples:
 *   "0 8 * * *" → "Every day at 8:00 AM"
 *   "0 9 * * 1" → "Every Monday at 9:00 AM"
 *   "30 14 1 * *" → "On day 1 of every month at 2:30 PM"
 */
export function cronToHuman(expr: string): string {
  const parts = parseCron(expr);
  if (!parts) return 'Invalid cron expression';

  const { minute, hour, dayOfMonth, month, dayOfWeek } = parts;

  // Format time
  const formatTime = (h: string, m: string): string => {
    if (h === '*' || m === '*') return '';
    const hourNum = parseInt(h);
    const minNum = parseInt(m);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${hour12}:${minNum.toString().padStart(2, '0')} ${period}`;
  };

  const time = formatTime(hour, minute);

  // Every minute
  if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return 'Every minute';
  }

  // Handle interval patterns (*/n) - MUST be before "every hour at minute" check
  if (minute.startsWith('*/') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const interval = minute.slice(2);
    return `Every ${interval} minutes`;
  }

  if (hour.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const interval = hour.slice(2);
    return `Every ${interval} hours`;
  }

  // Every hour at specific minute (e.g., "30 * * * *" = every hour at minute 30)
  if (minute !== '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const minNum = parseInt(minute);
    if (minNum === 0) return 'Every hour on the hour';
    return `Every hour at minute ${minute}`;
  }

  // Specific time every day
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Every day at ${time}`;
  }

  // Specific weekday
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = dayOfWeek.split(',').map(d => {
      const dayNum = parseInt(d);
      return DAYS_OF_WEEK[dayNum] || d;
    });
    if (days.length === 1) {
      return `Every ${days[0]} at ${time}`;
    }
    return `Every ${days.join(', ')} at ${time}`;
  }

  // Specific day of month
  if (minute !== '*' && hour !== '*' && dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const dayNum = parseInt(dayOfMonth);
    const suffix = getDaySuffix(dayNum);
    return `On the ${dayNum}${suffix} of every month at ${time}`;
  }

  // Specific month and day
  if (minute !== '*' && hour !== '*' && dayOfMonth !== '*' && month !== '*' && dayOfWeek === '*') {
    const dayNum = parseInt(dayOfMonth);
    const monthNum = parseInt(month) - 1;
    const suffix = getDaySuffix(dayNum);
    return `On ${MONTHS[monthNum]} ${dayNum}${suffix} at ${time}`;
  }

  // Default fallback
  return `Cron: ${expr}`;
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

/**
 * Get field values for a cron part
 */
function getFieldValues(field: string, min: number, max: number): number[] {
  if (field === '*') {
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }

  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = parseInt(step);
    const start = range === '*' ? min : parseInt(range);
    const values: number[] = [];
    for (let i = start; i <= max; i += stepNum) {
      values.push(i);
    }
    return values;
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  if (field.includes(',')) {
    return field.split(',').map(Number);
  }

  return [parseInt(field)];
}

/**
 * Check if a date matches the cron expression
 */
function matchesCron(date: Date, parts: CronParts): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  const minuteMatch = getFieldValues(parts.minute, 0, 59).includes(minute);
  const hourMatch = getFieldValues(parts.hour, 0, 23).includes(hour);
  const dayOfMonthMatch = getFieldValues(parts.dayOfMonth, 1, 31).includes(dayOfMonth);
  const monthMatch = getFieldValues(parts.month, 1, 12).includes(month);
  const dayOfWeekMatch = getFieldValues(parts.dayOfWeek, 0, 6).includes(dayOfWeek);

  // Day matching: if both day-of-month and day-of-week are specified (not *),
  // then either can match. Otherwise, both must match.
  const dayOfMonthSpecified = parts.dayOfMonth !== '*';
  const dayOfWeekSpecified = parts.dayOfWeek !== '*';

  let dayMatch: boolean;
  if (dayOfMonthSpecified && dayOfWeekSpecified) {
    dayMatch = dayOfMonthMatch || dayOfWeekMatch;
  } else {
    dayMatch = dayOfMonthMatch && dayOfWeekMatch;
  }

  return minuteMatch && hourMatch && dayMatch && monthMatch;
}

/**
 * Calculate the next N run times for a cron expression
 * @param expr - Cron expression (5 parts)
 * @param count - Number of next runs to calculate
 * @param fromDate - Starting date (defaults to now)
 * @param timezone - Timezone (defaults to UTC) - NOTE: currently uses system timezone for evaluation
 * @returns Array of Date objects representing next run times
 */
export function getNextRuns(
  expr: string,
  count: number = 3,
  fromDate: Date = new Date(),
  _timezone: string = "UTC" // Note: timezone param is accepted but currently uses system local time
): Date[] {
  const parts = parseCron(expr);
  if (!parts) return [];

  const runs: Date[] = [];
  const maxIterations = 525600; // Max 1 year of minutes

  // Start from the next minute
  const current = new Date(fromDate);
  current.setSeconds(0);
  current.setMilliseconds(0);
  current.setMinutes(current.getMinutes() + 1);

  let iterations = 0;
  while (runs.length < count && iterations < maxIterations) {
    if (matchesCron(current, parts)) {
      runs.push(new Date(current));
    }
    current.setMinutes(current.getMinutes() + 1);
    iterations++;
  }

  return runs;
}

/**
 * Validate a cron expression
 */
export function isValidCron(expr: string): boolean {
  const parts = parseCron(expr);
  if (!parts) return false;

  const validateField = (field: string, min: number, max: number): boolean => {
    if (field === '*') return true;
    
    // Handle step values (*/n or n/m)
    if (field.includes('/')) {
      const [range, step] = field.split('/');
      if (range !== '*' && !validateField(range, min, max)) return false;
      const stepNum = parseInt(step);
      return !isNaN(stepNum) && stepNum > 0;
    }

    // Handle ranges (n-m)
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
    }

    // Handle lists (n,m,...)
    if (field.includes(',')) {
      return field.split(',').every(v => {
        const num = parseInt(v);
        return !isNaN(num) && num >= min && num <= max;
      });
    }

    // Single value
    const num = parseInt(field);
    return !isNaN(num) && num >= min && num <= max;
  };

  return (
    validateField(parts.minute, 0, 59) &&
    validateField(parts.hour, 0, 23) &&
    validateField(parts.dayOfMonth, 1, 31) &&
    validateField(parts.month, 1, 12) &&
    validateField(parts.dayOfWeek, 0, 6)
  );
}

/**
 * Common cron presets
 */
export const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 8 AM', value: '0 8 * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every day at noon', value: '0 12 * * *' },
  { label: 'Every day at 6 PM', value: '0 18 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Every Friday at 5 PM', value: '0 17 * * 5' },
  { label: 'Weekdays at 9 AM', value: '0 9 * * 1-5' },
  { label: 'First day of month at midnight', value: '0 0 1 * *' },
  { label: 'Every Sunday at midnight', value: '0 0 * * 0' },
] as const;

export type CronPreset = typeof CRON_PRESETS[number];
