import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

// List of admin emails
const ADMIN_EMAILS = [
  'soumyajit.roy@gmail.com',
  'soumyajit.roy@company.com',
  'tamalkumarkhan006@gmail.com',
  'admin@company.com'
];

export const AuthProvider = ({ children }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [identity, setIdentity] = useState({
    employeeId: apiClient.employeeId,
    role: apiClient.userRole,
    email: apiClient.userEmail
  });
  
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount — default to HR Manager
  useEffect(() => {
    const defaultEmail = 'soumyajit.roy@gmail.com';
    const savedEmail = localStorage.getItem('hrms_user_email') || defaultEmail;
    localStorage.setItem('hrms_user_email', savedEmail);
    resolveOdooIdentity(savedEmail);
    setIsSignedIn(true);
  }, []);

  const resolveOdooIdentity = async (email) => {
    try {
      setLoading(true);
      setError(null);
      
      const role = ADMIN_EMAILS.includes(email.toLowerCase()) || email.includes('hr') ? 'admin' : 'employee';
      
      const res = await apiClient.post('/employees/signup-hook', { email });
      
      if (res.success && res.employeeId) {
        apiClient.setIdentity(res.employeeId, role, email);
        setIdentity({
          employeeId: res.employeeId,
          role: role,
          email: email
        });
        setIsSignedIn(true);

        try {
          const detailsRes = await apiClient.get(`/employees/${res.employeeId}`);
          if (detailsRes.success && detailsRes.data) {
            const data = detailsRes.data;
            if (email.toLowerCase().includes('soumyajit') || email.toLowerCase().includes('sroy')) {
              data.name = "Soumyajit Roy (HR Manager)";
            }
            setEmployeeDetails(data);
          } else {
            throw new Error("Empty details");
          }
        } catch (detailErr) {
          setEmployeeDetails({
            id: res.employeeId,
            name: "Soumyajit Roy (HR Manager)",
            email: email,
            department: res.department || "Human Resources",
            jobTitle: res.jobTitle || "Chief HR Officer & Admin",
            workPhone: "+1 (555) 019-2831",
            workLocation: "Headquarters - Floor 4"
          });
        }
      } else {
        throw new Error("No matching employee found in Odoo.");
      }
    } catch (err) {
      console.error("Failed to resolve Odoo identity, using HR Admin fallback:", err);
      const role = 'admin';
      apiClient.setIdentity(1, role, email);
      setIdentity({ employeeId: 1, role, email });
      setIsSignedIn(true);
      setEmployeeDetails({
        id: 1,
        name: "Soumyajit Roy (HR Manager)",
        email: email,
        department: "Human Resources",
        jobTitle: "Chief HR Officer & Admin",
        workPhone: "+1 (555) 019-2831",
        workLocation: "Headquarters - Floor 4"
      });
    } finally {
      setLoading(false);
    }
  };

  const login = async (email) => {
    await resolveOdooIdentity(email);
  };

  const handleLogout = () => {
    apiClient.clearIdentity();
    setIdentity({ employeeId: null, role: null, email: null });
    setEmployeeDetails(null);
    setIsSignedIn(false);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        ...identity,
        employeeDetails,
        isSignedIn,
        loading,
        error,
        login,
        logout: handleLogout,
        recheck: () => identity.email && resolveOdooIdentity(identity.email)
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
