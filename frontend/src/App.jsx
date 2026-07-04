import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import ProfilePage from './pages/ProfilePage';
import AttendancePage from './pages/AttendancePage';
import LeavesPage from './pages/LeavesPage';
import PayrollPage from './pages/PayrollPage';

// Simple Route Guard for Admin role
const AdminRoute = ({ children }) => {
  const { role } = useAuthContext();
  if (role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />

          {/* Protected Dashboard Shell */}
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route 
              path="employees" 
              element={
                <AdminRoute>
                  <EmployeesPage />
                </AdminRoute>
              } 
            />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="leaves" element={<LeavesPage />} />
            <Route path="payroll" element={<PayrollPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
