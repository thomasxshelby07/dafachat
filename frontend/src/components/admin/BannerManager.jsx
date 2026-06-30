import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const BannerManager = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'promotional',
    imageUrl: '',
    bgColor: '#635BFF',
    isActive: true,
    order: 0,
  });

  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    try {
      const res = await api.get('/api/banners/all');
      setBanners(res.data.banners);
    } catch (error) {
      console.error('Failed to load banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Supported formats check
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Invalid image format. Supported formats: JPG, PNG, WEBP, GIF.');
      return;
    }

    // Size limit check (max 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File is too large. Max size allowed is 2MB.');
      return;
    }

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      const res = await api.post('/api/messages/media', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData(prev => ({ ...prev, imageUrl: res.data.mediaUrl }));
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBanner) {
        await api.patch(`/api/banners/${editingBanner._id}`, formData);
      } else {
        await api.post('/api/banners', formData);
      }
      setShowForm(false);
      setEditingBanner(null);
      setFormData({ title: '', description: '', type: 'promotional', imageUrl: '', bgColor: '#635BFF', isActive: true, order: 0 });
      loadBanners();
    } catch (error) {
      console.error('Failed to save banner:', error);
      alert(error.response?.data?.error || 'Failed to save banner');
    }
  };

  const handleEdit = (banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      description: banner.description || '',
      type: banner.type || 'promotional',
      imageUrl: banner.imageUrl || '',
      bgColor: banner.bgColor || '#635BFF',
      isActive: banner.isActive,
      order: banner.order || 0,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this banner?')) return;
    try {
      await api.delete(`/api/banners/${id}`);
      loadBanners();
    } catch (error) {
      console.error('Failed to delete banner:', error);
    }
  };

  const handleToggleActive = async (banner) => {
    try {
      await api.patch(`/api/banners/${banner._id}`, { isActive: !banner.isActive });
      loadBanners();
    } catch (error) {
      console.error('Failed to toggle banner:', error);
    }
  };

  const types = ['promotional', 'offer', 'festival', 'maintenance'];

  return (
    <div className="bg-surface rounded-lg shadow-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-text-1">Banners</h2>
          <p className="text-sm text-text-2">Manage promotional banners for customer home</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingBanner(null); setFormData({ title: '', description: '', type: 'promotional', imageUrl: '', bgColor: '#635BFF', isActive: true, order: 0 }); }}
          className="btn-primary text-sm"
        >
          + Add Banner
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-border bg-bg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Weekend Bonus Offer"
                  required
                />
              </div>
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
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Short description for the banner"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5 flex items-center justify-between">
                <span>Banner Image</span>
                <span className="text-xs text-text-3 font-normal">Recommended dimensions: 1920×600 px (max 2MB, JPG/PNG/WEBP)</span>
              </label>
              <div className="flex items-center gap-3">
                <label className="flex-1 cursor-pointer">
                  <div className="input-field flex items-center justify-center gap-2 hover:bg-bg transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-text-2">
                      {uploading ? 'Uploading...' : 'Click to upload image'}
                    </span>
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>
              {formData.imageUrl && (
                <div className="mt-2 relative inline-block">
                  <img src={formData.imageUrl} alt="Preview" className="h-20 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-danger rounded-full text-white flex items-center justify-center text-xs"
                  >
                    x
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Background Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={formData.bgColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, bgColor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={formData.bgColor}
                  onChange={(e) => setFormData(prev => ({ ...prev, bgColor: e.target.value }))}
                  className="input-field w-32"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Display Order</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="input-field"
                  min="0"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm text-text-1">Active</label>
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={uploading}>
                {editingBanner ? 'Update' : 'Create'} Banner
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingBanner(null); }}
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
        ) : banners.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-2">No banners yet. Create one to show on customer home.</div>
        ) : (
          banners.map((banner) => (
            <div key={banner._id} className="flex items-center gap-4 p-4">
              <div className="w-24 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: banner.bgColor || '#635BFF' }}>
                {banner.imageUrl ? (
                  <img src={banner.imageUrl} alt={banner.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-xs font-medium">{banner.title}</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-text-1 truncate">{banner.title}</h3>
                {banner.description && <p className="text-xs text-text-2 truncate">{banner.description}</p>}
                <p className="text-xs text-text-3">{banner.type} · Order: {banner.order}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(banner)}
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    banner.isActive
                      ? 'bg-success/10 text-success'
                      : 'bg-bg text-text-3'
                  }`}
                >
                  {banner.isActive ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => handleEdit(banner)} className="text-xs text-primary hover:text-primary-hover">Edit</button>
                <button onClick={() => handleDelete(banner._id)} className="text-xs text-danger hover:text-danger">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BannerManager;
