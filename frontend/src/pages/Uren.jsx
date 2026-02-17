import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDate, formatTime, toISODateString, calculateHours } from '../utils/dates';
import { Clock, Play, Square, Coffee, Check } from 'lucide-react';

function Uren() {
  const { user } = useAuth();
  const [activeRegistration, setActiveRegistration] = useState(null);
  const [todayRegistrations, setTodayRegistrations] = useState([]);
  const [weekRegistrations, setWeekRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const today = toISODateString(new Date());
      const weekAgo = toISODateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

      const [activeRes, todayRes, weekRes] = await Promise.all([
        api.get('/time-registrations/active'),
        api.get('/time-registrations', { params: { datum: today } }),
        api.get('/time-registrations', { params: { startDatum: weekAgo, eindDatum: today } })
      ]);

      setActiveRegistration(activeRes.data);
      setTodayRegistrations(todayRes.data);
      setWeekRegistrations(weekRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      await api.post('/time-registrations/clock-in');
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij inklokken');
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async (pauzeMinuten = 0) => {
    setClockingOut(true);
    try {
      await api.post('/time-registrations/clock-out', { pauze_minuten: pauzeMinuten });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij uitklokken');
    } finally {
      setClockingOut(false);
    }
  };

  const getElapsedTime = () => {
    if (!activeRegistration?.inchecktijd) return '0:00';
    const start = new Date(`2000-01-01T${activeRegistration.inchecktijd}`);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000 / 60);
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  const getTotalWeekHours = () => {
    return weekRegistrations.reduce((sum, reg) => {
      if (reg.inchecktijd && reg.uitchecktijd) {
        return sum + calculateHours(reg.inchecktijd, reg.uitchecktijd, reg.pauze_minuten);
      }
      return sum;
    }, 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Urenregistratie</h1>
        <p className="text-gray-600">Klok in en uit voor je diensten</p>
      </div>

      {/* Clock in/out card */}
      <div className="card text-center">
        {activeRegistration ? (
          <>
            <div className="mb-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-10 h-10 text-green-600 animate-pulse" />
              </div>
              <p className="text-sm text-gray-500">Je bent ingeklokt sinds</p>
              <p className="text-3xl font-bold text-gray-900">{formatTime(activeRegistration.inchecktijd)}</p>
              <p className="text-lg text-green-600 font-medium mt-1">Actief: {getElapsedTime()}</p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-gray-600">Pauze gehad?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[0, 15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleClockOut(mins)}
                    disabled={clockingOut}
                    className="btn btn-danger flex items-center gap-2"
                  >
                    {clockingOut ? (
                      <div className="spinner" />
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        Uitklokken {mins > 0 && `(${mins} min pauze)`}
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-600">Je bent momenteel niet ingeklokt</p>
            </div>

            <button
              onClick={handleClockIn}
              disabled={clockingIn}
              className="btn btn-primary btn-lg"
            >
              {clockingIn ? (
                <div className="spinner" />
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Inklokken
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Today's registrations */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Vandaag</h2>
        {todayRegistrations.length > 0 ? (
          <div className="space-y-3">
            {todayRegistrations.map((reg) => (
              <div key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    reg.goedgekeurd ? 'bg-green-100' : 'bg-yellow-100'
                  }`}>
                    {reg.goedgekeurd ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {formatTime(reg.inchecktijd)} - {reg.uitchecktijd ? formatTime(reg.uitchecktijd) : 'Actief'}
                    </p>
                    {reg.pauze_minuten > 0 && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Coffee className="w-3 h-3" /> {reg.pauze_minuten} min pauze
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {reg.uitchecktijd 
                      ? `${calculateHours(reg.inchecktijd, reg.uitchecktijd, reg.pauze_minuten).toFixed(2)} uur`
                      : '-'
                    }
                  </p>
                  <span className={`badge ${reg.goedgekeurd ? 'badge-green' : 'badge-yellow'}`}>
                    {reg.goedgekeurd ? 'Goedgekeurd' : 'In behandeling'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-4">Nog geen registraties vandaag</p>
        )}
      </div>

      {/* Week summary */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Deze week</h2>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-4 bg-primary-50 rounded-lg">
            <p className="text-sm text-gray-600">Totaal uren</p>
            <p className="text-3xl font-bold text-primary-600">{getTotalWeekHours().toFixed(1)}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Registraties</p>
            <p className="text-3xl font-bold text-gray-900">{weekRegistrations.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Uren;