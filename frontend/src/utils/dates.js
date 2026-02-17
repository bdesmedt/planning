import { 
  format, parseISO, isToday as fnsIsToday, isSameMonth as fnsIsSameMonth,
  startOfWeek as fnsStartOfWeek, endOfWeek as fnsEndOfWeek,
  startOfMonth as fnsStartOfMonth, endOfMonth as fnsEndOfMonth,
  addDays as fnsAddDays, subDays as fnsSubDays,
  addMonths as fnsAddMonths, subMonths as fnsSubMonths,
  addWeeks as fnsAddWeeks, subWeeks as fnsSubWeeks,
  eachDayOfInterval, differenceInMinutes, differenceInDays
} from 'date-fns';
import { nl } from 'date-fns/locale';

export const formatDate = (date, formatStr = 'd MMM yyyy') => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr, { locale: nl });
};

export const formatTime = (time) => {
  if (!time) return '';
  return time.substring(0, 5);
};

export const formatDateTime = (date) => {
  if (!date) return '';
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'd MMM yyyy HH:mm', { locale: nl });
};

export const toISODateString = (date) => {
  return format(date, 'yyyy-MM-dd');
};

export const isToday = (date) => fnsIsToday(date);
export const isSameMonth = (date1, date2) => fnsIsSameMonth(date1, date2);

export const startOfWeek = (date, options = { weekStartsOn: 1 }) => fnsStartOfWeek(date, options);
export const endOfWeek = (date, options = { weekStartsOn: 1 }) => fnsEndOfWeek(date, options);
export const startOfMonth = (date) => fnsStartOfMonth(date);
export const endOfMonth = (date) => fnsEndOfMonth(date);

export const addDays = (date, amount) => fnsAddDays(date, amount);
export const subDays = (date, amount) => fnsSubDays(date, amount);
export const addWeeks = (date, amount) => fnsAddWeeks(date, amount);
export const subWeeks = (date, amount) => fnsSubWeeks(date, amount);
export const addMonths = (date, amount) => fnsAddMonths(date, amount);
export const subMonths = (date, amount) => fnsSubMonths(date, amount);

export const getWeekDays = (date) => {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  return eachDayOfInterval({ start, end });
};

export const getMonthDays = (date) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const start = startOfWeek(monthStart);
  const end = endOfWeek(monthEnd);
  return eachDayOfInterval({ start, end });
};

export const calculateHours = (startTime, endTime, breakMinutes = 0) => {
  const today = new Date();
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  const start = new Date(today.setHours(startH, startM, 0));
  const end = new Date(today.setHours(endH, endM, 0));
  
  const minutes = differenceInMinutes(end, start) - (breakMinutes || 0);
  return minutes / 60;
};

export const getDaysBetween = (startDate, endDate) => {
  const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
  return differenceInDays(end, start) + 1;
};

export const getDutchHolidays = (year) => {
  // Fixed holidays
  const holidays = [
    { date: `${year}-01-01`, name: 'Nieuwjaarsdag' },
    { date: `${year}-04-27`, name: 'Koningsdag' },
    { date: `${year}-05-05`, name: 'Bevrijdingsdag' },
    { date: `${year}-12-25`, name: 'Eerste Kerstdag' },
    { date: `${year}-12-26`, name: 'Tweede Kerstdag' },
  ];
  
  // Easter-based holidays (simplified calculation)
  const easterDates = {
    2024: '2024-03-31',
    2025: '2025-04-20',
    2026: '2026-04-05',
    2027: '2027-03-28'
  };
  
  const easter = easterDates[year];
  if (easter) {
    const easterDate = parseISO(easter);
    holidays.push(
      { date: toISODateString(subDays(easterDate, 2)), name: 'Goede Vrijdag' },
      { date: easter, name: 'Eerste Paasdag' },
      { date: toISODateString(addDays(easterDate, 1)), name: 'Tweede Paasdag' },
      { date: toISODateString(addDays(easterDate, 39)), name: 'Hemelvaartsdag' },
      { date: toISODateString(addDays(easterDate, 49)), name: 'Eerste Pinksterdag' },
      { date: toISODateString(addDays(easterDate, 50)), name: 'Tweede Pinksterdag' }
    );
  }
  
  return holidays;
};