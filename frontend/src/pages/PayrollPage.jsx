import React, { useEffect, useState } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { apiClient } from '../api/client';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { StatusBadge } from '../components/StatusBadge';
import { DollarSign, FileText, AlertCircle, RefreshCw } from 'lucide-react';

export default function PayrollPage() {
  const { role, employeeId } = useAuthContext();
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(employeeId || '');
  const [payrollData, setPayrollData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  
  // Wage update field
  const [newWage, setNewWage] = useState('');

  // Fetch employee list for admin selector
  const fetchEmployees = async () => {
    if (role !== 'admin') return;
    try {
      const res = await apiClient.get('/employees');
      if (res.success) {
        setEmployees(res.data);
        if (res.data.length > 0 && !selectedEmpId) {
          setSelectedEmpId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPayroll = async (empId) => {
    if (!empId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/payroll/${empId}`);
      if (res.success) {
        setPayrollData(res.data);
        const activeContract = res.data.contracts.find(c => c.state === 'open') || res.data.contracts[0];
        setNewWage(activeContract ? activeContract.wage.toString() : '');
      }
    } catch (err) {
      setError(err.message || "Failed to load payroll details.");
      setPayrollData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [role]);

  useEffect(() => {
    if (selectedEmpId) {
      fetchPayroll(selectedEmpId);
    }
  }, [selectedEmpId]);

  const handleUpdateWage = async (e) => {
    e.preventDefault();
    if (!newWage || isNaN(newWage)) return;
    try {
      setUpdating(true);
      setError(null);
      const res = await apiClient.patch(`/payroll/${selectedEmpId}`, {
        wage: parseFloat(newWage)
      });
      if (res.success) {
        fetchPayroll(selectedEmpId);
      }
    } catch (err) {
      setError(err.message || "Failed to update wage.");
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Page Title & Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff' }}>Payroll & Salary</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            {role === 'admin' 
              ? 'View contracts and manage basic salaries for employees.' 
              : 'Review your current contract status and history of payslips.'
            }
          </p>
        </div>

        {role === 'admin' && (
          <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
            <select
              className="form-select"
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
            >
              <option value="">Select Employee...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.05)',
          border: '1px solid rgba(244, 63, 94, 0.1)',
          borderRadius: '8px',
          padding: '16px',
          color: '#fda4af',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton count={2} height="120px" />
      ) : payrollData ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }} className="payroll-grid">
          <style>{`
            @media (min-width: 1024px) {
              .payroll-grid {
                grid-template-columns: 3fr 2fr;
              }
            }
          `}</style>

          {/* Active Contract Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>Current Contract</h3>
              {payrollData.contracts.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No active contract found in Odoo for this employee.</p>
              ) : (
                (() => {
                  const contract = payrollData.contracts.find(c => c.state === 'open') || payrollData.contracts[0];
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff' }}>{contract.name || 'Employment Contract'}</span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                            Start Date: {contract.dateStart || '-'} {contract.dateEnd ? `| End Date: ${contract.dateEnd}` : ''}
                          </span>
                        </div>
                        <StatusBadge status={contract.state} />
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '12px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Wage (Monthly Basic)</span>
                          <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                            <DollarSign size={20} style={{ color: 'var(--primary)' }} />
                            {formatCurrency(contract.wage)}
                          </span>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>Salary Structure</span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', display: 'block', marginTop: '10px' }}>
                            {contract.salaryStructure || 'Standard'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Payslips table */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>Payslip History</h3>
              {!payrollData.payslipModuleInstalled ? (
                <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--panel-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <AlertCircle size={20} style={{ color: 'var(--text-secondary)' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    Payslip history is only available in Odoo Enterprise Edition. 
                    Your Odoo trial database is running Community edition.
                  </p>
                </div>
              ) : payrollData.payslips?.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No payslips generated for this employee yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Number</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Period</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Basic</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Net Wage</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollData.payslips?.map(slip => (
                        <tr key={slip.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                          <td style={{ padding: '12px', fontWeight: '500' }}>{slip.number || 'Draft'}</td>
                          <td style={{ padding: '12px', fontSize: '0.9rem' }}>{slip.dateFrom} to {slip.dateTo}</td>
                          <td style={{ padding: '12px' }}>{formatCurrency(slip.basicWage)}</td>
                          <td style={{ padding: '12px', color: '#fff', fontWeight: '600' }}>{formatCurrency(slip.netWage)}</td>
                          <td style={{ padding: '12px' }}><StatusBadge status={slip.state} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Admin Salary Update Form */}
          {role === 'admin' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', marginBottom: '16px' }}>Manage Wage</h3>
                <form onSubmit={handleUpdateWage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Update Monthly Wage</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <DollarSign size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        className="form-input"
                        style={{ paddingLeft: '32px' }}
                        value={newWage}
                        onChange={(e) => setNewWage(e.target.value)}
                        disabled={updating}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={updating}>
                    {updating && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} />}
                    <span>Update Active Contract Wage</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Please select an employee to view their payroll details.
        </div>
      )}
    </div>
  );
}
