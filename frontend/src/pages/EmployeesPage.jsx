import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { User, Phone, Mail, MapPin, Briefcase, Calendar, Check } from 'lucide-react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal state
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empDetails, setEmpDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/employees');
      if (res.success) {
        setEmployees(res.data);
      }
    } catch (err) {
      setError("Failed to fetch employee list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleRowClick = async (row) => {
    setSelectedEmp(row);
    setDetailsLoading(true);
    setIsEditing(false);
    try {
      const res = await apiClient.get(`/employees/${row.id}`);
      if (res.success) {
        setEmpDetails(res.data);
        setEditForm(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddressChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setDetailsLoading(true);
      
      // Build PATCH body with structure corresponding to backend's expectations
      const patchData = {
        name: editForm.name,
        work_phone: editForm.workPhone,
        mobile_phone: editForm.mobilePhone,
        private_phone: editForm.privatePhone,
        private_email: editForm.privateEmail,
        // Flat address fields as Odoo expects
        private_street: editForm.address?.street,
        private_city: editForm.address?.city,
        private_zip: editForm.address?.zip,
      };

      const res = await apiClient.patch(`/employees/${selectedEmp.id}`, patchData);
      if (res.success) {
        // Refresh detail view
        const detailRes = await apiClient.get(`/employees/${selectedEmp.id}`);
        if (detailRes.success) {
          setEmpDetails(detailRes.data);
          setEditForm(detailRes.data);
        }
        setIsEditing(false);
        // Refresh list
        fetchEmployees();
      }
    } catch (err) {
      alert("Failed to save changes: " + err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const columns = [
    {
      key: 'avatar',
      label: '',
      sortable: false,
      width: '60px',
      render: (val, row) => (
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#232329',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid var(--panel-border)'
        }}>
          {val ? (
            <img src={val.startsWith('data:') ? val : `data:image/png;base64,${val}`} alt={row.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <User size={16} />
          )}
        </div>
      )
    },
    { key: 'name', label: 'Name' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'department', label: 'Department' },
    { key: 'email', label: 'Email' },
    { key: 'mobilePhone', label: 'Mobile' }
  ];

  if (loading) return <LoadingSkeleton count={4} height="80px" />;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>Employee Directory</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Browse and manage all registered team members.</p>
        </div>
      </div>

      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}

      <DataTable
        columns={columns}
        data={employees}
        searchKey="name"
        searchPlaceholder="Search employees by name..."
        onRowClick={handleRowClick}
      />

      {/* Profile Detail Modal */}
      <Modal
        isOpen={!!selectedEmp}
        onClose={() => {
          setSelectedEmp(null);
          setEmpDetails(null);
        }}
        title={empDetails ? `${empDetails.name}'s Profile` : 'Employee Details'}
        size="md"
      >
        {detailsLoading ? (
          <LoadingSkeleton count={3} height="60px" />
        ) : empDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header section with avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#232329',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--primary)',
                flexShrink: 0
              }}>
                {empDetails.profilePicture ? (
                  <img 
                    src={empDetails.profilePicture.startsWith('data:') ? empDetails.profilePicture : `data:image/png;base64,${empDetails.profilePicture}`} 
                    alt={empDetails.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <User size={36} />
                )}
              </div>
              <div>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#fff' }}>{empDetails.name}</h4>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Briefcase size={14} />
                  <span>{empDetails.jobTitle || 'No Title'} — {empDetails.department || 'No Dept'}</span>
                </div>
              </div>
            </div>

            {/* Profile fields */}
            {!isEditing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Work Email</span>
                    <span style={{ color: '#fff', fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} style={{ color: 'var(--primary)' }} />
                      {empDetails.email || '-'}
                    </span>
                  </div>
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Work Phone</span>
                    <span style={{ color: '#fff', fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} style={{ color: 'var(--primary)' }} />
                      {empDetails.workPhone || '-'}
                    </span>
                  </div>
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Mobile Phone</span>
                    <span style={{ color: '#fff', fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} style={{ color: 'var(--primary)' }} />
                      {empDetails.mobilePhone || '-'}
                    </span>
                  </div>
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Private Phone</span>
                    <span style={{ color: '#fff', fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} style={{ color: 'var(--primary)' }} />
                      {empDetails.privatePhone || '-'}
                    </span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Private Address</span>
                  <span style={{ color: '#fff', fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} style={{ color: 'var(--primary)' }} />
                    {empDetails.address?.street 
                      ? `${empDetails.address.street}, ${empDetails.address.city || ''} ${empDetails.address.zip || ''}`
                      : '-'
                    }
                  </span>
                </div>

                <div className="glass-panel" style={{ padding: '16px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Work Schedule</span>
                  <span style={{ color: '#fff', fontSize: '0.95rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} style={{ color: 'var(--primary)' }} />
                    {empDetails.workSchedule || '-'}
                  </span>
                </div>

                <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
                  Edit Profile Fields
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name || ''}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Work Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.workPhone || ''}
                      onChange={(e) => handleInputChange('workPhone', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.mobilePhone || ''}
                      onChange={(e) => handleInputChange('mobilePhone', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Private Email</label>
                    <input
                      type="email"
                      className="form-input"
                      value={editForm.privateEmail || ''}
                      onChange={(e) => handleInputChange('privateEmail', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Private Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.privatePhone || ''}
                      onChange={(e) => handleInputChange('privatePhone', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Street Address</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.address?.street || ''}
                      onChange={(e) => handleAddressChange('street', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.address?.city || ''}
                      onChange={(e) => handleAddressChange('city', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Zip Code</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editForm.address?.zip || ''}
                      onChange={(e) => handleAddressChange('zip', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>
                    <Check size={16} />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : null}
      </Modal>
    </div>
  );
}
