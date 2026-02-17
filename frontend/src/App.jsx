import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Registreer from './pages/Registreer';
import Dashboard from './pages/Dashboard';
import Rooster from './pages/Rooster';
import RoosterMaand from './pages/RoosterMaand';
import Uren from './pages/Uren';
import UrenOverzicht from './pages/UrenOverzicht';
import Vakantie from './pages/Vakantie';
import VakantieBeheer from './pages/VakantieBeheer';
import Beschikbaarheid from './pages/Beschikbaarheid';
import Dienstruil from './pages/Dienstruil';
import Medewerkers from './pages/Medewerkers';
import Uitnodigingen from './pages/Uitnodigingen';
import Profiel from './pages/Profiel';
import Rapportages from './pages/Rapportages';

function ProtectedRoute({ children, managerOnly = false }) {
  const { user, loading, isManager } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (managerOnly && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/registreer/:token" element={<Registreer />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="rooster" element={<Rooster />} />
            <Route path="rooster/maand" element={<RoosterMaand />} />
            <Route path="uren" element={<Uren />} />
            <Route path="uren/overzicht" element={
              <ProtectedRoute managerOnly>
                <UrenOverzicht />
              </ProtectedRoute>
            } />
            <Route path="vakantie" element={<Vakantie />} />
            <Route path="vakantie/beheer" element={
              <ProtectedRoute managerOnly>
                <VakantieBeheer />
              </ProtectedRoute>
            } />
            <Route path="beschikbaarheid" element={<Beschikbaarheid />} />
            <Route path="dienstruil" element={<Dienstruil />} />
            <Route path="medewerkers" element={
              <ProtectedRoute managerOnly>
                <Medewerkers />
              </ProtectedRoute>
            } />
            <Route path="uitnodigingen" element={
              <ProtectedRoute managerOnly>
                <Uitnodigingen />
              </ProtectedRoute>
            } />
            <Route path="rapportages" element={
              <ProtectedRoute managerOnly>
                <Rapportages />
              </ProtectedRoute>
            } />
            <Route path="profiel" element={<Profiel />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;