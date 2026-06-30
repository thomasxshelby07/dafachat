import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const AnalyticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      const [statsRes, reportsRes] = await Promise.all([
        api.get('/api/analytics/overview'),
        api.get('/api/analytics/reports'),
      ]);
      setStats(statsRes.data);
      setReports(reportsRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Customers', value: stats?.totalCustomers || 0, color: 'text-primary' },
    { label: 'Online Now', value: stats?.onlineNow || 0, color: 'text-success' },
    { label: 'Active Chats', value: stats?.activeChats || 0, color: 'text-info' },
    { label: 'Waiting Queue', value: stats?.waitingQueue || 0, color: 'text-warning' },
  ];

  const todayCards = [
    { label: "Today's Registrations", value: stats?.todayRegistrations || 0 },
    { label: "Today's Conversions", value: stats?.todayConversions || 0 },
    { label: 'Avg. Response Time', value: stats?.avgResponseTime || '0m 0s' },
    { label: 'Available Agents', value: stats?.availableAgents || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-1">Live Overview</h2>
        <button onClick={loadAnalytics} className="text-sm text-primary hover:text-primary-hover">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-surface rounded-lg shadow-card p-4">
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-text-2 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {todayCards.map((card) => (
          <div key={card.label} className="bg-surface rounded-lg shadow-card p-4">
            <p className="text-lg font-bold text-text-1">{card.value}</p>
            <p className="text-xs text-text-2 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface rounded-lg shadow-card p-4">
          <h3 className="text-sm font-semibold text-text-1 mb-4">Daily Registrations (Last 30 Days)</h3>
          <div className="h-40 flex items-end gap-1">
            {reports?.dailyRegistrations?.slice(-30).map((day, idx) => {
              const maxCount = Math.max(...(reports.dailyRegistrations?.map(d => d.count) || [1]));
              const height = (day.count / maxCount) * 100;
              return (
                <div
                  key={day._id}
                  className="flex-1 bg-primary rounded-t"
                  style={{ height: `${Math.max(height, 4)}%` }}
                  title={`${day._id}: ${day.count}`}
                />
              );
            })}
            {(!reports?.dailyRegistrations || reports.dailyRegistrations.length === 0) && (
              <div className="w-full text-center text-sm text-text-3 py-8">No data yet</div>
            )}
          </div>
        </div>

        <div className="bg-surface rounded-lg shadow-card p-4">
          <h3 className="text-sm font-semibold text-text-1 mb-4">Lead Status Breakdown</h3>
          <div className="space-y-3">
            {reports?.leadStatusBreakdown?.map((item) => {
              const total = reports.leadStatusBreakdown.reduce((sum, i) => sum + i.count, 0);
              const percentage = total > 0 ? (item.count / total) * 100 : 0;
              const colors = {
                new: 'bg-info',
                assigned: 'bg-[#6D28D9]',
                in_progress: 'bg-warning',
                follow_up: 'bg-[#C2410C]',
                interested: 'bg-[#0F766E]',
                converted: 'bg-success',
                closed: 'bg-text-3',
                deposit_done: 'bg-[#10B981]',
                withdrawal_done: 'bg-[#3B82F6]',
                issue_solved: 'bg-[#14B8A6]',
                issue_not_solved: 'bg-[#F43F5E]',
              };
              return (
                <div key={item._id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-text-1 capitalize">{item._id?.replace('_', ' ')}</span>
                    <span className="text-xs text-text-2">{item.count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden">
                    <div
                      className={`h-full ${colors[item._id] || 'bg-primary'} rounded-full`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!reports?.leadStatusBreakdown || reports.leadStatusBreakdown.length === 0) && (
              <div className="text-center text-sm text-text-3 py-4">No data yet</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface rounded-lg shadow-card p-4">
        <h3 className="text-sm font-semibold text-text-1 mb-4">Agent Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-xs font-semibold text-text-2">Agent</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-text-2">Total Chats</th>
              </tr>
            </thead>
            <tbody>
              {reports?.agentPerformance?.map((agent) => (
                <tr key={agent._id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-white">
                          {agent.fullName?.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm text-text-1">{agent.fullName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-sm text-text-2">{agent.totalChats}</td>
                </tr>
              ))}
              {(!reports?.agentPerformance || reports.agentPerformance.length === 0) && (
                <tr>
                  <td colSpan="2" className="px-3 py-4 text-center text-sm text-text-3">No data yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
