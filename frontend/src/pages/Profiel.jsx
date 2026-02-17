import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function Profiel() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    naam: user?.naam || '',
    email: user?.email || '',
    telefoon: user?.telefoon || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const res = await api.put('/api/users/profile', formData);
      setUser({ ...user, ...formData });
      setMessage('Profiel bijgewerkt!');
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Kon profiel niet bijwerken');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Wachtwoorden komen niet overeen');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens zijn');
      return;
    }
    
    try {
      await api.put('/api/users/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      setMessage('Wachtwoord gewijzigd!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setChangingPassword(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Kon wachtwoord niet wijzigen');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mijn Profiel</h1>

      {message && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg">{message}</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">{error}</div>
      )}

      {/* Profile Info Card */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Persoonlijke Gegevens</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Bewerken
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Naam</label>
              <input
                type="text"
                value={formData.naam}
                onChange={(e) => setFormData({...formData, naam: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail</label>
              <input
                type="email"
                value={formData.email}
                disabled
                className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-100 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">E-mail kan niet gewijzigd worden</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefoon</label>
              <input
                type="tel"
                value={formData.telefoon}
                onChange={(e) => setFormData({...formData, telefoon: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
                placeholder="06-12345678"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Opslaan
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setFormData({ naam: user?.naam || '', email: user?.email || '', telefoon: user?.telefoon || '' });
                }}
                className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Annuleren
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
                {user?.naam?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{user?.naam}</p>
                <p className="text-gray-500">{user?.role === 'admin' ? 'Beheerder' : 'Medewerker'}</p>
              </div>
            </div>
            <div className="border-t dark:border-gray-700 pt-3 mt-3">
              <p className="text-sm text-gray-500">E-mail</p>
              <p className="text-gray-900 dark:text-white">{user?.email}</p>
            </div>
            {user?.afdeling && (
              <div>
                <p className="text-sm text-gray-500">Afdeling</p>
                <p className="text-gray-900 dark:text-white">{user?.afdeling}</p>
              </div>
            )}
            {user?.contract_uren && (
              <div>
                <p className="text-sm text-gray-500">Contracturen</p>
                <p className="text-gray-900 dark:text-white">{user?.contract_uren} uur/week</p>
              </div>
            )}
            {user?.telefoon && (
              <div>
                <p className="text-sm text-gray-500">Telefoon</p>
                <p className="text-gray-900 dark:text-white">{user?.telefoon}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change Password Card */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Wachtwoord Wijzigen</h2>
          {!changingPassword && (
            <button
              onClick={() => setChangingPassword(true)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Wijzigen
            </button>
          )}
        </div>

        {changingPassword ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Huidig Wachtwoord</label>
              <input
                type="password"
                required
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nieuw Wachtwoord</label>
              <input
                type="password"
                required
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bevestig Nieuw Wachtwoord</label>
              <input
                type="password"
                required
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Wachtwoord Wijzigen
              </button>
              <button
                type="button"
                onClick={() => {
                  setChangingPassword(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                className="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-lg hover:bg-gray-300"
              >
                Annuleren
              </button>
            </div>
          </form>
        ) : (
          <p className="text-gray-500">••••••••</p>
        )}
      </div>

      {/* Account Info */}
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Account aangemaakt: {user?.created_at ? new Date(user.created_at).toLocaleDateString('nl-NL') : 'Onbekend'}
        </p>
      </div>
    </div>
  );
}