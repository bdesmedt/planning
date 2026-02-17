import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDate, formatTime, toISODateString, addDays } from '../utils/dates';
import { RefreshCw, Plus, CheckCircle, XCircle, Clock, ArrowRight, X } from 'lucide-react';

const STATUS_CONFIG = {
  verzonden: { label: 'Verzonden', color: 'badge-blue', desc: 'Wacht op reactie collega' },
  geaccepteerd: { label: 'Geaccepteerd', color: 'badge-yellow', desc: 'Wacht op goedkeuring manager' },
  geweigerd: { label: 'Geweigerd', color: 'badge-red', desc: 'Door collega geweigerd' },
  goedgekeurd: { label: 'Goedgekeurd', color: 'badge-green', desc: 'Diensten zijn geruild' },
  afgekeurd: { label: 'Afgekeurd', color: 'badge-red', desc: 'Door manager afgekeurd' }
};

function Dienstruil() {
  const { user, isManager } = useAuth();
  const [swaps, setSwaps] = useState([]);
  const [myShifts, setMyShifts] = useState([]);
  const [colleagues, setColleagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const today = toISODateString(new Date());
      const future = toISODateString(addDays(new Date(), 30));

      const [swapsRes, shiftsRes, colleaguesRes] = await Promise.all([
        api.get('/shift-swaps'),
        api.get('/shifts', { params: { startDatum: today, eindDatum: future } }),
        api.get('/employees')
      ]);

      setSwaps(swapsRes.data);
      setMyShifts(shiftsRes.data.filter(s => s.medewerker_id === user.id));
      setColleagues(colleaguesRes.data.filter(c => c.id !== user.id));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (swapId, action) => {
    try {
      await api.post(`/shift-swaps/${swapId}/respond`, { actie: action });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij verwerken');
    }
  };

  const handleApprove = async (swapId, action) => {
    try {
      await api.post(`/shift-swaps/${swapId}/approve`, { actie: action });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij verwerken');
    }
  };

  const handleCreate = async (data) => {
    try {
      await api.post('/shift-swaps', data);
      setShowModal(false);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij aanmaken');
    }
  };

  const incomingRequests = swaps.filter(s => s.ontvanger_id === user.id && s.status === 'verzonden');
  const pendingApprovals = swaps.filter(s => s.status === 'geaccepteerd');

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
          <h1 className="text-2xl font-bold text-gray-900">Diensten Ruilen</h1>
          <p className="text-gray-600">Vraag een collega om van dienst te ruilen</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          disabled={myShifts.length === 0}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nieuw ruilverzoek
        </button>
      </div>

      {/* Alerts for pending actions */}
      {incomingRequests.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {incomingRequests.length} ruilverzoek(en) wacht(en) op je reactie
          </h3>
        </div>
      )}

      {isManager && pendingApprovals.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-800 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {pendingApprovals.length} ruilverzoek(en) wacht(en) op je goedkeuring
          </h3>
        </div>
      )}

      {/* Swap requests */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Ruilverzoeken</h2>
        
        {swaps.length > 0 ? (
          <div className="space-y-4">
            {swaps.map((swap) => {
              const statusConfig = STATUS_CONFIG[swap.status];
              const isRequester = swap.aanvrager_id === user.id;
              const isRecipient = swap.ontvanger_id === user.id;
              const canRespond = isRecipient && swap.status === 'verzonden';
              const canApprove = isManager && swap.status === 'geaccepteerd';

              return (
                <div 
                  key={swap.id}
                  className={`border rounded-lg p-4 ${
                    canRespond || canApprove ? 'border-yellow-200 bg-yellow-50/50' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`badge ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>
                    <span className="text-sm text-gray-500">{statusConfig.desc}</span>
                  </div>

                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Requester's shift */}
                    <div className="flex-1 bg-white rounded-lg p-3 border">
                      <p className="text-sm text-gray-500 mb-1">
                        {isRequester ? 'Jouw dienst' : swap.aanvrager_naam}
                      </p>
                      <p className="font-medium">{formatDate(swap.shift_aanvrager_datum, 'EEE d MMM')}</p>
                      <p className="text-sm text-gray-600">
                        {formatTime(swap.shift_aanvrager_start)} - {formatTime(swap.shift_aanvrager_eind)}
                      </p>
                    </div>

                    <ArrowRight className="w-6 h-6 text-gray-400 rotate-90 lg:rotate-0 mx-auto lg:mx-0" />

                    {/* Recipient */}
                    <div className="flex-1 bg-white rounded-lg p-3 border">
                      <p className="text-sm text-gray-500 mb-1">
                        {isRecipient ? 'Jouw dienst' : swap.ontvanger_naam}
                      </p>
                      {swap.shift_ontvanger_datum ? (
                        <>
                          <p className="font-medium">{formatDate(swap.shift_ontvanger_datum, 'EEE d MMM')}</p>
                          <p className="text-sm text-gray-600">
                            {formatTime(swap.shift_ontvanger_start)} - {formatTime(swap.shift_ontvanger_eind)}
                          </p>
                        </>
                      ) : (
                        <p className="text-gray-400 italic">Geen dienst geselecteerd</p>
                      )}
                    </div>
                  </div>

                  {swap.opmerking && (
                    <p className="text-sm text-gray-600 mt-3 italic">"{swap.opmerking}"</p>
                  )}

                  {/* Actions */}
                  {canRespond && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <button
                        onClick={() => handleRespond(swap.id, 'accepteer')}
                        className="btn btn-success btn-sm flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Accepteren
                      </button>
                      <button
                        onClick={() => handleRespond(swap.id, 'weiger')}
                        className="btn btn-danger btn-sm flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        Weigeren
                      </button>
                    </div>
                  )}

                  {canApprove && (
                    <div className="flex gap-2 mt-4 pt-4 border-t">
                      <button
                        onClick={() => handleApprove(swap.id, 'goedkeur')}
                        className="btn btn-success btn-sm flex items-center gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Goedkeuren
                      </button>
                      <button
                        onClick={() => handleApprove(swap.id, 'afkeur')}
                        className="btn btn-danger btn-sm flex items-center gap-1"
                      >
                        <XCircle className="w-4 h-4" />
                        Afkeuren
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Geen ruilverzoeken</p>
            {myShifts.length > 0 && (
              <button 
                onClick={() => setShowModal(true)}
                className="btn btn-primary mt-4"
              >
                Eerste ruilverzoek maken
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create swap modal */}
      {showModal && (
        <SwapRequestModal
          shifts={myShifts}
          colleagues={colleagues}
          onCreate={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function SwapRequestModal({ shifts, colleagues, onCreate, onClose }) {
  const [formData, setFormData] = useState({
    shift_aanvrager_id: '',
    ontvanger_id: '',
    opmerking: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onCreate(formData);
    setSubmitting(false);
  };

  const selectedShift = shifts.find(s => s.id === parseInt(formData.shift_aanvrager_id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Nieuw ruilverzoek</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Welke dienst wil je ruilen?</label>
            <select
              value={formData.shift_aanvrager_id}
              onChange={(e) => setFormData({ ...formData, shift_aanvrager_id: e.target.value })}
              className="input"
              required
            >
              <option value="">Selecteer een dienst</option>
              {shifts.map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {formatDate(shift.datum, 'EEE d MMM')} • {formatTime(shift.starttijd)} - {formatTime(shift.eindtijd)}
                </option>
              ))}
            </select>
          </div>

          {selectedShift && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">Geselecteerde dienst:</p>
              <p className="font-medium">{formatDate(selectedShift.datum, 'EEEE d MMMM')}</p>
              <p className="text-sm">{formatTime(selectedShift.starttijd)} - {formatTime(selectedShift.eindtijd)}</p>
              <p className="text-sm text-gray-500">{selectedShift.afdeling}</p>
            </div>
          )}

          <div>
            <label className="label">Met welke collega wil je ruilen?</label>
            <select
              value={formData.ontvanger_id}
              onChange={(e) => setFormData({ ...formData, ontvanger_id: e.target.value })}
              className="input"
              required
            >
              <option value="">Selecteer een collega</option>
              {colleagues.map((colleague) => (
                <option key={colleague.id} value={colleague.id}>
                  {colleague.naam}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Bericht (optioneel)</label>
            <textarea
              value={formData.opmerking}
              onChange={(e) => setFormData({ ...formData, opmerking: e.target.value })}
              className="input"
              rows="2"
              placeholder="Bijv. Zou je mijn zaterdagdienst willen overnemen?"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn btn-secondary">
              Annuleren
            </button>
            <button type="submit" disabled={submitting} className="flex-1 btn btn-primary">
              {submitting ? <div className="spinner" /> : 'Versturen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Dienstruil;