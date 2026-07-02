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
                              <button onClick={() => handleForceStatus(agent._id, 'online')} className="px-2 py-1 bg-success/10 text-success text-[10px] font-bold rounded hover:bg-success/20">
                                Force Active
                              </button>
                            ) : (
                              <button onClick={() => handleForceStatus(agent._id, 'break')} className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold rounded hover:bg-warning/20">
                                Force Break
                              </button>
                            )}
                            {agent.assignedLeadsCount > 0 && (
                              <button onClick={() => setShowReassignModal(agent)} className="px-2 py-1 bg-danger/10 text-danger text-[10px] font-bold rounded hover:bg-danger/20">
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
                className="w-full btn-primary text-xs font-bold py-2 shadow-sm"
              >
                {savingSettings ? 'Saving Configuration...' : 'Update Settings'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Manual Reassign Leads Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface border border-border w-full max-w-sm rounded-xl p-5 shadow-float text-xs">
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
                  className="btn-secondary py-1.5 px-3"
                  disabled={reassigning}
                >
                  Cancel
                </button>
                <button
                  onClick={handleReassignLeads}
                  className="btn-primary py-1.5 px-4 font-bold disabled:opacity-50"
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
