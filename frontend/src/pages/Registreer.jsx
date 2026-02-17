import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { UserPlus, Lock, Eye, EyeOff, Check, X } from 'lucide-react';

function Registreer() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkInvitation();
  }, [token]);

  const checkInvitation = async () => {
    try {
      const response = await api.get(`/invitations/${token}`);
      setInvitation(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Ongeldige of verlopen uitnodiging');
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { label: 'Minimaal 8 tekens', met: password.length >= 8 },
    { label: 'Minimaal 1 hoofdletter', met: /[A-Z]/.test(password) },
    { label: 'Minimaal 1 cijfer', met: /[0-9]/.test(password) },
  ];

  const allRequirementsMet = passwordRequirements.every(r => r.met);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allRequirementsMet || !passwordsMatch) return;

    setSubmitting(true);
    setError('');

    try {
      await api.post(`/auth/register/${token}`, { wachtwoord: password });
      navigate('/login', { state: { message: 'Account aangemaakt! Je kunt nu inloggen.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Registratie mislukt');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="spinner" />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Uitnodiging ongeldig</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => navigate('/login')} className="btn btn-primary">
            Naar inloggen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl mb-2">📅</h1>
          <h2 className="text-2xl font-bold text-gray-900">Welkom!</h2>
          <p className="text-gray-600">Maak je account aan</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="mb-6 p-4 bg-primary-50 rounded-lg">
            <p className="text-sm text-gray-600">Uitgenodigd als:</p>
            <p className="font-semibold text-gray-900">{invitation?.naam}</p>
            <p className="text-sm text-gray-500">{invitation?.email}</p>
            <p className="text-xs text-primary-600 mt-1">Afdeling: {invitation?.afdeling}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Kies een wachtwoord</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req, i) => (
                  <div key={i} className={`flex items-center gap-2 text-sm ${req.met ? 'text-green-600' : 'text-gray-400'}`}>
                    {req.met ? <Check className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border" />}
                    {req.label}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Bevestig wachtwoord</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`input pl-10 ${confirmPassword && !passwordsMatch ? 'border-red-300' : ''}`}
                  required
                />
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-sm text-red-600 mt-1">Wachtwoorden komen niet overeen</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting || !allRequirementsMet || !passwordsMatch}
              className="w-full btn btn-primary btn-lg"
            >
              {submitting ? (
                <div className="spinner" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Account aanmaken
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Registreer;