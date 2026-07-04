import { useState, useEffect, useRef } from 'react';
import api from '../../hooks/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';

const AgentActivityPanel = () => {
  const { user: currentUser } = useAuth();
  const { on, off } = useSocket();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    idleTimeout: 10,
    gracePeriod: 2,
    enableAutoReassignment: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(null);
  const [targetAgentId, setTargetAgentId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [tick, setTick] = useState(0);

  const [activeTab, setActiveTab] = useState('live'); // 'live' or 'history'
  const [historyLogs, setHistoryLogs] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyAgentId, setHistoryAgentId] = useState('');

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      let url = `/api/users/agents/activity-history`;
      const params = [];
      if (historyDate) params.push(`date=${historyDate}`);
      if (historyAgentId) params.push(`userId=${historyAgentId}`);
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      const res = await api.get(url);
      setHistoryLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load activity history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab, historyDate, historyAgentId]);

  // Load activity logs and settings
  const loadData = async () => {
    try {
      const [activityRes, settingsRes] = await Promise.all([
        api.get('/api/users/agents/activity'),
        api.get('/api/settings/agentActivity')
      ]);
      setAgents(activityRes.data.agents || []);
      if (settingsRes.data.settings) {
        setSettings(prev => ({ ...prev, ...settingsRes.data.settings }));
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to realtime status updates via socket
    const handleStatusChanged = () => {
      loadData();
    };

    on('agent_status_changed', handleStatusChanged);
    on('new_lead', handleStatusChanged);
    on('lead_status_updated', handleStatusChanged);

    return () => {
      off('agent_status_changed', handleStatusChanged);
      off('new_lead', handleStatusChanged);
      off('lead_status_updated', handleStatusChanged);
    };
  }, [on, off]);

  // Premium Live ticking timers (updates every 1 second)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleForceStatus = async (agentId, status) => {
    try {
      await api.patch(`/api/users/${agentId}/status/force`, { status });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to override status');
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.patch('/api/settings', { settings });
      alert('Activity configuration updated successfully');
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReassignLeads = async () => {
    if (!targetAgentId) return;
    setReassigning(true);
    try {
      // Find all active leads of showReassignModal agent
      const leadsRes = await api.get(`/api/leads?agent=${showReassignModal._id}`);
      const activeLeads = leadsRes.data.leads || [];

      let reassignedCount = 0;
      for (const lead of activeLeads) {
        if (['assigned', 'in_progress', 'follow_up', 'interested'].includes(lead.status)) {
          await api.post(`/api/leads/${lead._id}/assign`, { agentId: targetAgentId });
          reassignedCount++;
        }
      }

      alert(`Successfully reassigned ${reassignedCount} leads.`);
      setShowReassignModal(null);
      setTargetAgentId('');
      loadData();
    } catch (error) {
      alert('Failed to reassign leads');
    } finally {
      setReassigning(false);
    }
  };

  // Live Timer helper calculations
  const getFormattedTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLiveTimers = (agent) => {
    const now = new Date();
    const statusChangedAt = agent.statusChangedAt ? new Date(agent.statusChangedAt) : now;
    const lastActivityAt = agent.lastActivityAt ? new Date(agent.lastActivityAt) : now;

    const diffSeconds = Math.max(0, Math.floor((now - statusChangedAt) / 1000));
    const idleSeconds = Math.max(0, Math.floor((now - lastActivityAt) / 1000));

    let activeTime = agent.todayActiveTime || 0;
    let breakTime = agent.todayBreakTime || 0;

    // Check if transition crossed midnight - if so, reset counters
    const isSameDay = now.toDateString() === statusChangedAt.toDateString();

    if (isSameDay) {
      if (agent.status === 'online') {
        activeTime += diffSeconds;
      } else if (agent.status === 'break') {
        breakTime += diffSeconds;
      }
    }

    return {
      activeTimeFormatted: getFormattedTime(activeTime),
      breakTimeFormatted: getFormattedTime(breakTime),
      idleTimeFormatted: agent.status === 'online' ? getFormattedTime(idleSeconds) : '--:--:--',
      lastActivityText: agent.lastActivityAt ? new Date(agent.lastActivityAt).toLocaleTimeString() : 'Never'
    };
  };

  // Aggregated live panel stats
  const totalAgents = agents.length;
  const activeCount = agents.filter(a => a.status === 'online').length;
  const breakCount = agents.filter(a => a.status === 'break').length;
  const offlineCount = agents.filter(a => a.status === 'offline' || !a.status).length;
  const busyCount = agents.filter(a => a.status === 'online' && a.assignedLeadsCount > 0).length;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-1.5">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2 text-xs font-extrabold rounded-lg uppercase tracking-wider transition-all border cursor-pointer ${
            activeTab === 'live'
              ? 'bg-primary text-white border-primary shadow-sm'
              : 'bg-surface text-text-2 hover:bg-bg/50 border-border hover:text-text-1'
          }`}
          style={activeTab === 'live' ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
        >
          Live Monitor
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-extrabold rounded-lg uppercase tracking-wider transition-all border cursor-pointer ${
            activeTab === 'history'
              ? 'bg-primary text-white border-primary shadow-sm'
              : 'bg-surface text-text-2 hover:bg-bg/50 border-border hover:text-text-1'
          }`}
          style={activeTab === 'history' ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
        >
          Activity History Logs
        </button>
      </div>

      {activeTab === 'live' ? (
        <>
          {/* Live Panel Header stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total Agents', value: totalAgents, color: 'border-border text-text-1' },
              { label: '🟢 Active', value: activeCount, color: 'border-success/30 text-success' },
              { label: '🟡 Break', value: breakCount, color: 'border-warning/30 text-warning' },
              { label: '⚫ Offline', value: offlineCount, color: 'border-text-3 text-text-3' },
              { label: '🔥 Busy', value: busyCount, color: 'border-danger/30 text-danger' },
            ].map((stat, i) => (
              <div key={i} className={`bg-surface p-4 border rounded-xl shadow-sm flex flex-col justify-center ${stat.color}`}>
                <span className="text-xs font-semibold text-text-3 uppercase tracking-wider">{stat.label}</span>
                <span className="text-2xl font-bold mt-1">{stat.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live List (Left 2 cols) */}
            <div className="lg:col-span-2 bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border bg-bg/50">
                <h3 className="text-sm font-semibold text-text-1">Live Agents Monitor</h3>
                <p className="text-xs text-text-3 mt-0.5">Real-time status changes, activity timers, and current workloads.</p>
              </div>

              {loading ? (
                <div className="p-8 text-center text-text-3">Loading live activity logs...</div>
              ) : agents.length === 0 ? (
                <div className="p-8 text-center text-text-3">No agents registered</div>
              ) : (
                <div className="divide-y divide-border overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-bg text-text-2 font-bold uppercase tracking-wider border-b border-border">
                        <th className="p-3">Agent</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Today Active</th>
                        <th className="p-3">Today Break</th>
                        <th className="p-3">Idle Time</th>
                        <th className="p-3">Leads (Active/Resolved)</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {agents.map((agent) => {
                        const timers = getLiveTimers(agent);
                        const statusColors = {
                          online: 'bg-success/10 text-success border-success/20',
                          break: 'bg-warning/10 text-warning border-warning/20',
                          offline: 'bg-text-3/10 text-text-3 border-border',
                          away: 'bg-amber-600/10 text-amber-600 border-amber-600/20'
                        };

                        return (
                          <tr key={agent._id} className="hover:bg-bg/20 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {agent.avatar ? (
                                  <img src={agent.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                                    {agent.fullName?.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-text-1">{agent.fullName}</div>
                                  <div className="text-[10px] text-text-3">{agent.team || 'No Team'} / {agent.department || 'No Dept'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 border text-[10px] font-bold uppercase rounded ${statusColors[agent.status || 'offline']}`}>
                                {agent.status === 'online' ? 'Active' : agent.status === 'break' ? 'On Break' : 'Offline'}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-semibold">{timers.activeTimeFormatted}</td>
                            <td className="p-3 font-mono font-semibold">{timers.breakTimeFormatted}</td>
                            <td className="p-3 font-mono font-semibold text-text-2">{timers.idleTimeFormatted}</td>
                            <td className="p-3">
                              <span className="font-bold text-text-1">{agent.assignedLeadsCount || 0}</span>
                              <span className="text-text-3"> / </span>
                              <span className="font-bold text-success">{agent.resolvedTodayCount || 0}</span>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {agent.status !== 'online' ? (
                                  <button onClick={() => handleForceStatus(agent._id, 'online')} className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold rounded hover:bg-success/20 cursor-pointer border-0">
                                    Force Active
                                  </button>
                                ) : (
                                  <button onClick={() => handleForceStatus(agent._id, 'break')} className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold rounded hover:bg-warning/20 cursor-pointer border-0">
                                    Force Break
                                  </button>
                                )}
                                {agent.assignedLeadsCount > 0 && (
                                  <button onClick={() => setShowReassignModal(agent)} className="px-2 py-1 bg-danger/10 text-danger text-[10px] font-bold rounded hover:bg-danger/20 cursor-pointer border-0">
                                    Reassign
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Global Configuration settings (Right 1 col, Super Admin only) */}
            <div className="bg-surface rounded-xl border border-border shadow-sm p-4 h-fit">
              <h3 className="text-sm font-semibold text-text-1 mb-1">Assignment Configuration</h3>
              <p className="text-xs text-text-3 mb-4">Update global inactivity boundaries and auto lead reassignments.</p>

              {currentUser?.role !== 'super_admin' ? (
                <div className="p-4 bg-bg text-center text-xs text-text-3 rounded-lg border border-border">
                  🔐 Access Restricted to Super Admin only.
                </div>
              ) : (
                <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-text-2 mb-1.5">Agent Idle Timeout (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={settings.idleTimeout}
                      onChange={(e) => setSettings(prev => ({ ...prev, idleTimeout: parseInt(e.target.value) }))}
                      className="input-field"
                      required
                    />
                    <p className="text-[10px] text-text-3 mt-1">If no user interactions occur for this time, status triggers to Break.</p>
                  </div>

                  <div>
                    <label className="block font-medium text-text-2 mb-1.5">Lead Reassignment Grace Period (Minutes)</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={settings.gracePeriod}
                      onChange={(e) => setSettings(prev => ({ ...prev, gracePeriod: parseInt(e.target.value) }))}
                      className="input-field"
                      required
                    />
                    <p className="text-[10px] text-text-3 mt-1">Wait time before reassigning a lead when the assigned agent goes on break.</p>
                  </div>

                  <div className="flex items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      id="enableAutoReassignment"
                      checked={settings.enableAutoReassignment}
                      onChange={(e) => setSettings(prev => ({ ...prev, enableAutoReassignment: e.target.checked }))}
                      className="rounded text-primary border-border focus:ring-primary h-4 w-4"
                    />
                    <label htmlFor="enableAutoReassignment" className="font-semibold text-text-1 cursor-pointer">
                      Enable Auto Lead Reassignment
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="w-full btn-primary text-xs font-bold py-2 shadow-sm cursor-pointer"
                  >
                    {savingSettings ? 'Saving Configuration...' : 'Update Settings'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden animate-fade-in">
          <div className="p-4 border-b border-border bg-bg/50 flex flex-wrap gap-4 items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-1">Historical Agents Activity Logs</h3>
              <p className="text-xs text-text-3 mt-0.5">Track break times, total active hours, and status histories.</p>
            </div>
            
            <div className="flex flex-wrap gap-2.5 items-center">
              <div>
                <label className="block text-[9px] font-extrabold text-text-3 uppercase tracking-wider mb-1">Filter by Agent</label>
                <select
                  value={historyAgentId}
                  onChange={(e) => setHistoryAgentId(e.target.value)}
                  className="bg-bg border border-border rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-primary font-medium"
                >
                  <option value="">All Agents</option>
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>{a.fullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-extrabold text-text-3 uppercase tracking-wider mb-1">Filter by Date</label>
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                  className="bg-bg border border-border rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:border-primary font-medium"
                />
              </div>
            </div>
          </div>

          {historyLoading ? (
            <div className="p-8 text-center text-text-3 font-medium">Loading history logs...</div>
          ) : historyLogs.length === 0 ? (
            <div className="p-12 text-center text-text-3">
              <div className="w-12 h-12 bg-bg rounded-xl flex items-center justify-center mx-auto mb-3 border border-border">
                <svg className="w-6 h-6 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h4 className="text-xs font-bold text-text-1">No Activity Logs Found</h4>
              <p className="text-[10px] text-text-3 mt-0.5">No status logs recorded for this day / agent query.</p>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-bg text-text-2 font-bold uppercase tracking-wider border-b border-border">
                    <th className="p-3">Agent</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Total Active Time</th>
                    <th className="p-3">Total Break Time</th>
                    <th className="p-3">Timeline Events</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-bg/10 transition-colors align-top">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {log.userId?.avatar ? (
                            <img src={log.userId.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-extrabold" style={{ backgroundColor: 'rgba(var(--primary), 0.1)', color: 'var(--primary)' }}>
                              {log.userId?.fullName?.charAt(0) || 'A'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-text-1">{log.userId?.fullName || 'Unknown Agent'}</div>
                            <div className="text-[9px] text-text-3">Phone: {log.userId?.mobile || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-text-2">{log.date}</td>
                      <td className="p-3 font-mono font-bold text-success">{getFormattedTime(log.activeTime)}</td>
                      <td className="p-3 font-mono font-bold text-warning">{getFormattedTime(log.breakTime)}</td>
                      <td className="p-3 max-w-sm">
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
                          {log.statusLogs && log.statusLogs.length > 0 ? (
                            log.statusLogs.map((seg, idx) => {
                              const badgeCls = {
                                online: 'bg-success/15 text-success border-success/20',
                                break: 'bg-warning/15 text-warning border-warning/20',
                                offline: 'bg-text-3/15 text-text-3 border-border',
                                away: 'bg-amber-600/15 text-amber-600 border-amber-600/20'
                              };
                              return (
                                <div key={idx} className="flex items-center gap-2 text-[10px] p-1 border border-border/40 rounded bg-bg/50 animate-fade-in">
                                  <span className={`px-1.5 py-0.2 border text-[8px] font-extrabold uppercase rounded ${badgeCls[seg.status] || badgeCls.offline}`}>
                                    {seg.status === 'online' ? 'Active' : seg.status === 'break' ? 'Break' : seg.status}
                                  </span>
                                  <span className="font-semibold text-text-2 font-mono">
                                    {new Date(seg.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    {' → '}
                                    {seg.endedAt ? new Date(seg.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Now'}
                                  </span>
                                  <span className="text-text-3 font-semibold font-mono ml-auto">
                                    ({getFormattedTime(seg.duration)})
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-text-3 italic text-[10px]">No transition timeline events.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Manual Reassign Leads Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-sm rounded-xl p-5 shadow-float text-xs animate-scale-in">
            <h4 className="text-sm font-bold text-text-1 mb-1">Reassign Active Leads</h4>
            <p className="text-text-3 mb-4">Reassign all active leads currently under <b>{showReassignModal.fullName}</b> to another agent.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-text-2 mb-1.5 font-medium">Select Target Agent</label>
                <select
                  value={targetAgentId}
                  onChange={(e) => setTargetAgentId(e.target.value)}
                  className="input-field"
                >
                  <option value="">-- Choose Agent --</option>
                  {agents
                    .filter(a => a._id !== showReassignModal._id && a.status === 'online')
                    .map(a => (
                      <option key={a._id} value={a._id}>{a.fullName} ({a.team || 'No Team'})</option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => { setShowReassignModal(null); setTargetAgentId(''); }}
                  className="btn-secondary py-1.5 px-3 cursor-pointer rounded-xl"
                  disabled={reassigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReassignLeads}
                  className="btn-primary py-1.5 px-4 font-bold disabled:opacity-50 cursor-pointer rounded-xl"
                  disabled={!targetAgentId || reassigning}
                >
                  {reassigning ? 'Reassigning...' : 'Transfer Leads'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentActivityPanel;
