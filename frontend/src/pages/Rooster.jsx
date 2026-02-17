import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { 
  getWeekDays, formatDate, formatTime, toISODateString, isToday, 
  addDays, calculateHours
} from '../utils/dates';
import { ChevronLeft, ChevronRight, Calendar, Plus, Edit2, Trash2, Send, X, CalendarDays } from 'lucide-react';

const SHIFT_COLORS = {
  'Kassa': 'bg-blue-100 border-blue-300 text-blue-800',
  'Magazijn': 'bg-green-100 border-green-300 text-green-800',
  'Vakkenvullen': 'bg-yellow-100 border-yellow-300 text-yellow-800',
  'Klantenservice': 'bg-purple-100 border-purple-300 text-purple-800',
  'default': 'bg-gray-100 border-gray-300 text-gray-800'
};

function Rooster() {
  const { isManager, user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [filterEmployee, setFilterEmployee] = useState('');

  const weekDays = getWeekDays(currentDate);
  const weekStart = toISODateString(weekDays[0]);
  const weekEnd = toISODateString(weekDays[6]);

  useEffect(() => {
    loadData();
  }, [currentDate, filterEmployee]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = { startDatum: weekStart, eindDatum: weekEnd };
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

  const navigateWeek = (direction) => {
    setCurrentDate(addDays(currentDate, direction * 7));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleCreateShift = async (data) => {
    try {
      if (editingShift?.id) {
        await api.put(`/shifts/${editingShift.id}`, data);
      } else {
        await api.post('/shifts', data);
      }
      setShowModal(false);
      setEditingShift(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij opslaan');
    }
  };

  const handleDeleteShift = async (shiftId) => {
    if (!confirm('Weet je zeker dat je deze dienst wilt verwijderen?')) return;
    try {
      await api.delete(`/shifts/${shiftId}`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij verwijderen');
    }
  };

  const handlePublishWeek = async () => {
    if (!confirm('Wil je het rooster voor deze week publiceren?')) return;
    try {
      await api.post('/shifts/publish', { startDatum: weekStart, eindDatum: weekEnd });
      alert('Rooster gepubliceerd! Medewerkers ontvangen een notificatie.');
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij publiceren');
    }
  };

  const getShiftsForDay = (date) => {
    const dateStr = toISODateString(date);
    return shifts.filter(s => s.datum === dateStr);
  };

  const getShiftColor = (afdeling) => {
    return SHIFT_COLORS[afdeling] || SHIFT_COLORS.default;
  };

  const unpublishedCount = shifts.filter(s => s.status === 'gepland').length;
  const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooster</h1>
          <p className="text-gray-600">Week van {formatDate(weekDays[0], 'd MMM')} - {formatDate(weekDays[6], 'd MMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/rooster/maand" className="btn btn-secondary btn-sm flex items-center gap-1">
            <CalendarDays className="w-4 h-4" />
            Maand
          </Link>
          {isManager && (
            <>
              {unpublishedCount > 0 && (
                <button onClick={handlePublishWeek} className="btn btn-success btn-sm flex items-center gap-1">
                  <Send className="w-4 h-4" />
                  Publiceer ({unpublishedCount})
                </button>
              )}
              <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm flex items-center gap-1">
                <Plus className="w-4 h-4" />
                Dienst
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation & Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-lg p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={goToToday} className="btn btn-secondary btn-sm">Vandaag</button>
          <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5" />
          </button>
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

      {/* Week grid */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
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

              {/* Shifts grid */}
              <div className="grid grid-cols-7 min-h-[400px]">
                {weekDays.map((day) => {
                  const dayShifts = getShiftsForDay(day);
                  return (
                    <div 
                      key={day.toString()} 
                      className={`p-2 border-r last:border-r-0 min-h-[150px] ${
                        isToday(day) ? 'bg-primary-50/50' : ''
                      }`}
                    >
                      {dayShifts.map((shift) => (
                        <div 
                          key={shift.id}
                          className={`mb-2 p-2 rounded border text-xs ${getShiftColor(shift.afdeling)} ${
                            shift.status === 'gepland' ? 'border-dashed opacity-75' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              {isManager && (
                                <p className="font-semibold truncate">{shift.medewerker_naam}</p>
                              )}
                              <p className="font-medium">
                                {formatTime(shift.starttijd)} - {formatTime(shift.eindtijd)}
                              </p>
                              <p className="text-[10px] opacity-75">{shift.afdeling}</p>
                            </div>
                            {isManager && (
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => { setEditingShift(shift); setShowModal(true); }}
                                  className="p-1 hover:bg-white/50 rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteShift(shift.id)}
                                  className="p-1 hover:bg-white/50 rounded text-red-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          {shift.status === 'gepland' && (
                            <span className="inline-block mt-1 text-[10px] bg-white/50 px-1 rounded">
                              Concept
                            </span>
                          )}
                        </div>
                      ))}
                      {isManager && (
                        <button 
                          onClick={() => { 
                            setEditingShift({ datum: toISODateString(day) }); 
                            setShowModal(true); 
                          }}
                          className="w-full p-2 border-2 border-dashed border-gray-200 rounded text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors text-xs"
                        >
                          + Toevoegen
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-medium text-gray-900 mb-2">Samenvatting deze week</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Totaal diensten</p>
            <p className="text-xl font-semibold">{shifts.length}</p>
          </div>
          <div>
            <p className="text-gray-500">Gepubliceerd</p>
            <p className="text-xl font-semibold text-green-600">
              {shifts.filter(s => s.status === 'gepubliceerd').length}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Concept</p>
            <p className="text-xl font-semibold text-yellow-600">{unpublishedCount}</p>
          </div>
          <div>
            <p className="text-gray-500">Totaal uren</p>
            <p className="text-xl font-semibold">
              {shifts.reduce((sum, s) => sum + calculateHours(s.starttijd, s.eindtijd, s.pauze), 0).toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Shift Modal */}
      {showModal && (
        <ShiftModal 
          shift={editingShift}
          employees={employees}
          onSave={handleCreateShift}
          onClose={() => { setShowModal(false); setEditingShift(null); }}
        />
      )}
    </div>
  );
}

function ShiftModal({ shift, employees, onSave, onClose }) {
  const [formData, setFormData] = useState({
    medewerker_id: shift?.medewerker_id || '',
    datum: shift?.datum || toISODateString(new Date()),
    starttijd: shift?.starttijd || '09:00',
    eindtijd: shift?.eindtijd || '17:00',
    pauze: shift?.pauze || 30,
    afdeling: shift?.afdeling || 'Kassa',
    notities: shift?.notities || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {shift?.id ? 'Dienst bewerken' : 'Nieuwe dienst'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Medewerker</label>
            <select
              value={formData.medewerker_id}
              onChange={(e) => setFormData({ ...formData, medewerker_id: e.target.value })}
              className="input"
              required
            >
              <option value="">Selecteer medewerker</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.naam}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Datum</label>
            <input
              type="date"
              value={formData.datum}
              onChange={(e) => setFormData({ ...formData, datum: e.target.value })}
              className="input"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Starttijd</label>
              <input
                type="time"
                value={formData.starttijd}
                onChange={(e) => setFormData({ ...formData, starttijd: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Eindtijd</label>
              <input
                type="time"
                value={formData.eindtijd}
                onChange={(e) => setFormData({ ...formData, eindtijd: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Pauze (min)</label>
              <input
                type="number"
                value={formData.pauze}
                onChange={(e) => setFormData({ ...formData, pauze: parseInt(e.target.value) })}
                className="input"
                min="0"
                step="5"
              />
            </div>
            <div>
              <label className="label">Afdeling</label>
              <select
                value={formData.afdeling}
                onChange={(e) => setFormData({ ...formData, afdeling: e.target.value })}
                className="input"
              >
                <option value="Kassa">Kassa</option>
                <option value="Magazijn">Magazijn</option>
                <option value="Vakkenvullen">Vakkenvullen</option>
                <option value="Klantenservice">Klantenservice</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Notities (optioneel)</label>
            <textarea
              value={formData.notities}
              onChange={(e) => setFormData({ ...formData, notities: e.target.value })}
              className="input"
              rows="2"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn btn-secondary">
              Annuleren
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn btn-primary">
              {saving ? <div className="spinner" /> : shift?.id ? 'Opslaan' : 'Toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Rooster;