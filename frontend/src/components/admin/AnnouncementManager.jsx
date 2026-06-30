import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const AnnouncementManager = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'scrolling',
    content: '',
    isActive: true,
  });

  const types = ['popup', 'scrolling', 'header', 'system'];

  useEffect(() => {
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const res = await api.get('/api/announcements/all');
      setAnnouncements(res.data.announcements);
    } catch (error) {
      console.error('Failed to load announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/announcements', formData);
      setShowForm(false);
      setFormData({ type: 'scrolling', content: '', isActive: true });
      loadAnnouncements();
    } catch (error) {
      console.error('Failed to create announcement:', error);
    }
  };

  const handleToggleActive = async (announcement) => {
    try {
      await api.patch(`/api/announcements/${announcement._id}`, { isActive: !announcement.isActive });
      loadAnnouncements();
    } catch (error) {
      console.error('Failed to toggle announcement:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      loadAnnouncements();
    } catch (error) {
      console.error('Failed to delete announcement:', error);
    }
  };

  const getTypeBadge = (type) => {
    const classes = {
      popup: 'bg-info/10 text-info',
      scrolling: 'bg-success/10 text-success',
      header: 'bg-warning/10 text-warning',
      system: 'bg-primary-light text-primary',
    };
    return classes[type] || 'bg-bg text-text-2';
  };

  return (
    <div className="bg-surface rounded-lg shadow-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-text-1">Announcements</h2>
          <p className="text-sm text-text-2">Manage announcements and notifications</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary text-sm"
        >
          + Add Announcement
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-border bg-bg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="input-field"
                >
                  {types.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-text-1">Active</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Content</label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={3}
                className="input-field resize-none"
                required
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm">Create</button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-border">
        {loading ? (
          <div className="p-8 text-center text-sm text-text-2">Loading...</div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-2">No announcements yet</div>
        ) : (
          announcements.map((ann) => (
            <div key={ann._id} className="flex items-center gap-4 p-4">
              <span className={`badge ${getTypeBadge(ann.type)}`}>
                {ann.type}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-1 line-clamp-2">{ann.content}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(ann)}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    ann.isActive
                      ? 'bg-success/10 text-success'
                      : 'bg-bg text-text-3'
                  }`}
                >
                  {ann.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  onClick={() => handleDelete(ann._id)}
                  className="text-xs text-danger hover:text-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AnnouncementManager;
