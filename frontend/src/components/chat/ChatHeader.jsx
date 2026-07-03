import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import api from '../../hooks/api';
import { useBranding } from '../../context/BrandingContext';

const statusConfig = {
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-100 text-amber-700 border border-amber-200',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  interested: {
    label: 'Interested',
    color: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
      </svg>
    )
  },
  closed: {
    label: 'Not Interested',
    color: 'bg-red-100 text-red-700 border border-red-200',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  },
  deposit_done: {
    label: 'Deposit Done',
    color: 'bg-green-100 text-green-700 border border-green-200',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    )
  },
  withdrawal_done: {
    label: 'Withdrawal Done',
    color: 'bg-blue-100 text-blue-700 border border-blue-200',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  issue_solved: {
    label: 'Issue Solved',
    color: 'bg-teal-100 text-teal-700 border border-teal-200',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  issue_not_solved: {
    label: 'Issue Not Solved',
    color: 'bg-rose-100 text-rose-700 border border-rose-200',
    icon: (
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    )
  },
};

const ChatHeader = ({ chat, user, onBack, onMenuClick, onCustomerClick, onToggleNotes, showNotesActive }) => {
  const { on, off } = useSocket();
  const { branding } = useBranding();
  const [agentStatus, setAgentStatus] = useState(chat?.agentId?.status || 'online');
  const [lead, setLead] = useState(null);
  const [leadStatus, setLeadStatus] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const isCustomer = user?.role === 'customer';
  const otherParty = isCustomer ? chat?.agentId : chat?.customerId;

  const fetchLead = useCallback(() => {
    if (!isCustomer && chat?.customerId?._id) {
      api.get(`/api/leads?customerId=${chat.customerId._id}`).then(res => {
        if (res.data.leads?.length > 0) {
          const l = res.data.leads[0];
          setLead(l);
          setLeadStatus(l.status);
        }
      }).catch(() => {});
    }
  }, [chat, isCustomer]);

  useEffect(() => {
    fetchLead();
    window.addEventListener('lead-status-changed', fetchLead);
    return () => {
      window.removeEventListener('lead-status-changed', fetchLead);
    };
  }, [fetchLead]);

  useEffect(() => {
    const handleAgentStatusChanged = (data) => {
      if (chat?.agentId?._id === data.userId) {
        setAgentStatus(data.status);
      }
    };

    on('agent_status_changed', handleAgentStatusChanged);
    
    const handleLeadUpdated = (data) => {
      if (data.lead && data.lead.customerId === chat?.customerId?._id) {
        setLead(data.lead);
        if (data.lead.status) setLeadStatus(data.lead.status);
      }
    };
    on('lead_updated', handleLeadUpdated);

    return () => {
      off('agent_status_changed', handleAgentStatusChanged);
      off('lead_updated', handleLeadUpdated);
    };
  }, [chat, on, off]);

  const getDisplayName = () => {
    if (isCustomer) {
      if (chat?.agentId?.fullName) {
        const types = chat.agentId.permissions?.issueTypes || [];
        let label = 'Customer Care';
        if (types.includes('withdrawal')) {
          label = 'Withdrawal';
        } else if (types.includes('deposit')) {
          label = 'Deposit';
        }
        return `${chat.agentId.fullName} (${label})`;
      }
      return branding.companyName ? `${branding.companyName.toUpperCase()} SUPPORT` : 'SUPPORT';
    }
    return otherParty?.fullName || 'Unknown';
  };

  const getStatusText = () => {
    if (isCustomer) {
      if (agentStatus === 'break') return 'Agent on break';
      return branding.companyName ? `${branding.companyName.toUpperCase()} SUPPORT` : 'SUPPORT';
    }
    const mobile = otherParty?.mobile || '';
    return `Phone: ${mobile}`;
  };

  const handleStatusUpdate = async (status) => {
    setUpdatingStatus(true);
    try {
      const targetId = lead?._id || chat?.customerId?._id;
      if (targetId) {
        await api.patch(`/api/leads/${targetId}/status`, { status });
        setLeadStatus(status);
      }
    } catch (error) {
      console.error('Failed to update lead status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCopyId = (e) => {
    e.stopPropagation();
    if (otherParty?.dafaxbetId) {
      navigator.clipboard.writeText(otherParty.dafaxbetId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  const handleCopyPhone = (e) => {
    e.stopPropagation();
    if (otherParty?.mobile) {
      navigator.clipboard.writeText(otherParty.mobile);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1500);
    }
  };

  const handleUpgradeLead = async (e) => {
    e.stopPropagation();
    if (!lead?._id) {
      alert("Lead information is loading or not found.");
      return;
    }
    const defaultVal = lead.requestedDafaId || '';
    const promptMsg = lead.requestedDafaId
      ? `Verify and Approve Dafa ID for ${otherParty?.fullName || 'this client'}:`
      : `Enter newly created Dafa ID for ${otherParty?.fullName || 'this client'}:`;

    const dafaId = window.prompt(promptMsg, defaultVal);
    if (!dafaId || !dafaId.trim()) return;

    const password = window.prompt(`Enter game site password for ${dafaId.trim()} (leave blank to skip):`);
    // password can be empty — it's optional

    try {
      await api.post(`/api/leads/${lead._id}/upgrade-client`, {
        dafaxbetId: dafaId.trim(),
        password: password ? password.trim() : '',
      });
      alert("Lead upgraded to Client successfully!");
      window.dispatchEvent(new CustomEvent('lead-status-changed'));
    } catch (error) {
      alert(error.response?.data?.error || "Failed to upgrade lead");
    }
  };

  const handleRejectVerification = async (e) => {
    e.stopPropagation();
    if (!lead?._id) return;
    if (!window.confirm(`Are you sure you want to reject the verification request for ${lead.requestedDafaId || 'this player'}?`)) return;
    try {
      await api.post(`/api/leads/${lead._id}/reject-verification`);
      alert("Verification request rejected successfully!");
      window.dispatchEvent(new CustomEvent('lead-status-changed'));
    } catch (error) {
      alert(error.response?.data?.error || "Failed to reject verification");
    }
  };

  return (
    <div className="bg-surface border-b border-border sticky top-0 z-10">
      <div className="flex items-center gap-3 px-3 h-11">
        <button
          onClick={onBack}
          className="btn-icon text-text-1 md:hidden"
          aria-label="Go back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <button
          onClick={onCustomerClick}
          className="flex items-center gap-3 flex-1 min-w-0"
        >
          <div className="relative">
            {otherParty?.avatar ? (
              <img
                src={otherParty.avatar}
                alt="Profile"
                className="w-9 h-9 object-cover flex-shrink-0 border border-border"
              />
            ) : (
              <div className="w-9 h-9 bg-primary flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm" style={{ backgroundColor: branding.primaryColor || '#B91C1C' }}>
                {getDisplayName().charAt(0)}
              </div>
            )}
            {!isCustomer && (
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-surface ${otherParty?.isOnline ? 'bg-success' : 'bg-text-3'}`} />
            )}
          </div>

          <div className="text-left min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-text-1 truncate flex items-center gap-2 flex-wrap">
              <span>{getDisplayName()}</span>
              {!isCustomer && (
                otherParty?.dafaxbetId ? (
                  <span 
                    onClick={handleCopyId}
                    title="Click to copy ID"
                    className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-primary/10 text-primary border border-primary/20 shrink-0 flex items-center gap-1 active:scale-95 transition-all cursor-pointer select-none" 
                    style={{ color: branding.primaryColor || '#B91C1C', backgroundColor: `${branding.primaryColor || '#B91C1C'}15`, borderColor: `${branding.primaryColor || '#B91C1C'}30` }}
                  >
                    <span>{copiedId ? 'Copied! ✓' : `ID: ${otherParty.dafaxbetId}`}</span>
                    {!copiedId && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    )}
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {lead?.requestedDafaId ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-rose-500/10 text-rose-600 border border-rose-500/20 shrink-0 select-none animate-pulse">
                        Pending Link: {lead.requestedDafaId}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0 select-none">
                        New Lead (No ID)
                      </span>
                    )}
                    <button
                      onClick={handleUpgradeLead}
                      title={lead?.requestedDafaId ? `Approve Dafa ID: ${lead.requestedDafaId}` : "Set Dafa ID & Upgrade to Client"}
                      className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-primary text-white hover:opacity-90 active:scale-95 transition-all shrink-0 flex items-center gap-1 border border-primary/20 cursor-pointer select-none"
                      style={{ 
                        backgroundColor: lead?.requestedDafaId ? '#10B981' : (branding.primaryColor || '#B91C1C'),
                        borderColor: lead?.requestedDafaId ? '#10B981' : (branding.primaryColor || '#B91C1C')
                      }}
                    >
                      {lead?.requestedDafaId ? '✅ Verify & Approve' : '🔑 Set ID & Upgrade'}
                    </button>
                    {lead?.requestedDafaId && (
                      <button
                        onClick={handleRejectVerification}
                        title="Reject verification request"
                        className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-red-600 hover:bg-red-700 text-white hover:opacity-90 active:scale-95 transition-all shrink-0 flex items-center gap-1 border border-red-500/20 cursor-pointer select-none"
                      >
                        ❌ Reject
                      </button>
                    )}
                  </div>
                )
              )}
            </h2>
            <p className="text-[11px] text-text-3 flex items-center gap-1">
              {agentStatus === 'break' && isCustomer ? (
                <span className="text-warning">Agent on break</span>
              ) : (
                <>
                  <span>{getStatusText()}</span>
                  {!isCustomer && otherParty?.mobile && (
                    <button 
                      onClick={handleCopyPhone}
                      title="Click to copy phone number"
                      className="p-0.5 rounded hover:bg-bg active:scale-95 transition-all text-text-3 hover:text-text-1 cursor-pointer ml-1 select-none flex items-center justify-center"
                    >
                      {copiedPhone ? (
                        <span className="text-[10px] font-bold text-success">Copied!</span>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      )}
                    </button>
                  )}
                </>
              )}
            </p>
          </div>
        </button>

        {!isCustomer && (
          <button
            onClick={onToggleNotes}
            className={`btn-icon transition-colors ${showNotesActive ? 'text-primary' : 'text-text-2 hover:text-primary'}`}
            title="Toggle Internal Notes Sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={showNotesActive ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
        )}

        <button
          onClick={onMenuClick}
          className="btn-icon text-text-1"
          aria-label="More options"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>
      </div>

      {!isCustomer && (
        <div className="px-3 pb-2">
          {chat?.issueType && (
            <div className="mb-1.5">
              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                chat.issueType === 'deposit' ? 'bg-info/10 text-info' :
                chat.issueType === 'withdrawal' ? 'bg-warning/10 text-warning' :
                'bg-text-3/10 text-text-2'
              }`}>
                {chat.issueType === 'deposit' ? '💳 Deposit' :
                 chat.issueType === 'withdrawal' ? '💸 Withdrawal' :
                 '💬 General'}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 w-full">
            {Object.entries(statusConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleStatusUpdate(key)}
                disabled={updatingStatus}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                  leadStatus === key
                    ? config.color
                    : 'bg-bg text-text-2 hover:bg-border border border-transparent'
                }`}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
