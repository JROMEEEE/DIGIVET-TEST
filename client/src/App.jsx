import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import StatusCheck from './pages/StatusCheck';
import Login from './pages/Login';
import Register from './pages/Register';
import PetOwnerDashboard from './pages/PetOwnerDashboard';
import VetDashboard from './pages/VetDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/status" element={<StatusCheck />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRole="pet_owner">
            <PetOwnerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vet"
        element={
          <ProtectedRoute requiredRole="veterinarian">
            <VetDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;