import React, { useEffect, useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { User, Phone, Mail, MapPin, Briefcase, Calendar, Check, Edit2 } from 'lucide-react';

export default function ProfilePage() {
  const { employeeId, role, recheck } = useAuthContext();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({});

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/employees/${employeeId}`);
      if (res.success) {
        setProfile(res.data);
        setForm(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) fetchProfile();
  }, [employeeId]);

  const handleInputChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleAddressChange = (field, value) => {
    setForm(prev => ({
      ...prev,
      address: { ...prev.address, [field]: value }
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const patchData = {
        name: form.name,
        work_phone: form.workPhone,
        mobile_phone: form.mobilePhone,
        private_phone: form.privatePhone,
        private_email: form.privateEmail,
        private_street: form.address?.street,
        private_city: form.address?.city,
        private_zip: form.address?.zip,
      };

      const res = await apiClient.patch(`/employees/${employeeId}`, patchData);
      if (res.success) {
        setIsEditing(false);
        await fetchProfile();
        // Refresh root layout context details
        recheck();
      }
    } catch (err) {
      alert("Failed to save changes: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton count={3} height="80px" />;
  if (!profile) return <div>Failed to load profile details.</div>;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Profile Header */}
      <div className="glass-panel" style={{ padding: '32px', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          overflow: 'hidden',
          background: '#232329',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid var(--primary)',
          flexShrink: 0
        }}>
          {profile.profilePicture ? (
            <img 
              src={profile.profilePicture.startsWith('data:') ? profile.profilePicture : `data:image/png;base64,${profile.profilePicture}`} 
              alt={profile.name} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <User size={48} />
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#fff' }}>{profile.name}</h2>
          <div style={{ color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Briefcase size={16} />
            <span>{profile.jobTitle || 'No Title'} — {profile.department || 'No Dept'}</span>
          </div>
        </div>

        {!isEditing && (
          <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
            <Edit2 size={16} />
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {/* Profile Details Panel */}
      <div className="glass-panel" style={{ padding: '32px' }}>
        {!isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
              Contact Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Work Email</span>
                <span style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <Mail size={16} style={{ color: 'var(--primary)' }} />
                  {profile.email || '-'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Work Phone</span>
                <span style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <Phone size={16} style={{ color: 'var(--primary)' }} />
                  {profile.workPhone || '-'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mobile Phone</span>
                <span style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <Phone size={16} style={{ color: 'var(--primary)' }} />
                  {profile.mobilePhone || '-'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Private Phone</span>
                <span style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <Phone size={16} style={{ color: 'var(--primary)' }} />
                  {profile.privatePhone || '-'}
                </span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px', marginTop: '16px' }}>
              Personal Details & Location
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Private Address</span>
                <span style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <MapPin size={16} style={{ color: 'var(--primary)' }} />
                  {profile.address?.street 
                    ? `${profile.address.street}, ${profile.address.city || ''} ${profile.address.zip || ''}`
                    : 'No Address Configured'
                  }
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Private Email</span>
                <span style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <Mail size={16} style={{ color: 'var(--primary)' }} />
                  {profile.privateEmail || '-'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Work Schedule</span>
                <span style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <Calendar size={16} style={{ color: 'var(--primary)' }} />
                  {profile.workSchedule || '-'}
                </span>
              </div>
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#fff', borderBottom: '1px solid var(--panel-border)', paddingBottom: '12px' }}>
              Edit Profile Info
            </h3>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={form.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Work Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.workPhone || ''}
                  onChange={(e) => handleInputChange('workPhone', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mobile Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.mobilePhone || ''}
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
                  value={form.privateEmail || ''}
                  onChange={(e) => handleInputChange('privateEmail', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Private Phone</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.privatePhone || ''}
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
                  value={form.address?.street || ''}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.address?.city || ''}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Zip Code</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.address?.zip || ''}
                  onChange={(e) => handleAddressChange('zip', e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
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

    </div>
  );
}
