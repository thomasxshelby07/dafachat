import { useState, useEffect } from 'react';
import api from '../../hooks/api';
import { useAuth } from '../../context/AuthContext';

const LeadDetail = ({ leadId, onClose, onUpdate }) => {
  const { user } = useAuth();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [agents, setAgents] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');

  const statuses = [
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
    loadLead();
    loadAgents();
  }, [leadId]);

  const loadLead = async () => {
    try {
      const res = await api.get(`/api/leads/${leadId}`);
      setLead(res.data.lead);
    } catch (error) {
      console.error('Failed to load lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAgents = async () => {
    try {
      const res = await api.get('/api/users/agents');
      setAgents(res.data.agents);
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/api/leads/${leadId}/status`, { status: newStatus });
      await loadLead();
      setShowStatusPicker(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/api/leads/${leadId}/notes`, { text: noteText.trim() });
      setNoteText('');
      await loadLead();
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditNote = async (noteId) => {
    if (!editNoteText.trim()) return;
    try {
      await api.patch(`/api/leads/${leadId}/notes/${noteId}`, { text: editNoteText.trim() });
      setEditingNote(null);
      setEditNoteText('');
      await loadLead();
    } catch (error) {
      console.error('Failed to edit note:', error);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/api/leads/${leadId}/notes/${noteId}`);
      await loadLead();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleAssign = async (agentId) => {
    try {
      await api.post(`/api/leads/${leadId}/assign`, { agentId });
      await loadLead();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to assign lead:', error);
    }
  };

  const handleAddTag = async (tag) => {
    try {
      await api.post(`/api/leads/${leadId}/tags`, { tag });
      await loadLead();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tag) => {
    try {
      await api.delete(`/api/leads/${leadId}/tags/${encodeURIComponent(tag)}`);
      await loadLead();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const getStatusBadge = (status) => {
    const s = statuses.find(st => st.value === status);
    return s || statuses[0];
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="h-full flex items-center justify-center text-text-2 text-sm">
        Lead not found
      </div>
    );
  }

  const statusInfo = getStatusBadge(lead.status);
  const canEditNotes = ['agent', 'manager', 'super_admin'].includes(user?.role);

  return (
    <div className="h-full flex flex-col bg-surface">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="btn-icon text-text-1 md:hidden">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-text-1">Lead Detail</h2>
        <div className="w-11" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Customer Info */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-bold text-white">
                {lead.customerId?.fullName?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-1">{lead.customerId?.fullName}</h3>
              <p className="text-xs text-text-2">{lead.customerId?.mobile}</p>
              <p className="text-[11px] text-text-3">ID: {lead.customerId?.customerId}</p>
              {lead.customerId?.dafaxbetId && (
                <p className="text-xs font-semibold text-primary">Dafaxbet ID: {lead.customerId.dafaxbetId}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-2">
            <span>Registered: {formatDate(lead.customerId?.registrationDate)}</span>
            {lead.customerId?.lastSeen && (
              <>
                <span>·</span>
                <span>Last seen: {formatDateTime(lead.customerId?.lastSeen)}</span>
              </>
            )}
          </div>
        </div>

        {/* Lead Status */}
        <div className="p-4 border-b border-border">
          <h4 className="text-xs font-semibold text-text-2 uppercase mb-2">Lead Status</h4>
          <div className="relative">
            <button
              onClick={() => setShowStatusPicker(!showStatusPicker)}
              className={`badge ${statusInfo.class} cursor-pointer hover:opacity-80`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {statusInfo.label}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showStatusPicker && (
              <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-float z-10 py-1 min-w-[150px]">
                {statuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStatusChange(s.value)}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-bg flex items-center gap-2 ${
                      lead.status === s.value ? 'bg-primary-light' : ''
                    }`}
                  >
                    <span className={`badge ${s.class} text-[10px]`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tags Section */}
        <div className="p-4 border-b border-border">
          <h4 className="text-xs font-semibold text-text-2 uppercase mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {lead.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 bg-primary-light text-primary text-[11px] font-semibold px-2 py-0.5 rounded border border-primary/20 select-none"
              >
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="text-primary hover:text-primary-hover font-bold text-xs ml-1 focus:outline-none"
                  title="Remove tag"
                >
                  ✕
                </button>
              </span>
            ))}
            {(!lead.tags || lead.tags.length === 0) && (
              <p className="text-xs text-text-3">No tags assigned</p>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Press Enter to add tag..."
              className="input-field text-xs py-1.5 px-3 min-h-[32px] flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.target.value.trim()) {
                  handleAddTag(e.target.value.trim());
                  e.target.value = '';
                }
              }}
            />
          </div>
        </div>

        {/* Assigned Agent */}
        <div className="p-4 border-b border-border">
          <h4 className="text-xs font-semibold text-text-2 uppercase mb-2">Assigned Agent</h4>
          <div className="space-y-2">
            {lead.assignedAgent ? (
              <div className="flex items-center gap-2">
                {lead.assignedAgent.avatar ? (
                  <img src={lead.assignedAgent.avatar} alt="Avatar" className="w-8 h-8 object-cover border border-border" />
                ) : (
                  <div className="w-8 h-8 bg-primary-light flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">
                      {lead.assignedAgent.fullName?.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="text-sm text-text-1">{lead.assignedAgent.fullName}</span>
              </div>
            ) : (
              <span className="text-xs text-text-3">No agent assigned</span>
            )}
          </div>
          <div className="mt-2">
            <select
              onChange={(e) => e.target.value && handleAssign(e.target.value)}
              className="input-field text-sm w-full"
              value={lead.assignedAgent?._id || ''}
            >
              <option value="" disabled>{lead.assignedAgent ? 'Reassign Agent...' : 'Assign Agent...'}</option>
              {agents.map((agent) => (
                <option key={agent._id} value={agent._id}>{agent.fullName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Internal Notes */}
        <div className="p-4 border-b border-border">
          <h4 className="text-xs font-semibold text-text-2 uppercase mb-3">Internal Notes</h4>
          <div className="space-y-3 mb-3">
            {lead.internalNotes?.map((note) => (
              <div key={note._id} className="bg-note border-l-[3px] border-note-border rounded-r-[10px] px-3 py-2">
                {editingNote === note._id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="input-field w-full text-sm"
                      rows={2}
                    />
                    <div className="flex gap-1">
                      <button onClick={() => handleEditNote(note._id)} className="btn-primary text-xs px-2 py-1">Save</button>
                      <button onClick={() => setEditingNote(null)} className="btn-secondary text-xs px-2 py-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-text-1 italic">{note.text}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] text-text-3">
                        {note.by?.fullName || 'Unknown'} · {formatDateTime(note.date)}
                        {note.editedAt && ' (edited)'}
                      </p>
                      {canEditNotes && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setEditingNote(note._id); setEditNoteText(note.text); }}
                            className="text-[10px] text-primary hover:text-primary-hover"
                          >
                            Edit
                          </button>
                          {(note.by?._id === user?._id || user?.role === 'super_admin') && (
                            <button
                              onClick={() => handleDeleteNote(note._id)}
                              className="text-[10px] text-danger hover:text-danger"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
            {(!lead.internalNotes || lead.internalNotes.length === 0) && (
              <p className="text-xs text-text-3">No notes yet</p>
            )}
          </div>
          {canEditNotes && (
            <div className="flex gap-2">
              <input
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="input-field flex-1 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim() || addingNote}
                className="btn-primary px-3 py-2 text-sm"
              >
                {addingNote ? '...' : 'Add'}
              </button>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="p-4">
          <h4 className="text-xs font-semibold text-text-2 uppercase mb-3">Timeline</h4>
          <div className="space-y-3">
            {lead.timeline?.map((event, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                  {idx < lead.timeline.length - 1 && <div className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm text-text-1">{event.event}</p>
                  <p className="text-[11px] text-text-3 mt-0.5">
                    {formatDateTime(event.date)}
                    {event.by && ` · ${event.by.fullName || 'System'}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
