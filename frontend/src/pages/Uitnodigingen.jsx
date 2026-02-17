import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Uitnodigingen() {
  const { user } = useAuth();
  const [uitnodigingen, setUitnodigingen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', naam: '', afdeling: '' });
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchUitnodigingen();
  }, []);

  const fetchUitnodigingen = async () => {
    try {
      const res = await api.get('/api/invitations');
      setUitnodigingen(res.data);
    } catch (err) {
      setError('Kon uitnodigingen niet laden');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      await api.post('/api/invitations', formData);
      setFormData({ email: '', naam: '', afdeling: '' });
      setShowForm(false);
      fetchUitnodigingen();
    } catch (err) {
      setError(err.response?.data?.error || 'Kon uitnodiging niet aanmaken');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async (token) => {
    const link = `${window.location.origin}/registreer/${token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(token);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteUitnodiging = async (id) => {
    if (!confirm('Weet je zeker dat je deze uitnodiging wilt verwijderen?')) return;
    try {
      await api.delete(`/api/invitations/${id}`);
      fetchUitnodigingen();
    } catch (err) {
      setError('Kon uitnodiging niet verwijderen');
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Je hebt geen toegang tot deze pagina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Uitnodigingen</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Nieuwe Uitnodiging
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Nieuwe medewerker uitnodigen</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Naam *</label>
              <input
                type="text"
                required
                value={formData.naam}
                onChange={(e) => setFormData({...formData, naam: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
                placeholder="Volledige naam"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
                placeholder="email@voorbeeld.nl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Afdeling *</label>
              <select
                required
                value={formData.afdeling}
                onChange={(e) => setFormData({...formData, afdeling: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Selecteer afdeling</option>
                <option value="Kassa">Kassa</option>
                <option value="Magazijn">Magazijn</option>
                <option value="Vers">Vers</option>
                <option value="Vulploeg">Vulploeg</option>
                <option value="Management">Management</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={generating}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {generating ? 'Bezig...' : 'Uitnodiging Aanmaken'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Annuleren
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Laden...</p>
      ) : uitnodigingen.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md text-center">
          <p className="text-gray-500">Nog geen uitnodigingen verstuurd.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Naam</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">E-mail</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Afdeling</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {uitnodigingen.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{u.naam}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.email}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{u.afdeling}</td>
                  <td className="px-4 py-3">
                    {u.used ? (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Geregistreerd</span>
                    ) : new Date(u.expires_at) < new Date() ? (
                      <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">Verlopen</span>
                    ) : (
                      <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Wachtend</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!u.used && new Date(u.expires_at) >= new Date() && (
                      <button
                        onClick={() => copyLink(u.token)}
                        className="text-blue-600 hover:text-blue-800 text-sm mr-3"
                      >
                        {copiedId === u.token ? '✓ Gekopieerd!' : 'Kopieer Link'}
                      </button>
                    )}
                    <button
                      onClick={() => deleteUitnodiging(u.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
        <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">Hoe werkt het?</h3>
        <ol className="list-decimal list-inside text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>Maak een uitnodiging aan met naam, email en afdeling</li>
          <li>Kopieer de uitnodigingslink</li>
          <li>Stuur de link naar de medewerker (via WhatsApp, email, etc.)</li>
          <li>De medewerker klikt op de link en kiest een wachtwoord</li>
          <li>Klaar! De medewerker kan nu inloggen</li>
        </ol>
      </div>
    </div>
  );
}