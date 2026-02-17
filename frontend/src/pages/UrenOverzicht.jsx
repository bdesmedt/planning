import { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
  formatDate, formatTime, toISODateString, 
  startOfWeek, endOfWeek, addDays, calculateHours 
} from '../utils/dates';
import { Clock, CheckCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';

function UrenOverzicht() {
  const [registrations, setRegistrations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  useEffect(() => {
    loadData();
  }, [currentWeek, filterEmployee, filterStatus]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        startDatum: toISODateString(weekStart),
        eindDatum: toISODateString(weekEnd)
      };
      if (filterEmployee) params.medewerker_id = filterEmployee;
      if (filterStatus) params.goedgekeurd = filterStatus === 'approved';

      const [regsRes, empsRes] = await Promise.all([
        api.get('/time-registrations', { params }),
        api.get('/employees')
      ]);
      setRegistrations(regsRes.data);
      setEmployees(empsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await api.post(`/time-registrations/${id}/approve`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij goedkeuren');
    }
  };

  const handleApproveAll = async () => {
    const pending = registrations.filter(r => !r.goedgekeurd && r.uitchecktijd);
    if (pending.length === 0) {
      alert('Geen uren om goed te keuren');
      return;
    }
    
    if (!confirm(`Wil je ${pending.length} urenregistratie(s) goedkeuren?`)) return;

    try {
      await Promise.all(pending.map(r => api.post(`/time-registrations/${r.id}/approve`)));
      loadData();
    } catch (error) {
      alert('Fout bij goedkeuren van sommige uren');
      loadData();
    }
  };

  const navigateWeek = (direction) => {
    setCurrentWeek(addDays(currentWeek, direction * 7));
  };

  const goToThisWeek = () => {
    setCurrentWeek(new Date());
  };

  const calculateWorkedHours = (inchecktijd, uitchecktijd, pauze) => {
    if (!inchecktijd || !uitchecktijd) return '-';
    const hours = calculateHours(inchecktijd, uitchecktijd, pauze);
    return hours.toFixed(2);
  };

  const getTotalHours = () => {
    return registrations.reduce((sum, reg) => {
      if (reg.inchecktijd && reg.uitchecktijd) {
        return sum + calculateHours(reg.inchecktijd, reg.uitchecktijd, reg.pauze_minuten);
      }
      return sum;
    }, 0);
  };

  const getPendingCount = () => {
    return registrations.filter(r => !r.goedgekeurd && r.uitchecktijd).length;
  };

  const exportCSV = () => {
    const headers = ['Medewerker', 'Datum', 'Ingeklokt', 'Uitgeklokt', 'Pauze (min)', 'Gewerkte uren', 'Status'];
    const rows = registrations.map(reg => [
      reg.medewerker_naam,
      formatDate(reg.datum),
      formatTime(reg.inchecktijd),
      reg.uitchecktijd ? formatTime(reg.uitchecktijd) : '',
      reg.pauze_minuten,
      calculateWorkedHours(reg.inchecktijd, reg.uitchecktijd, reg.pauze_minuten),
      reg.goedgekeurd ? 'Goedgekeurd' : 'In behandeling'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uren-${toISODateString(weekStart)}-${toISODateString(weekEnd)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Urenoverzicht</h1>
          <p className="text-gray-600">Beheer urenregistraties van alle medewerkers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          {getPendingCount() > 0 && (
            <button onClick={handleApproveAll} className="btn btn-success btn-sm flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Alles goedkeuren ({getPendingCount()})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigateWeek(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={goToThisWeek} className="btn btn-secondary btn-sm">
              Deze week
            </button>
            <button onClick={() => navigateWeek(1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5" />
            </button>
            <span className="ml-2 text-gray-600">
              {formatDate(weekStart, 'd MMM')} - {formatDate(weekEnd, 'd MMM yyyy')}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="input sm:w-48"
            >
              <option value="">Alle medewerkers</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.naam}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input sm:w-40"
            >
              <option value="">Alle statussen</option>
              <option value="pending">In behandeling</option>
              <option value="approved">Goedgekeurd</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Registraties</p>
          <p className="text-2xl font-bold">{registrations.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Totaal uren</p>
          <p className="text-2xl font-bold text-primary-600">{getTotalHours().toFixed(1)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Goedgekeurd</p>
          <p className="text-2xl font-bold text-green-600">
            {registrations.filter(r => r.goedgekeurd).length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">In behandeling</p>
          <p className="text-2xl font-bold text-yellow-600">{getPendingCount()}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : registrations.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Medewerker</th>
                  <th>Datum</th>
                  <th>Ingeklokt</th>
                  <th>Uitgeklokt</th>
                  <th>Pauze</th>
                  <th>Uren</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registrations.map((reg) => (
                  <tr key={reg.id}>
                    <td className="font-medium">{reg.medewerker_naam}</td>
                    <td>{formatDate(reg.datum, 'EEE d MMM')}</td>
                    <td>{formatTime(reg.inchecktijd)}</td>
                    <td>{reg.uitchecktijd ? formatTime(reg.uitchecktijd) : <span className="text-gray-400">-</span>}</td>
                    <td>{reg.pauze_minuten} min</td>
                    <td className="font-semibold">
                      {calculateWorkedHours(reg.inchecktijd, reg.uitchecktijd, reg.pauze_minuten)}
                    </td>
                    <td>
                      {reg.goedgekeurd ? (
                        <span className="badge badge-green">Goedgekeurd</span>
                      ) : reg.uitchecktijd ? (
                        <span className="badge badge-yellow">In behandeling</span>
                      ) : (
                        <span className="badge badge-blue">Actief</span>
                      )}
                    </td>
                    <td>
                      {!reg.goedgekeurd && reg.uitchecktijd && (
                        <button
                          onClick={() => handleApprove(reg.id)}
                          className="btn btn-success btn-sm"
                        >
                          Goedkeuren
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Geen urenregistraties gevonden voor deze periode</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default UrenOverzicht;