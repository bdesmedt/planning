import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate, formatDateTime } from '../utils/dates';
import { Palmtree, CheckCircle, XCircle, Clock, Calendar } from 'lucide-react';

const LEAVE_TYPES = {
  vakantie: { label: 'Vakantie', color: 'bg-green-100 text-green-800' },
  zorgverlof: { label: 'Zorgverlof', color: 'bg-blue-100 text-blue-800' },
  bijzonder_verlof: { label: 'Bijzonder verlof', color: 'bg-purple-100 text-purple-800' },
  onbetaald_verlof: { label: 'Onbetaald verlof', color: 'bg-gray-100 text-gray-800' },
  ziekte: { label: 'Ziekte', color: 'bg-red-100 text-red-800' }
};

function VakantieBeheer() {
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('in_behandeling');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [processingId, setProcessingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);

  useEffect(() => {
    loadData();
  }, [filterStatus, filterEmployee]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterEmployee) params.medewerker_id = filterEmployee;

      const [requestsRes, employeesRes] = await Promise.all([
        api.get('/leave-requests', { params }),
        api.get('/employees')
      ]);
      setRequests(requestsRes.data);
      setEmployees(employeesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await api.post(`/leave-requests/${id}/process`, { status: 'goedgekeurd' });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij goedkeuren');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    setProcessingId(id);
    try {
      await api.post(`/leave-requests/${id}/process`, { 
        status: 'afgewezen',
        opmerking: rejectReason 
      });
      setShowRejectModal(null);
      setRejectReason('');
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij afwijzen');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verlofbeheer</h1>
        <p className="text-gray-600">Beheer verlofaanvragen van medewerkers</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          className={`card cursor-pointer transition-colors ${filterStatus === 'in_behandeling' ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => setFilterStatus('in_behandeling')}
        >
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-500">In behandeling</p>
              <p className="text-2xl font-bold text-yellow-600">
                {requests.filter(r => r.status === 'in_behandeling').length}
              </p>
            </div>
          </div>
        </div>
        <div 
          className={`card cursor-pointer transition-colors ${filterStatus === 'goedgekeurd' ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => setFilterStatus('goedgekeurd')}
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Goedgekeurd</p>
              <p className="text-2xl font-bold text-green-600">
                {requests.filter(r => r.status === 'goedgekeurd').length}
              </p>
            </div>
          </div>
        </div>
        <div 
          className={`card cursor-pointer transition-colors ${filterStatus === 'afgewezen' ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => setFilterStatus('afgewezen')}
        >
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <p className="text-sm text-gray-500">Afgewezen</p>
              <p className="text-2xl font-bold text-red-600">
                {requests.filter(r => r.status === 'afgewezen').length}
              </p>
            </div>
          </div>
        </div>
        <div 
          className={`card cursor-pointer transition-colors ${filterStatus === '' ? 'ring-2 ring-primary-500' : ''}`}
          onClick={() => setFilterStatus('')}
        >
          <div className="flex items-center gap-3">
            <Palmtree className="w-8 h-8 text-primary-500" />
            <div>
              <p className="text-sm text-gray-500">Totaal</p>
              <p className="text-2xl font-bold text-primary-600">{requests.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
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
            <option value="in_behandeling">In behandeling</option>
            <option value="goedgekeurd">Goedgekeurd</option>
            <option value="afgewezen">Afgewezen</option>
          </select>
        </div>
      </div>

      {/* Requests list */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((request) => {
              const typeConfig = LEAVE_TYPES[request.type];
              const isPending = request.status === 'in_behandeling';

              return (
                <div 
                  key={request.id}
                  className={`border rounded-lg p-4 ${isPending ? 'border-yellow-200 bg-yellow-50/50' : ''}`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-900">{request.medewerker_naam}</span>
                        <span className={`badge ${typeConfig?.color || 'bg-gray-100'}`}>
                          {typeConfig?.label || request.type}
                        </span>
                        {request.status === 'in_behandeling' && (
                          <span className="badge badge-yellow">Wacht op beoordeling</span>
                        )}
                        {request.status === 'goedgekeurd' && (
                          <span className="badge badge-green">Goedgekeurd</span>
                        )}
                        {request.status === 'afgewezen' && (
                          <span className="badge badge-red">Afgewezen</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {formatDate(request.begindatum, 'd MMMM yyyy')}
                          {request.begindatum !== request.einddatum && (
                            <> - {formatDate(request.einddatum, 'd MMMM yyyy')}</>
                          )}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="font-medium">{request.aantal_dagen} dag(en)</span>
                      </div>
                      
                      {request.opmerking && (
                        <p className="text-sm text-gray-600 mt-2 italic">
                          "{request.opmerking}"
                        </p>
                      )}
                      
                      {request.beoordeling_opmerking && (
                        <p className="text-sm text-gray-500 mt-2">
                          <strong>Reactie:</strong> {request.beoordeling_opmerking}
                        </p>
                      )}
                      
                      <p className="text-xs text-gray-400 mt-2">
                        Aangevraagd op {formatDateTime(request.created_at)}
                      </p>
                    </div>

                    {isPending && (
                      <div className="flex gap-2 lg:flex-col">
                        <button
                          onClick={() => handleApprove(request.id)}
                          disabled={processingId === request.id}
                          className="btn btn-success btn-sm flex items-center gap-1"
                        >
                          {processingId === request.id ? (
                            <div className="spinner" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Goedkeuren
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setShowRejectModal(request.id)}
                          disabled={processingId === request.id}
                          className="btn btn-danger btn-sm flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Afwijzen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Palmtree className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Geen verlofaanvragen gevonden</p>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowRejectModal(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Aanvraag afwijzen</h3>
            <p className="text-gray-600 mb-4">
              Weet je zeker dat je deze aanvraag wilt afwijzen? De medewerker ontvangt een notificatie.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reden voor afwijzing (optioneel)"
              className="input mb-4"
              rows="3"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowRejectModal(null); setRejectReason(''); }}
                className="flex-1 btn btn-secondary"
              >
                Annuleren
              </button>
              <button 
                onClick={() => handleReject(showRejectModal)}
                disabled={processingId === showRejectModal}
                className="flex-1 btn btn-danger"
              >
                {processingId === showRejectModal ? <div className="spinner" /> : 'Afwijzen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VakantieBeheer;