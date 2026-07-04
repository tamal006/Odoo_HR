import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

export const DataTable = ({
  columns,
  data = [],
  loading = false,
  placeholderText = "No records found.",
  searchPlaceholder = "Search...",
  searchKey,
  onRowClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState(null);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const filteredData = React.useMemo(() => {
    let result = [...data];

    // Apply search filter
    if (searchQuery && searchKey) {
      result = result.filter((row) => {
        const val = row[searchKey];
        return val ? val.toString().toLowerCase().includes(searchQuery.toLowerCase()) : false;
      });
    }

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        if (aVal == null) return 1;
        if (bVal == null) return -1;

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aVal > bVal) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }

    return result;
  }, [data, searchQuery, searchKey, sortConfig]);

  return (
    <div className="glass-panel" style={{ overflow: 'hidden', padding: '16px 0' }}>
      <style>{`
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }
        .custom-table th {
          padding: 14px 20px;
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--text-secondary);
          border-bottom: 1px solid var(--panel-border);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
        }
        .custom-table th:hover {
          color: var(--text-primary);
        }
        .custom-table td {
          padding: 16px 20px;
          font-size: 0.95rem;
          color: var(--text-primary);
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .custom-table tr:last-child td {
          border-bottom: none;
        }
        .custom-table tr.clickable {
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .custom-table tr.clickable:hover {
          background-color: rgba(255, 255, 255, 0.02);
        }
      `}</style>

      {searchKey && (
        <div style={{ padding: '0 20px 16px 20px', display: 'flex', alignItems: 'center', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '32px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearch}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="custom-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.key} 
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{ width: col.width }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{col.label}</span>
                    {col.sortable !== false && sortConfig?.key === col.key && (
                      sortConfig.direction === 'ascending' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>
                      <div className="skeleton-row" style={{
                        height: '16px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '4px',
                        width: '80%',
                        animation: 'pulse 1.5s infinite ease-in-out'
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
                  {placeholderText}
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr 
                  key={row.id || idx} 
                  className={onRowClick ? 'clickable' : ''}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};
