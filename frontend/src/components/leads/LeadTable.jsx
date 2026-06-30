import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const LeadTable = ({ onSelectLead }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [agents, setAgents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'new', label: 'New', class: 'badge-new' },
    { value: 'assigned', label: 'Assigned', class: 'badge-assigned' },
    { value: 'in_progress', label: 'In Progress', class: 'badge-in_progress' },
    { value: 'follow_up', label: 'Follow-up', class: 'badge-follow_up' },
    { value: 'interested', label: 'Interested', class: 'badge-interested' },
    { value: 'converted', label: 'Converted', class: 'badge-converted' },
    { value: 'closed', label: 'Closed', class: 'badge-closed' },
    { value: 'deposit_done', label: 'Deposit Done', class: 'badge-deposit_done' },
    { value: 'withdrawal_done', label: 'Withdrawal Done', class: 'badge-withdrawal_done' },
    { value: 'issue_solved', label: 'Issue Solved', class: 'badge-issue_solved' },
    { value: 'issue_not_solved', label: 'Issue Not Solved', class: 'badge-issue_not_solved' },
  ];

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    loadLeads();
  }, [pagination.page, statusFilter, agentFilter, search, startDate, endDate, tagFilter]);

  const loadAgents = async () => {
    try {
      const res = await api.get('/api/users/agents');
      setAgents(res.data.agents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
      });

      if (statusFilter) params.append('status', statusFilter);
      if (agentFilter) params.append('agent', agentFilter);
      if (search) params.append('search', search);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (tagFilter) params.append('tag', tagFilter);

      const res = await api.get(`/api/leads?${params}`);
      setLeads(res.data.leads);
      setPagination(res.data.pagination);
    } catch (error) {
      console.error('Failed to load leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (leadId, agentId) => {
    try {
      await api.post(`/api/leads/${leadId}/assign`, { agentId });
      loadLeads();
    } catch (error) {
      console.error('Failed to assign lead:', error);
    }
  };

  const handleAutoAssign = async () => {
    try {
      await api.post('/api/leads/auto-assign');
      loadLeads();
    } catch (error) {
      console.error('Failed to auto-assign:', error);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (agentFilter) params.append('agent', agentFilter);
      if (search) params.append('search', search);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (tagFilter) params.append('tag', tagFilter);

      const res = await api.get(`/api/leads/export?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export leads:', error);
      alert('Failed to export leads');
    }
  };

  const getStatusBadge = (status) => {
    const s = statuses.find(st => st.value === status);
    return s || statuses[0];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="bg-surface rounded-lg shadow-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-1">All Leads</h2>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              className="btn-secondary text-sm flex items-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={handleAutoAssign}
              className="btn-secondary text-sm"
            >
              Auto-Assign
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, mobile, ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="input-field pl-10"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="input-field w-full md:w-40"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="input-field w-full md:w-40"
          >
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a._id} value={a._id}>{a.fullName}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3 mt-3">
          <input
            type="text"
            placeholder="Filter by tag..."
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="input-field w-full md:w-40"
          />
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-text-2">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="input-field text-xs py-1.5 px-3 min-h-[36px]"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-text-2">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
              className="input-field text-xs py-1.5 px-3 min-h-[36px]"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-2 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-2 uppercase">Mobile</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-2 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-2 uppercase">Agent</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-text-2 uppercase">Date</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-text-2 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-sm text-text-2">
                  No leads found
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const statusInfo = getStatusBadge(lead.status);
                return (
                  <tr
                    key={lead._id}
                    className="border-b border-border hover:bg-bg transition-colors cursor-pointer"
                    onClick={() => onSelectLead(lead)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-semibold text-white">
                            {lead.customerId?.fullName?.charAt(0) || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-1">{lead.customerId?.fullName}</p>
                          <p className="text-[11px] text-text-3">{lead.customerId?.customerId}</p>
                          {lead.customerId?.dafaxbetId && (
                            <p className="text-[10px] text-primary font-semibold">Dafaxbet ID: {lead.customerId.dafaxbetId}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-2">{lead.customerId?.mobile}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${statusInfo.class}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.assignedAgent ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center">
                            <span className="text-[10px] font-semibold text-primary">
                              {lead.assignedAgent.fullName?.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm text-text-1">{lead.assignedAgent.fullName}</span>
                        </div>
                      ) : (
                        <select
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => { e.stopPropagation(); handleAssign(lead._id, e.target.value); }}
                          className="text-xs border border-border rounded px-2 py-1 bg-surface"
                          defaultValue=""
                        >
                          <option value="" disabled>Assign</option>
                          {agents.map((a) => (
                            <option key={a._id} value={a._id}>{a.fullName}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-2">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectLead(lead); }}
                        className="text-xs text-primary hover:text-primary-hover"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-text-2">
            Showing {((pagination.page - 1) * pagination.limit) + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
              disabled={pagination.page === 1}
              className="btn-icon text-text-2 disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => setPagination(p => ({ ...p, page }))}
                  className={`w-8 h-8 rounded-md text-sm ${
                    pagination.page === page
                      ? 'bg-primary text-white'
                      : 'text-text-2 hover:bg-bg'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
              disabled={pagination.page === pagination.pages}
              className="btn-icon text-text-2 disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadTable;
