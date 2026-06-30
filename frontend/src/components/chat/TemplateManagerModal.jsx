import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const TemplateManagerModal = ({ onClose, onRefresh }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('text');
  const [body, setBody] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaPublicId, setMediaPublicId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/templates');
      setTemplates(res.data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setTitle('');
    setCategory('General');
    setType('text');
    setBody('');
    setMediaUrl('');
    setMediaPublicId('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setTitle(template.title);
    setCategory(template.category);
    setType(template.type || 'text');
    setBody(template.body || '');
    setMediaUrl(template.mediaUrl || '');
    setMediaPublicId(template.mediaPublicId || '');
    setIsFormOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/messages/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMediaUrl(res.data.mediaUrl);
      setMediaPublicId(res.data.mediaPublicId);
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim() || !category.trim()) {
      alert('Title and Category are required.');
      return;
    }
    if (type === 'text' && !body.trim()) {
      alert('Message body is required for text templates.');
      return;
    }
    if (type === 'image' && !mediaUrl) {
      alert('Please upload an image for the template.');
      return;
    }

    setSaving(true);
    const payload = {
      title: title.trim(),
      category: category.trim(),
      type,
      body: type === 'text' ? body.trim() : '',
      mediaUrl: type === 'image' ? mediaUrl : '',
      mediaPublicId: type === 'image' ? mediaPublicId : '',
    };

    try {
      if (editingTemplate) {
        await api.patch(`/api/templates/${editingTemplate._id}`, payload);
      } else {
        await api.post('/api/templates', payload);
      }
      setIsFormOpen(false);
      loadTemplates();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Failed to save template.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quick message template?')) return;

    try {
      await api.delete(`/api/templates/${id}`);
      loadTemplates();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-bold text-text-1">Manage Quick Replies</h2>
          <button onClick={onClose} className="text-text-3 hover:text-text-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {isFormOpen ? (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
            <h3 className="text-sm font-semibold text-text-1">
              {editingTemplate ? 'Edit Quick Reply' : 'Create Quick Reply'}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-text-2 mb-1">Title / Shortcut</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Greeting"
                className="input-field w-full text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-2 mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Deposit, General, Greeting"
                className="input-field w-full text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-2 mb-1.5">Template Type</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-text-1 cursor-pointer">
                  <input
                    type="radio"
                    checked={type === 'text'}
                    onChange={() => setType('text')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Text Message</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-text-1 cursor-pointer">
                  <input
                    type="radio"
                    checked={type === 'image'}
                    onChange={() => setType('image')}
                    className="text-primary focus:ring-primary"
                  />
                  <span>Image Attachment</span>
                </label>
              </div>
            </div>

            {type === 'text' ? (
              <div>
                <label className="block text-xs font-semibold text-text-2 mb-1">Message Body</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Enter the template message..."
                  className="input-field w-full text-sm min-h-[100px] resize-y"
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-text-2 mb-1">Upload Image</label>
                {mediaUrl ? (
                  <div className="border border-border rounded-lg p-2 flex items-center gap-3 bg-bg/10 mb-2">
                    <img src={mediaUrl} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-2 truncate font-semibold">Image uploaded</p>
                      <button
                        type="button"
                        onClick={() => { setMediaUrl(''); setMediaPublicId(''); }}
                        className="text-xs text-danger font-semibold mt-1"
                      >
                        Remove Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center bg-bg/5 hover:bg-bg/10 transition-colors">
                    {uploading ? (
                      <div className="text-center py-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2" />
                        <span className="text-xs text-text-3">Uploading to Cloudinary...</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-text-3 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-primary font-semibold hover:underline">Click to Upload Image</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 bg-bg text-text-2 text-sm font-semibold border border-border hover:bg-border rounded transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || saving}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold hover:bg-primary-hover rounded transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                <span>{editingTemplate ? 'Update' : 'Create'}</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="p-3 border-b border-border bg-bg/5 flex items-center justify-between">
              <span className="text-xs text-text-3 font-semibold uppercase">Existing Templates</span>
              <button
                onClick={handleOpenCreate}
                className="px-2.5 py-1.5 bg-primary text-white text-xs font-bold hover:bg-primary-hover rounded transition-all flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New template</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="text-center py-10 text-sm text-text-2">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 text-sm text-text-3 italic">No templates available. Create one to get started.</div>
              ) : (
                templates.map((template) => (
                  <div key={template._id} className="border border-border p-3 rounded-lg flex items-start justify-between bg-bg/10 hover:bg-bg/25 transition-all">
                    <div className="min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h4 className="text-sm font-bold text-text-1">{template.title}</h4>
                        <span className="px-1.5 py-0.5 text-[9px] bg-bg border border-border text-text-3 rounded uppercase font-semibold">
                          {template.category}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[9px] rounded uppercase font-semibold ${template.type === 'image' ? 'bg-info/10 text-info border border-info/20' : 'bg-success/10 text-success border border-success/20'}`}>
                          {template.type || 'text'}
                        </span>
                      </div>

                      {template.type === 'image' ? (
                        <div className="mt-1 flex items-center gap-2">
                          <img src={template.mediaUrl} alt="Quick Reply" className="w-12 h-12 object-cover rounded border bg-white" />
                          <span className="text-xs text-text-3">Image attachment</span>
                        </div>
                      ) : (
                        <p className="text-xs text-text-2 line-clamp-2">{template.body}</p>
                      )}
                    </div>

                    <div className="flex gap-1">
                      <button
                        onClick={() => handleOpenEdit(template)}
                        className="p-1.5 rounded hover:bg-bg text-text-3 hover:text-text-1"
                        title="Edit template"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(template._id)}
                        className="p-1.5 rounded hover:bg-bg text-text-3 hover:text-danger"
                        title="Delete template"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-bg border border-border text-text-2 text-sm font-semibold rounded hover:bg-border transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TemplateManagerModal;
