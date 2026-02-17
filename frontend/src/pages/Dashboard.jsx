import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDate, formatTime, toISODateString, addDays } from '../utils/dates';
import { 
  Calendar, Clock, Palmtree, Users, AlertCircle, ChevronRight,
  TrendingUp, CheckCircle, XCircle
} from 'lucide-react';

function Dashboard() {
  const { user, isManager } = useAuth();
  const [stats, setStats] = useState(null);
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = toISODateString(new Date());
      const nextWeek = toISODateString(addDays(new Date(), 7));

      const responses = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/shifts', { params: { startDatum: today, eindDatum: nextWeek } }),
        isManager ? api.get('/leave-requests', { params: { status: 'in_behandeling' } }) : Promise.resolve({ data: [] })
      ]);

      setStats(responses[0].data);
      setUpcomingShifts(responses[1].data.slice(0, 5));
      setPendingRequests(responses[2].data.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welkom terug, {user?.naam?.split(' ')[0]}!
        </h1>
        <p className="text-gray-600">
          {formatDate(new Date(), 'EEEE d MMMM yyyy')}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Diensten deze week</p>
              <p className="text-xl font-bold text-gray-900">{stats?.shiftsThisWeek || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Uren deze maand</p>
              <p className="text-xl font-bold text-gray-900">{stats?.hoursThisMonth?.toFixed(1) || 0}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Palmtree className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vakantiedagen</p>
              <p className="text-xl font-bold text-gray-900">{user?.vakantiesaldo || 0}</p>
            </div>
          </div>
        </div>

        {isManager && (
          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Medewerkers</p>
                <p className="text-xl font-bold text-gray-900">{stats?.totalEmployees || 0}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Upcoming shifts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Komende diensten</h2>
            <Link to="/rooster" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
              Bekijk alles <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {upcomingShifts.length > 0 ? (
            <div className="space-y-3">
              {upcomingShifts.map((shift) => (
                <div key={shift.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center min-w-[50px]">
                    <p className="text-xs text-gray-500 uppercase">
                      {formatDate(shift.datum, 'EEE')}
                    </p>
                    <p className="text-lg font-bold text-gray-900">
                      {formatDate(shift.datum, 'd')}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {formatTime(shift.starttijd)} - {formatTime(shift.eindtijd)}
                    </p>
                    <p className="text-sm text-gray-500">{shift.afdeling}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p>Geen komende diensten</p>
            </div>
          )}
        </div>

        {/* Manager: Pending requests */}
        {isManager && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Te beoordelen</h2>
              <Link to="/vakantie/beheer" className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
                Bekijk alles <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {pendingRequests.length > 0 ? (
              <div className="space-y-3">
                {pendingRequests.map((request) => (
                  <div key={request.id} className="flex items-center gap-4 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{request.medewerker_naam}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(request.begindatum, 'd MMM')} - {formatDate(request.einddatum, 'd MMM')}
                      </p>
                    </div>
                    <span className="badge badge-yellow">Wachtend</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>Alles is beoordeeld!</p>
              </div>
            )}
          </div>
        )}

        {/* Employee: Vacation balance */}
        {!isManager && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Snelle acties</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/vakantie" className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition-colors">
                <Palmtree className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-green-700">Verlof aanvragen</p>
              </Link>
              <Link to="/uren" className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition-colors">
                <Clock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium text-blue-700">Inklokken</p>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;