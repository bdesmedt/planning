import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  getMonthDays, formatDate, formatTime, toISODateString, isToday, isSameMonth,
  addMonths, subMonths, startOfMonth, endOfMonth
} from '../utils/dates';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const SHIFT_COLORS = {
  'Kassa': 'bg-blue-500',
  'Magazijn': 'bg-green-500',
  'Vakkenvullen': 'bg-yellow-500',
  'Klantenservice': 'bg-purple-500',
  'default': 'bg-gray-500'
};

function RoosterMaand() {
  const { isManager } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);

  const monthDays = getMonthDays(currentDate);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  useEffect(() => {
    loadData();
  }, [currentDate, filterEmployee]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { 
        startDatum: toISODateString(monthDays[0]), 
        eindDatum: toISODateString(monthDays[monthDays.length - 1])
      };
      if (filterEmployee) params.medewerker_id = filterEmployee;
      
      const [shiftsRes, employeesRes] = await Promise.all([
        api.get('/shifts', { params }),
        isManager ? api.get('/employees') : Promise.resolve({ data: [] })
      ]);
      
      setShifts(shiftsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error loading shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateMonth = (direction) => {
    setCurrentDate(direction > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getShiftsForDay = (date) => {
    const dateStr = toISODateString(date);
    return shifts.filter(s => s.datum === dateStr);
  };

  const getShiftColor = (afdeling) => {
    return SHIFT_COLORS[afdeling] || SHIFT_COLORS.default;
  };

  const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maandoverzicht</h1>
          <p className="text-gray-600">{formatDate(currentDate, 'MMMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/rooster" className="btn btn-secondary btn-sm flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Week
          </Link>
        </div>
      </div>

      {/* Navigation & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={goToToday} className="btn btn-secondary btn-sm">Vandaag</button>
          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="ml-2 font-medium text-gray-900 hidden sm:inline">
            {formatDate(currentDate, 'MMMM yyyy')}
          </span>
        </div>
        
        {isManager && (
          <select 
            value={filterEmployee} 
            onChange={(e) => setFilterEmployee(e.target.value)}
            className="input w-full sm:w-48"
          >
            <option value="">Alle medewerkers</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.naam}</option>
            ))}
          </select>
        )}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b bg-gray-50">
              {dayNames.map((day) => (
                <div key={day} className="p-2 text-center text-xs font-semibold text-gray-600 uppercase">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7">
              {monthDays.map((day, index) => {
                const dayShifts = getShiftsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const today = isToday(day);

                return (
                  <div 
                    key={index} 
                    onClick={() => dayShifts.length > 0 && setSelectedDay({ date: day, shifts: dayShifts })}
                    className={`min-h-[80px] sm:min-h-[100px] p-1 sm:p-2 border-b border-r cursor-pointer hover:bg-gray-50 transition-colors ${
                      !isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''
                    } ${today ? 'bg-primary-50' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      today ? 'w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center' : ''
                    }`}>
                      {formatDate(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayShifts.slice(0, 3).map((shift) => (
                        <div 
                          key={shift.id}
                          className={`text-[10px] sm:text-xs px-1 py-0.5 rounded text-white truncate ${getShiftColor(shift.afdeling)}`}
                        >
                          <span className="hidden sm:inline">{shift.medewerker_naam?.split(' ')[0]} </span>
                          {formatTime(shift.starttijd)}
                        </div>
                      ))}
                      {dayShifts.length > 3 && (
                        <div className="text-[10px] text-gray-500">
                          +{dayShifts.length - 3} meer
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Legenda</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SHIFT_COLORS).filter(([key]) => key !== 'default').map(([afdeling, color]) => (
            <div key={afdeling} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${color}`} />
              <span className="text-sm text-gray-600">{afdeling}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day detail modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSelectedDay(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4">
              <h2 className="text-lg font-semibold">
                {formatDate(selectedDay.date, 'EEEE d MMMM')}
              </h2>
              <p className="text-sm text-gray-500">{selectedDay.shifts.length} dienst(en)</p>
            </div>
            <div className="p-4 space-y-3">
              {selectedDay.shifts.map((shift) => (
                <div 
                  key={shift.id}
                  className={`p-3 rounded-lg border-l-4 bg-gray-50 ${getShiftColor(shift.afdeling).replace('bg-', 'border-')}`}
                >
                  <p className="font-medium">{shift.medewerker_naam}</p>
                  <p className="text-sm text-gray-600">
                    {formatTime(shift.starttijd)} - {formatTime(shift.eindtijd)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{shift.afdeling}</p>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t p-4">
              <button onClick={() => setSelectedDay(null)} className="w-full btn btn-secondary">
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoosterMaand;