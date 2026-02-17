import { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/dates';
import { Users, Plus, Edit2, Trash2, Mail, Phone, Building, X, Search } from 'lucide-react';

function Medewerkers() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data) => {
    try {
      if (editingEmployee) {
        await api.put(`/employees/${editingEmployee.id}`, data);
      } else {
        await api.post('/employees', data);
      }
      setShowModal(false);
      setEditingEmployee(null);
      loadEmployees();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij opslaan');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Weet je zeker dat je deze medewerker wilt verwijderen?')) return;
    try {
      await api.delete(`/employees/${id}`);
      loadEmployees();
    } catch (error) {
      alert(error.response?.data?.error || 'Fout bij verwijderen');
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.naam.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.afdeling?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Medewerkers</h1>
          <p className="text-gray-600">{employees.length} medewerkers</p>
        </div>
        <button 
          onClick={() => { setEditingEmployee(null); setShowModal(true); }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Medewerker toevoegen
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Zoek op naam, email of afdeling..."
          className="input pl-10"
        />
      </div>

      {/* Employee list */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredEmployees.map((employee) => (
          <div key={employee.id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-semibold text-primary-700">
                    {employee.naam.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{employee.naam}</h3>
                  <span className={`badge ${employee.rol === 'manager' ? 'badge-blue' : 'badge-gray'}`}>
                    {employee.rol === 'manager' ? 'Manager' : 'Medewerker'}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => { setEditingEmployee(employee); setShowModal(true); }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Edit2 className="w-4 h-4 text-gray-500" />
                </button>
                <button
                  onClick={() => handleDelete(employee.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-4 h-4" />
                <span className="truncate">{employee.email}</span>
              </div>
              {employee.telefoon && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4" />
                  <span>{employee.telefoon}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-600">
                <Building className="w-4 h-4" />
                <span>{employee.afdeling || 'Geen afdeling'}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">Contract uren</p>
                <p className="font-semibold">{employee.contract_uren || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Vakantiesaldo</p>
                <p className="font-semibold text-green-600">{employee.vakantiesaldo || 0}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEmployees.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>{searchTerm ? 'Geen medewerkers gevonden' : 'Nog geen medewerkers'}</p>
        </div>
      )}

      {/* Employee modal */}
      {showModal && (
        <EmployeeModal
          employee={editingEmployee}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingEmployee(null); }}
        />
      )}
    </div>
  );
}

function EmployeeModal({ employee, onSave, onClose }) {
  const [formData, setFormData] = useState({
    naam: employee?.naam || '',
    email: employee?.email || '',
    telefoon: employee?.telefoon || '',
    afdeling: employee?.afdeling || '',
    rol: employee?.rol || 'medewerker',
    contract_uren: employee?.contract_uren || 0,
    vakantiesaldo: employee?.vakantiesaldo || 25,
    uurloon: employee?.uurloon || 0
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
            {employee ? 'Medewerker bewerken' : 'Nieuwe medewerker'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Naam</label>
            <input
              type="text"
              value={formData.naam}
              onChange={(e) => setFormData({ ...formData, naam: e.target.value })}
              className="input"
              required
            />
          </div>

          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              required
              disabled={!!employee}
            />
          </div>

          <div>
            <label className="label">Telefoon</label>
            <input
              type="tel"
              value={formData.telefoon}
              onChange={(e) => setFormData({ ...formData, telefoon: e.target.value })}
              className="input"
              placeholder="06-12345678"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Afdeling</label>
              <select
                value={formData.afdeling}
                onChange={(e) => setFormData({ ...formData, afdeling: e.target.value })}
                className="input"
              >
                <option value="">Selecteer</option>
                <option value="Kassa">Kassa</option>
                <option value="Magazijn">Magazijn</option>
                <option value="Vakkenvullen">Vakkenvullen</option>
                <option value="Klantenservice">Klantenservice</option>
                <option value="Verkoop">Verkoop</option>
              </select>
            </div>
            <div>
              <label className="label">Rol</label>
              <select
                value={formData.rol}
                onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                className="input"
              >
                <option value="medewerker">Medewerker</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Contract uren</label>
              <input
                type="number"
                value={formData.contract_uren}
                onChange={(e) => setFormData({ ...formData, contract_uren: parseInt(e.target.value) })}
                className="input"
                min="0"
                max="40"
              />
            </div>
            <div>
              <label className="label">Vakantiedagen</label>
              <input
                type="number"
                value={formData.vakantiesaldo}
                onChange={(e) => setFormData({ ...formData, vakantiesaldo: parseInt(e.target.value) })}
                className="input"
                min="0"
              />
            </div>
            <div>
              <label className="label">Uurloon (€)</label>
              <input
                type="number"
                value={formData.uurloon}
                onChange={(e) => setFormData({ ...formData, uurloon: parseFloat(e.target.value) })}
                className="input"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 btn btn-secondary">
              Annuleren
            </button>
            <button type="submit" disabled={saving} className="flex-1 btn btn-primary">
              {saving ? <div className="spinner" /> : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Medewerkers;