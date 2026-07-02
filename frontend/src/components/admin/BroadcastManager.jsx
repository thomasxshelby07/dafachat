import { useState, useEffect } from 'react';
import api from '../../hooks/api';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../context/AuthContext';

const MESSAGE_TYPES = [
  { key: 'text', label: 'Text Only' },
  { key: 'image', label: 'Image Only' },
  { key: 'text_image', label: 'Text + Image' },
  { key: 'text_button', label: 'Text + Button' },
  { key: 'text_image_button', label: 'Text + Image + Button' },
];

const BUTTON_PRESETS = [
  'Claim Bonus',
  'Get Offer',
  'Open Website',
  'Contact Support',
];

const EXPIRE_PRESETS = [
  { key: 'never', label: 'Never Expire' },
  { key: '1_day', label: '1 Day' },
  { key: '3_days', label: '3 Days' },
  { key: '7_days', label: '7 Days' },
  { key: 'custom', label: 'Custom Date' },
];

const BroadcastManager = () => {
  const { user } = useAuth();
  const { on, off } = useSocket();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [liveProgress, setLiveProgress] = useState(null);
  const [editingBroadcastId, setEditingBroadcastId] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    type: 'text',
    content: '',
    image: '',
    buttonText: 'Claim Bonus',
    buttonLink: '',
    audience: {
      type: 'all',
      count: 0,
      tags: [],
      status: [],
      country: '',
      leadSource: '',
      assignedAgent: '',
      lastActiveDays: '',
      regStartDate: '',
      regEndDate: '',
      isVIP: false,
    },
    expiry: {
      type: 'never',
      date: '',
    },
    schedule: {
      type: 'now',
      time: '',
    }
  });

  const [activeFilters, setActiveFilters] = useState({
    tags: false,
    status: false,
    country: false,
    leadSource: false,
    assignedAgent: false,
    lastActive: false,
    regDate: false,
    vip: false,
  });

  const [availableAgents, setAvailableAgents] = useState([]);

  // Fetch broadcasts & agents
  const loadData = async () => {
    try {
      const [broadcastsRes, agentsRes] = await Promise.all([
        api.get('/api/broadcasts'),
        api.get('/api/users/agents')
      ]);
      setBroadcasts(broadcastsRes.data.broadcasts || []);
      setAvailableAgents(agentsRes.data.agents || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time progress updates via Socket.io
    const handleProgress = (data) => {
      setLiveProgress(data);
      if (data.status === 'completed') {
        setTimeout(() => setLiveProgress(null), 5000);
        loadData();
      }
    };

    on('broadcast_progress', handleProgress);

    return () => {
      off('broadcast_progress', handleProgress);
    };
  }, [on, off]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/api/messages/media', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData(prev => ({ ...prev, image: res.data.mediaUrl }));
    } catch (err) {
      alert('Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    setCreating(true);

    // Clean up filters data before payload submission
    const cleanAudience = { ...formData.audience };
    if (cleanAudience.type !== 'filters') {
      delete cleanAudience.tags;
      delete cleanAudience.status;
      delete cleanAudience.country;
      delete cleanAudience.leadSource;
      delete cleanAudience.assignedAgent;
      delete cleanAudience.lastActiveDays;
      delete cleanAudience.regStartDate;
      delete cleanAudience.regEndDate;
      delete cleanAudience.isVIP;
    } else {
      if (!activeFilters.tags) delete cleanAudience.tags;
      if (!activeFilters.status) delete cleanAudience.status;
      if (!activeFilters.country) delete cleanAudience.country;
      if (!activeFilters.leadSource) delete cleanAudience.leadSource;
      if (!activeFilters.assignedAgent) delete cleanAudience.assignedAgent;
      if (!activeFilters.lastActive) delete cleanAudience.lastActiveDays;
      if (!activeFilters.regDate) {
        delete cleanAudience.regStartDate;
        delete cleanAudience.regEndDate;
      }
      if (!activeFilters.vip) delete cleanAudience.isVIP;
    }

    try {
      const payload = {
        ...formData,
        audience: cleanAudience,
      };

      if (editingBroadcastId) {
        await api.patch(`/api/broadcasts/${editingBroadcastId}`, payload);
        alert('Broadcast updated successfully!');
      } else {
        await api.post('/api/broadcasts', payload);
        alert(formData.schedule.type === 'now' ? 'Broadcast sending started!' : 'Broadcast scheduled successfully!');
      }
      
      setFormData({
        title: '',
        type: 'text',
        content: '',
        image: '',
        buttonText: 'Claim Bonus',
        buttonLink: '',
        audience: {
          type: 'all',
          count: 0,
          tags: [],
          status: [],
          country: '',
          leadSource: '',
          assignedAgent: '',
          lastActiveDays: '',
          regStartDate: '',
          regEndDate: '',
          isVIP: false,
        },
        expiry: {
          type: 'never',
          date: '',
        },
        schedule: {
          type: 'now',
          time: '',
        }
      });
      setActiveFilters({
        tags: false,
        status: false,
        country: false,
        leadSource: false,
        assignedAgent: false,
        lastActive: false,
        regDate: false,
        vip: false,
      });
      setEditingBroadcastId(null);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to save broadcast');
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (b) => {
    setEditingBroadcastId(b._id);
    setFormData({
      title: b.title,
      type: b.type,
      content: b.content || '',
      image: b.image || '',
      buttonText: b.buttonText || 'Claim Bonus',
      buttonLink: b.buttonLink || '',
      audience: {
        type: b.audience?.type || 'all',
        count: b.audience?.count || 0,
        tags: b.audience?.tags || [],
        status: b.audience?.status || [],
        country: b.audience?.country || '',
        leadSource: b.audience?.leadSource || '',
        assignedAgent: b.audience?.assignedAgent || '',
        lastActiveDays: b.audience?.lastActiveDays || '',
        regStartDate: b.audience?.regStartDate ? new Date(b.audience.regStartDate).toISOString().split('T')[0] : '',
        regEndDate: b.audience?.regEndDate ? new Date(b.audience.regEndDate).toISOString().split('T')[0] : '',
        isVIP: b.audience?.isVIP || false,
      },
      expiry: {
        type: b.expiry?.type || 'never',
        date: b.expiry?.date ? new Date(b.expiry.date).toISOString().slice(0, 16) : '',
      },
      schedule: {
        type: b.schedule?.type || 'now',
        time: b.schedule?.time ? new Date(b.schedule.time).toISOString().slice(0, 16) : '',
      }
    });

    setActiveFilters({
      tags: !!b.audience?.tags?.length,
      status: !!b.audience?.status?.length,
      country: !!b.audience?.country,
      leadSource: !!b.audience?.leadSource,
      assignedAgent: !!b.audience?.assignedAgent,
      lastActive: !!b.audience?.lastActiveDays,
      regDate: !!(b.audience?.regStartDate || b.audience?.regEndDate),
      vip: b.audience?.isVIP !== undefined,
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingBroadcastId(null);
    setFormData({
      title: '',
      type: 'text',
      content: '',
      image: '',
      buttonText: 'Claim Bonus',
      buttonLink: '',
      audience: {
        type: 'all',
        count: 0,
        tags: [],
        status: [],
        country: '',
        leadSource: '',
        assignedAgent: '',
        lastActiveDays: '',
        regStartDate: '',
        regEndDate: '',
        isVIP: false,
      },
      expiry: {
        type: 'never',
        date: '',
      },
      schedule: {
        type: 'now',
        time: '',
      }
    });
    setActiveFilters({
      tags: false,
      status: false,
      country: false,
      leadSource: false,
      assignedAgent: false,
      lastActive: false,
      regDate: false,
      vip: false,
    });
  };

  const handleDeleteBroadcast = async (broadcastId) => {
    if (!window.confirm('Are you sure you want to delete this broadcast? It will be removed from customer feeds.')) return;
    try {
      await api.delete(`/api/broadcasts/${broadcastId}`);
      alert('Broadcast deleted successfully');
      loadData();
    } catch (error) {
      alert('Failed to delete broadcast');
    }
  };

  const getCTR = (b) => {
    if (!b.analytics.totalSent) return '0%';
    const ctr = (b.analytics.buttonClicked / b.analytics.totalSent) * 100;
    return `${ctr.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      {/* Live Sending Progress Alert Bar */}
      {liveProgress && (
        <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl shadow-sm text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-primary flex items-center gap-1.5 animate-pulse">
              <span className="w-2.5 h-2.5 bg-primary rounded-full" />
              {liveProgress.status === 'completed' ? 'Broadcast Completed!' : 'Sending Broadcast...'}
            </span>
            <span className="font-mono font-bold text-text-2">
              {liveProgress.progress.delivered + liveProgress.progress.failed} / {liveProgress.progress.totalSelected} Recipient Sessions
            </span>
          </div>

          <div className="w-full h-2.5 bg-bg border border-border rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: `${
                  ((liveProgress.progress.delivered + liveProgress.progress.failed) /
                    liveProgress.progress.totalSelected) *
                  100
                }%`,
              }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 font-semibold text-text-2">
            <div>Total Selected: <b className="text-text-1">{liveProgress.progress.totalSelected}</b></div>
            <div>Pending: <b className="text-warning">{liveProgress.progress.pending}</b></div>
            <div>Sending: <b className="text-primary">{liveProgress.progress.sending}</b></div>
            <div>Delivered: <b className="text-success">{liveProgress.progress.delivered}</b></div>
            <div>Failed: <b className="text-danger">{liveProgress.progress.failed}</b></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Creation Form (Left 2 cols) */}
        <div className="xl:col-span-2 bg-surface rounded-xl border border-border p-5 shadow-sm text-xs space-y-4">
          <h3 className="text-sm font-bold text-text-1">Create Targeted Customer Broadcast</h3>

          <form onSubmit={handleCreateBroadcast} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-text-2 mb-1.5">Broadcast Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Deposit Bonanza Bonus 15%"
                  className="input-field font-semibold text-text-1"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-text-2 mb-1.5">Message Layout Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="input-field"
                >
                  {MESSAGE_TYPES.map(t => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dynamic Layout-Dependent Input fields */}
            {(formData.type.includes('text')) && (
              <div>
                <label className="block font-medium text-text-2 mb-1.5">Content Text / Description</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Type your message description here..."
                  className="input-field h-20"
                  required
                />
              </div>
            )}

            {(formData.type.includes('image')) && (
              <div>
                <label className="block font-medium text-text-2 mb-1.5">
                  Banner Image (URL or Upload)
                  <span className="text-[10px] text-text-3 font-normal block mt-0.5">Recommended size: 600x200 to 800x250 pixels (3:1 or 4:1 ratio)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.image}
                    onChange={(e) => setFormData(prev => ({ ...prev, image: e.target.value }))}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="input-field flex-1"
                    required
                  />
                  <label className="btn-secondary flex items-center justify-center cursor-pointer px-4 select-none shrink-0 font-bold">
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {(formData.type.includes('button')) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-text-2 mb-1.5">Button Label Text</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={formData.buttonText}
                      onChange={(e) => setFormData(prev => ({ ...prev, buttonText: e.target.value }))}
                      placeholder="e.g. Claim Now"
                      className="input-field"
                      required
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {BUTTON_PRESETS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, buttonText: p }))}
                          className={`px-2 py-1 rounded border text-[10px] font-bold tracking-wide uppercase transition-all ${
                            formData.buttonText === p ? 'bg-primary text-white border-primary' : 'bg-bg text-text-2 border-border'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-text-2 mb-1.5">Button Destination Link</label>
                  <input
                    type="url"
                    value={formData.buttonLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, buttonLink: e.target.value }))}
                    placeholder="https://example.com/promo-offers"
                    className="input-field"
                    required
                  />
                </div>
              </div>
            )}

            {/* Target Audience limits */}
            <div className="border border-border rounded-xl p-4 bg-bg/20 space-y-4">
              <h4 className="font-bold text-text-1">Target Audience Selection</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-text-2 mb-1.5">Target Mode</label>
                  <select
                    value={formData.audience.type}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      audience: { ...prev.audience, type: e.target.value }
                    }))}
                    className="input-field"
                  >
                    <option value="all">Send to All Customers</option>
                    <option value="count">Count Constraint (Select First N)</option>
                    <option value="filters">Custom Targeting Filters</option>
                  </select>
                </div>

                {formData.audience.type === 'count' && (
                  <div>
                    <label className="block font-medium text-text-2 mb-1.5">Select Customer Count limit</label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="number"
                        min="1"
                        value={formData.audience.count}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          audience: { ...prev.audience, count: parseInt(e.target.value) || 0 }
                        }))}
                        className="input-field"
                        required
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {[10, 50, 100, 200, 300].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              audience: { ...prev.audience, count: c }
                            }))}
                            className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                              formData.audience.count === c ? 'bg-primary text-white border-primary' : 'bg-bg text-text-2 border-border'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Filtering logic rendering */}
              {formData.audience.type === 'filters' && (
                <div className="space-y-3 pt-2">
                  <span className="block font-bold text-text-2">Apply Target Criteria:</span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.keys(activeFilters).map(k => (
                      <label key={k} className="flex items-center gap-2 border border-border p-2 bg-surface cursor-pointer rounded hover:bg-bg/10">
                        <input
                          type="checkbox"
                          checked={activeFilters[k]}
                          onChange={(e) => setActiveFilters(prev => ({ ...prev, [k]: e.target.checked }))}
                          className="rounded text-primary focus:ring-primary border-border"
                        />
                        <span className="font-medium text-text-2 uppercase text-[10px]">
                          {k.replace('regDate', 'Reg Date').replace('assignedAgent', 'Agent').replace('leadSource', 'Lead Source')}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {activeFilters.tags && (
                      <div>
                        <label className="block text-text-2 mb-1.5 font-medium">Filter by Tags (comma separated)</label>
                        <input
                          type="text"
                          placeholder="e.g. VIP, high-depositor"
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            audience: {
                              ...prev.audience,
                              tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                            }
                          }))}
                          className="input-field"
                        />
                      </div>
                    )}

                    {activeFilters.status && (
                      <div>
                        <label className="block text-text-2 mb-1.5 font-medium">Filter by Status</label>
                        <select
                          multiple
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            audience: {
                              ...prev.audience,
                              status: Array.from(e.target.selectedOptions, o => o.value)
                            }
                          }))}
                          className="input-field h-16"
                        >
                          {['new', 'assigned', 'in_progress', 'converted', 'closed'].map(s => (
                            <option key={s} value={s}>{s.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {activeFilters.country && (
                      <div>
                        <label className="block text-text-2 mb-1.5 font-medium">Filter by Country</label>
                        <input
                          type="text"
                          placeholder="e.g. India"
                          value={formData.audience.country}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            audience: { ...prev.audience, country: e.target.value }
                          }))}
                          className="input-field"
                        />
                      </div>
                    )}

                    {activeFilters.leadSource && (
                      <div>
                        <label className="block text-text-2 mb-1.5 font-medium">Filter by Lead Source</label>
                        <input
                          type="text"
                          placeholder="e.g. Telegram Channel"
                          value={formData.audience.leadSource}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            audience: { ...prev.audience, leadSource: e.target.value }
                          }))}
                          className="input-field"
                        />
                      </div>
                    )}

                    {activeFilters.assignedAgent && (
                      <div>
                        <label className="block text-text-2 mb-1.5 font-medium">Filter by Assigned Agent</label>
                        <select
                          value={formData.audience.assignedAgent}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            audience: { ...prev.audience, assignedAgent: e.target.value }
                          }))}
                          className="input-field"
                        >
                          <option value="">-- Choose Agent --</option>
                          {availableAgents.map(a => (
                            <option key={a._id} value={a._id}>{a.fullName}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {activeFilters.lastActive && (
                      <div>
                        <label className="block text-text-2 mb-1.5 font-medium">Last Active (Within Days)</label>
                        <input
                          type="number"
                          placeholder="e.g. 7"
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            audience: { ...prev.audience, lastActiveDays: parseInt(e.target.value) || undefined }
                          }))}
                          className="input-field"
                        />
                      </div>
                    )}

                    {activeFilters.regDate && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-text-2 mb-1.5 font-medium">Reg Start</label>
                          <input
                            type="date"
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              audience: { ...prev.audience, regStartDate: e.target.value }
                            }))}
                            className="input-field"
                          />
                        </div>
                        <div>
                          <label className="block text-text-2 mb-1.5 font-medium">Reg End</label>
                          <input
                            type="date"
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              audience: { ...prev.audience, regEndDate: e.target.value }
                            }))}
                            className="input-field"
                          />
                        </div>
                      </div>
                    )}

                    {activeFilters.vip && (
                      <div>
                        <label className="block text-text-2 mb-1.5 font-medium">VIP User Target</label>
                        <select
                          value={formData.audience.isVIP ? 'vip' : 'normal'}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            audience: { ...prev.audience, isVIP: e.target.value === 'vip' }
                          }))}
                          className="input-field"
                        >
                          <option value="normal">Normal Users</option>
                          <option value="vip">VIP Users only</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Expiry limits and Scheduling options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-text-2 mb-1.5">Card Expiration</label>
                <div className="flex flex-col gap-2">
                  <select
                    value={formData.expiry.type}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      expiry: { ...prev.expiry, type: e.target.value }
                    }))}
                    className="input-field"
                  >
                    {EXPIRE_PRESETS.map(p => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                  {formData.expiry.type === 'custom' && (
                    <input
                      type="datetime-local"
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        expiry: { ...prev.expiry, date: e.target.value }
                      }))}
                      className="input-field"
                      required
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-medium text-text-2 mb-1.5">Scheduling options</label>
                <div className="flex flex-col gap-2">
                  <select
                    value={formData.schedule.type}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, type: e.target.value }
                    }))}
                    className="input-field"
                  >
                    <option value="now">Send Immediately (Send Now)</option>
                    <option value="later">Release later (Schedule Later)</option>
                  </select>
                  {formData.schedule.type === 'later' && (
                    <input
                      type="datetime-local"
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, time: e.target.value }
                      }))}
                      className="input-field"
                      required
                    />
                  )}
                </div>
              </div>
            </div>

            {editingBroadcastId ? (
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || uploadingImage}
                  className="btn-primary flex-1 py-2.5 font-bold shadow text-xs"
                >
                  {creating ? 'Saving updates...' : '💾 Save Updates'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="btn-secondary py-2.5 px-4 text-xs font-bold"
                >
                  Cancel Edit
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={creating || uploadingImage}
                className="btn-primary w-full py-2.5 font-bold shadow text-xs"
              >
                {creating ? 'Processing delivery parameters...' : formData.schedule.type === 'now' ? '🚀 Send Broadcast Now' : '📅 Schedule Broadcast'}
              </button>
            )}
          </form>
        </div>

        {/* Live Preview and History Layout (Right 1 col) */}
        <div className="space-y-6">
          {/* Card Live Preview Container */}
          <div className="bg-surface rounded-xl border border-border p-4 shadow-sm space-y-3">
            <h4 className="font-bold text-text-1 text-xs">Customer UI Card Live Preview</h4>
            <div className="p-4 bg-bg rounded-lg flex items-center justify-center border border-border">
              {/* Card wrapper */}
              <div className="bg-surface border border-border rounded-none w-full max-w-[280px] shadow-sm overflow-hidden flex flex-col hover:shadow-card transition-all">
                {formData.type.includes('image') && formData.image && (
                  <img
                    src={formData.image}
                    alt="Preview"
                    className="w-full h-32 object-cover border-b border-border"
                  />
                )}
                <div className="p-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h5 className="font-bold text-text-1 text-xs mb-1.5 uppercase flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-danger text-white rounded text-[8px] font-extrabold animate-pulse">NEW</span>
                      {formData.title || 'IPL Bonus Campaign'}
                    </h5>
                    {formData.type.includes('text') && formData.content && (
                      <p className="text-[10px] text-text-2 line-clamp-3 leading-relaxed">
                        {formData.content}
                      </p>
                    )}
                  </div>

                  {formData.type.includes('button') && formData.buttonText && (
                    <button
                      type="button"
                      className="btn-primary w-full py-1.5 mt-3 text-[10px] font-extrabold uppercase tracking-wider rounded-none"
                    >
                      {formData.buttonText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Broadcast Logs/History List */}
          <div className="bg-surface rounded-xl border border-border p-4 shadow-sm overflow-hidden">
            <h4 className="font-bold text-text-1 text-xs mb-3">Broadcast History Logs</h4>
            
            {loading ? (
              <div className="py-8 text-center text-text-3">Loading history...</div>
            ) : broadcasts.length === 0 ? (
              <div className="py-8 text-center text-text-3">No past broadcasts found</div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto divide-y divide-border">
                {broadcasts.map(b => (
                  <div key={b._id} className="pt-3 first:pt-0">
                    <div className="flex items-center justify-between font-bold text-text-1">
                      <span className="truncate pr-2 font-bold">{b.title}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wide border ${
                        b.status === 'completed' ? 'bg-success/10 text-success border-success/20' :
                        b.status === 'sending' ? 'bg-primary/10 text-primary border-primary/20 animate-pulse' :
                        'bg-warning/10 text-warning border-warning/20'
                      }`}>
                        {b.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-text-3 mt-1.5 font-medium">
                      <div>Recipients: <b className="text-text-2">{b.recipients.length}</b></div>
                      <div>CTR: <b className="text-text-2">{getCTR(b)}</b></div>
                      <div>Views: <b className="text-success">{b.analytics.viewed}</b></div>
                      <div>Clicks: <b className="text-primary">{b.analytics.buttonClicked}</b></div>
                    </div>

                    <div className="text-[9px] text-text-3 mt-1.5 flex justify-between items-center">
                      <span>By: {b.createdBy?.fullName || 'System'} | {new Date(b.createdAt).toLocaleDateString()}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(b)}
                          className="text-primary hover:underline font-bold"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBroadcast(b._id)}
                          className="text-danger hover:underline font-bold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastManager;
