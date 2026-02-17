import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDate, toISODateString, getDaysBetween } from '../utils/dates';
import { Palmtree, Plus, Calendar, CheckCircle, XCircle, Clock, X, AlertTriangle } from 'lucide-react';

const LEAVE_TYPES = [
  { value: 'vakantie', label: 'Vakantie', icon: Palmtree },
  { value: 'zorgverlof', label: 'Zorgverlof', icon: Calendar },
  { value: 'bijzonder_verlof', label: 'Bijzonder verlof', icon: Calendar },
  { value: 'onbetaald_verlof', label: 'Onbetaald verlof', icon: Calendar },
];

const STATUS_CONFIG = {
  in_behandeling: { label: 'In behandeling', color: 'badge-yellow', icon: Clock },
  goedgekeurd: { label: 'Goedgekeurd', color: 'badge-green', icon: CheckCircle },
  afgewezen: { label: 'Afgewezen', color: 'badge-red', icon: XCircle }
};

function Vakantie() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await api.get('/leave-requests/my');
      setRequests(response.data);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      await api.post('/leave-requests', data);
      setShowModal(false);
      loadRequests();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij aanvragen');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Weet je zeker dat je deze aanvraag wilt annuleren?')) return;
    try {
      await api.delete(`/leave-requests/${id}`);
      loadRequests();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij annuleren');
    }
  };

  const pendingDays = requests
    .filter(r => r.status === 'in_behandeling')
    .reduce((sum, r) => sum + r.aantal_dagen, 0);

  const approvedDays = requests
    .filter(r => r.status === 'goedgekeurd' && r.type === 'vakantie')
    .reduce((sum, r) => sum + r.aantal_dagen, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vakantie & Verlof</h1>
          <p className="text-gray-600">Beheer je verlofaanvragen</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nieuwe aanvraag
        </button>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Palmtree className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-green-700">Vakantiesaldo</p>
              <p className="text-2xl font-bold text-green-800">{user?.vakantiesaldo || 0} dagen</p>
            </div>
          </div>
        </div>

        <div className="card bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-yellow-700">In behandeling</p>
              <p className="text-2xl font-bold text-yellow-800">{pendingDays} dagen</p>
            </div>
          </div>
        </div>

        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-blue-700">Goedgekeurd dit jaar</p>
              <p className="text-2xl font-bold text-blue-800">{approvedDays} dagen</p>
            </div>
          </div>
        </div>
      </div>

      {/* Requests list */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mijn aanvragen</h2>
        
        {requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((request) => {
              const statusConfig = STATUS_CONFIG[request.status];
              const StatusIcon = statusConfig.icon;
              const leaveType = LEAVE_TYPES.find(t => t.value === request.type);

              return (
                <div key={request.id} className="border rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                        <Palmtree className="w-5 h-5 text-primary-600" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {leaveType?.label || request.type}
                          </span>
                          <span className={`badge ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {formatDate(request.begindatum, 'd MMM yyyy')}
                          {request.begindatum !== request.einddatum && (
                            <> - {formatDate(request.einddatum, 'd MMM yyyy')}</>
                          )}
                          <span className="text-gray-400 mx-2">•</span>
                          {request.aantal_dagen} dag(en)
                        </p>
                        {request.opmerking && (
                          <p className="text-sm text-gray-500 mt-1 italic">"{request.opmerking}"</p>
                        )}
                        {request.beoordeling_opmerking && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Reactie:</strong> {request.beoordeling_opmerking}
                          </p>
                        )}
                      </div>
                    </div>

                    {request.status === 'in_behandeling' && (
                      <button
                        onClick={() => handleCancel(request.id)}
                        className="btn btn-secondary btn-sm text-red-600 hover:bg-red-50"
                      >
                        Annuleren
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Palmtree className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nog geen verlofaanvragen</p>
            <button onClick={() => setShowModal(true)} className="btn btn-primary mt-4">
              Eerste aanvraag maken
            </button>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showModal && (
        <LeaveRequestModal
          balance={user?.vakantiesaldo || 0}
          onCreate={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function LeaveRequestModal({ balance, onCreate, onClose }) {
  const [formData, setFormData] = useState({
    type: 'vakantie',
    begindatum: toISODateString(new Date()),
    einddatum: toISODateString(new Date()),
    opmerking: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const days = getDaysBetween(formData.begindatum, formData.einddatum);
  const exceedsBalance = formData.type === 'vakantie' && days > balance;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onCreate(formData);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Verlof aanvragen</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Type verlof</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input"
              required
            >
              {LEAVE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Van</label>
              <input
                type="date"
                value={formData.begindatum}
                onChange={(e) => setFormData({ ...formData, begindatum: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Tot en met</label>
              <input
                type="date"
                value={formData.einddatum}
                min={formData.begindatum}
                onChange={(e) => setFormData({ ...formData, einddatum: e.target.value })}
                className="input"
                required
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600">Aantal dagen: <strong>{days}</strong></p>
            {formData.type === 'vakantie' && (
              <p className="text-sm text-gray-600">Resterend saldo na goedkeuring: <strong>{balance - days}</strong></p>
            )}
          </div>

          {exceedsBalance && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Je hebt niet genoeg vakantiedagen. Je saldo is {balance} dagen.
              </p>
            </div>
          )}

          <div>
            <label className="label">Opmerking (optioneel)</label>
            <textarea
              value={formData.opmerking}
              onChange={(e) => setFormData({ ...formData, opmerking: e.target.value })}
              className="input"
              rows="2"
              placeholder="Reden voor verlof..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn btn-secondary">
              Annuleren
            </button>
            <button 
              type="submit" 
              disabled={submitting || exceedsBalance || days < 1} 
              className="flex-1 btn btn-primary"
            >
              {submitting ? <div className="spinner" /> : 'Aanvragen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Vakantie;