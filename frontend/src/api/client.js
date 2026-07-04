const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.employeeId = localStorage.getItem('hrms_employee_id') || null;
    this.userRole = localStorage.getItem('hrms_user_role') || null;
    this.userEmail = localStorage.getItem('hrms_user_email') || null;
  }

  setIdentity(employeeId, role, email) {
    this.employeeId = employeeId;
    this.userRole = role;
    this.userEmail = email;
    if (employeeId) localStorage.setItem('hrms_employee_id', employeeId);
    else localStorage.removeItem('hrms_employee_id');
    if (role) localStorage.setItem('hrms_user_role', role);
    else localStorage.removeItem('hrms_user_role');
    if (email) localStorage.setItem('hrms_user_email', email);
    else localStorage.removeItem('hrms_user_email');
  }

  clearIdentity() {
    this.employeeId = null;
    this.userRole = null;
    this.userEmail = null;
    localStorage.removeItem('hrms_employee_id');
    localStorage.removeItem('hrms_user_role');
    localStorage.removeItem('hrms_user_email');
  }

  async request(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.userRole) {
      headers['x-user-role'] = this.userRole;
    }
    if (this.employeeId) {
      headers['x-employee-id'] = this.employeeId.toString();
    }

    const config = {
      ...options,
      headers,
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`API Error on ${endpoint}:`, error);
      throw error;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
