import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { apiClient } from '../api/client';

const AuthContext = createContext(null);

// List of admin emails
const ADMIN_EMAILS = [
  'tamalkumarkhan006@gmail.com',
  'admin@company.com'
];

export const AuthProvider = ({ children }) => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useAuth();
  
  const [identity, setIdentity] = useState({
    employeeId: apiClient.employeeId,
    role: apiClient.userRole,
    email: apiClient.userEmail
  });
  
  const [employeeDetails, setEmployeeDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const resolveOdooIdentity = async (email) => {
    try {
      setLoading(true);
      setError(null);
      
      // Determine role based on email list
      const role = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'admin' : 'employee';
      
      // Call signup hook to match email to Odoo hr.employee record
      const res = await apiClient.post('/employees/signup-hook', { email });
      
      if (res.success && res.employeeId) {
        apiClient.setIdentity(res.employeeId, role, email);
        setIdentity({
          employeeId: res.employeeId,
          role: role,
          email: email
        });

        // Load complete employee details
        const detailsRes = await apiClient.get(`/employees/${res.employeeId}`);
        if (detailsRes.success) {
          setEmployeeDetails(detailsRes.data);
        }
      } else {
        throw new Error("No matching employee found in Odoo.");
      }
    } catch (err) {
      console.error("Failed to resolve Odoo identity:", err);
      setError(err.message || "Failed to link your Clerk login to an Odoo Employee record.");
      apiClient.clearIdentity();
      setIdentity({ employeeId: null, role: null, email: null });
      setEmployeeDetails(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      if (email) {
        resolveOdooIdentity(email);
      } else {
        setLoading(false);
      }
    } else {
      // Clear identity if logged out of Clerk
      apiClient.clearIdentity();
      setIdentity({ employeeId: null, role: null, email: null });
      setEmployeeDetails(null);
      setLoading(false);
    }
  }, [isLoaded, isSignedIn, user]);

  const handleLogout = async () => {
    apiClient.clearIdentity();
    setIdentity({ employeeId: null, role: null, email: null });
    setEmployeeDetails(null);
    await signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        ...identity,
        employeeDetails,
        loading: loading || !isLoaded,
        error,
        logout: handleLogout,
        recheck: () => user?.primaryEmailAddress?.emailAddress && resolveOdooIdentity(user.primaryEmailAddress.emailAddress)
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
