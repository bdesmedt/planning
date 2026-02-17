import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { getWeekDays, formatDate, toISODateString, addDays, isToday } from '../utils/dates';
import { CalendarRange, ChevronLeft, ChevronRight, Save, Check } from 'lucide-react';

const TIME_SLOTS = [
  { id: 'morning', label: 'Ochtend', time: '06:00 - 12:00', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'afternoon', label: 'Middag', time: '12:00 - 18:00', color: 'bg-blue-100 border-blue-300' },
  { id: 'evening', label: 'Avond', time: '18:00 - 23:00', color: 'bg-purple-100 border-purple-300' },
];

function Beschikbaarheid() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const weekDays = getWeekDays(currentDate);
  const weekStart = toISODateString(weekDays[0]);
  const weekEnd = toISODateString(weekDays[6]);

  useEffect(() => {
    loadAvailability();
  }, [currentDate]);

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const response = await api.get('/availability', {
        params: { startDatum: weekStart, eindDatum: weekEnd }
      });
      
      // Convert array to object keyed by date
      const availMap = {};
      response.data.forEach(a => {
        availMap[a.datum] = {
          morning: a.ochtend,
          afternoon: a.middag,
          evening: a.avond,
          notitie: a.notitie
        };
      });
      setAvailability(availMap);
    } catch (error) {
      console.error('Error loading availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (date, slot) => {
    const dateStr = toISODateString(date);
    setAvailability(prev => ({
      ...prev,
      [dateStr]: {
        ...prev[dateStr],
        [slot]: !prev[dateStr]?.[slot]
      }
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Convert availability object to array format
      const data = Object.entries(availability).map(([datum, slots]) => ({
        datum,
        ochtend: slots.morning || false,
        middag: slots.afternoon || false,
        avond: slots.evening || false,
        notitie: slots.notitie || ''
      }));
      
      await api.post('/availability', { beschikbaarheid: data });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij opslaan');
    } finally {
      setSaving(false);
    }
  };

  const navigateWeek = (direction) => {
    setCurrentDate(addDays(currentDate, direction * 7));
  };

  const goToThisWeek = () => {
    setCurrentDate(new Date());
  };

  const isSlotSelected = (date, slot) => {
    const dateStr = toISODateString(date);
    return availability[dateStr]?.[slot] || false;
  };

  const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beschikbaarheid</h1>
          <p className="text-gray-600">Geef aan wanneer je kunt werken</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          {saving ? (
            <div className="spinner" />
          ) : saved ? (
            <><Check className="w-5 h-5" /> Opgeslagen!</>
          ) : (
            <><Save className="w-5 h-5" /> Opslaan</>
          )}
        </button>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={goToThisWeek} className="btn btn-secondary btn-sm">Deze week</button>
          <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <span className="text-gray-600">
          {formatDate(weekDays[0], 'd MMM')} - {formatDate(weekDays[6], 'd MMM yyyy')}
        </span>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <p className="text-sm text-gray-600 mb-3">Klik op een tijdslot om aan te geven dat je beschikbaar bent:</p>
        <div className="flex flex-wrap gap-3">
          {TIME_SLOTS.map((slot) => (
            <div key={slot.id} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded border ${slot.color}`} />
              <span className="text-sm text-gray-700">{slot.label} ({slot.time})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Availability grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b bg-gray-50">
                {weekDays.map((day, i) => (
                  <div 
                    key={day.toString()} 
                    className={`p-3 text-center border-r last:border-r-0 ${
                      isToday(day) ? 'bg-primary-50' : ''
                    }`}
                  >
                    <p className="text-xs text-gray-500 uppercase">{dayNames[i]}</p>
                    <p className={`text-lg font-semibold ${isToday(day) ? 'text-primary-600' : 'text-gray-900'}`}>
                      {formatDate(day, 'd')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Time slots */}
              {TIME_SLOTS.map((slot) => (
                <div key={slot.id} className="grid grid-cols-7 border-b last:border-b-0">
                  {weekDays.map((day) => {
                    const selected = isSlotSelected(day, slot.id);
                    return (
                      <button
                        key={`${day}-${slot.id}`}
                        onClick={() => toggleSlot(day, slot.id)}
                        className={`p-4 border-r last:border-r-0 transition-all ${
                          selected 
                            ? `${slot.color} border-2` 
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="text-center">
                          <p className={`text-sm font-medium ${selected ? '' : 'text-gray-400'}`}>
                            {slot.label}
                          </p>
                          <p className={`text-xs ${selected ? '' : 'text-gray-300'}`}>
                            {slot.time}
                          </p>
                          {selected && (
                            <Check className="w-4 h-4 mx-auto mt-1 text-green-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Snelle acties</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              const newAvail = {};
              weekDays.forEach(day => {
                newAvail[toISODateString(day)] = { morning: true, afternoon: true, evening: true };
              });
              setAvailability(newAvail);
              setSaved(false);
            }}
            className="btn btn-secondary btn-sm"
          >
            Hele week beschikbaar
          </button>
          <button
            onClick={() => {
              const newAvail = {};
              weekDays.slice(0, 5).forEach(day => {
                newAvail[toISODateString(day)] = { morning: true, afternoon: true, evening: false };
              });
              setAvailability(newAvail);
              setSaved(false);
            }}
            className="btn btn-secondary btn-sm"
          >
            Werkdagen (ma-vr, dag)
          </button>
          <button
            onClick={() => {
              setAvailability({});
              setSaved(false);
            }}
            className="btn btn-secondary btn-sm text-red-600"
          >
            Alles wissen
          </button>
        </div>
      </div>
    </div>
  );
}

export default Beschikbaarheid;