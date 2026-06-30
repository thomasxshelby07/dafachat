import { useState, useEffect } from 'react';
import api from '../../hooks/api';
import TemplateManagerModal from './TemplateManagerModal';

const QuickReplyPicker = ({ onSelect, onClose }) => {
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/api/templates');
      setTemplates(res.data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.body || '').toLowerCase().includes(search.toLowerCase())
  );

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {});

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface border border-border rounded-lg shadow-float max-h-[300px] flex flex-col z-20">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10 text-sm"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-text-2">Loading...</div>
        ) : Object.keys(groupedTemplates).length === 0 ? (
          <div className="p-4 text-center text-sm text-text-2">No templates found</div>
        ) : (
          Object.entries(groupedTemplates).map(([category, items]) => (
            <div key={category}>
              <div className="px-3 py-1.5 bg-bg">
                <span className="text-[11px] font-semibold text-text-2 uppercase">{category}</span>
              </div>
              {items.map((template) => (
                <button
                  key={template._id}
                  onClick={() => {
                    onSelect(template);
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-bg transition-colors border-b border-border last:border-0"
                >
                  <p className="text-sm font-medium text-text-1 flex items-center gap-1.5">
                    <span>{template.title}</span>
                    <span className={`px-1 text-[8px] rounded uppercase font-semibold ${template.type === 'image' ? 'bg-info/10 text-info border border-info/20' : 'bg-success/10 text-success border border-success/20'}`}>
                      {template.type || 'text'}
                    </span>
                  </p>
                  {template.type === 'image' ? (
                    <div className="mt-1 flex items-center gap-1.5">
                      <img src={template.mediaUrl} alt="Quick Reply" className="w-8 h-8 object-cover rounded border bg-white" />
                      <span className="text-[11px] text-text-2 font-medium">Image Reply</span>
                    </div>
                  ) : (
                    <p className="text-xs text-text-2 line-clamp-2 mt-0.5">{template.body}</p>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      <div className="flex border-t border-border bg-bg/25">
        <button
          onClick={() => setShowManager(true)}
          className="flex-1 p-2 text-center text-xs text-primary font-semibold hover:bg-bg/50 border-r border-border transition-colors"
        >
          Manage Quick Replies
        </button>
        <button
          onClick={onClose}
          className="flex-1 p-2 text-center text-xs text-text-3 hover:text-text-1 transition-colors"
        >
          Close
        </button>
      </div>

      {showManager && (
        <TemplateManagerModal
          onClose={() => setShowManager(false)}
          onRefresh={loadTemplates}
        />
      )}
    </div>
  );
};

export default QuickReplyPicker;
