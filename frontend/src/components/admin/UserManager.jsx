import { useState, useEffect } from 'react';
import api from '../../hooks/api';
import { useAuth } from '../../context/AuthContext';

const ISSUE_TYPES = [
  { key: 'deposit', label: 'Deposit Issues' },
  { key: 'withdrawal', label: 'Withdrawal Issues' },
  { key: 'new_id', label: 'New ID Issues' },
  { key: 'verify_id', label: 'Verify ID Issues' },
  { key: 'other', label: 'General Issues' },
];

const UserManager = ({ initialFilter = '' }) => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', mobile: '', email: '', password: '', avatar: '' });
  const [filter, setFilter] = useState(initialFilter || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPerms, setEditingPerms] = useState(null);
  const [permForm, setPermForm] = useState({});
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    setFilter(initialFilter || '');
    setFormData({ fullName: '', mobile: '', email: '', password: '', avatar: '' });
    setShowForm(false);
    setEditingPerms(null);
    setSelectedUserIds([]);
  }, [initialFilter]);

  useEffect(() => { loadUsers(); }, [filter]);

  const loadUsers = async () => {
    setLoading(true);
    setSelectedUserIds([]);
    try {
      const params = filter ? `?role=${filter}` : '';
      const res = await api.get(`/api/users${params}`);
      setUsers(res.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCreateRole = () => {
    if (initialFilter === 'manager') return 'manager';
    if (initialFilter === 'agent') return 'agent';
    return formData.role || 'agent';
  };

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.fullName?.toLowerCase() || '').includes(q) || (u.mobile?.toLowerCase() || '').includes(q);
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const role = getCreateRole();
    try {
      const endpoint = role === 'manager' ? '/api/users/managers' : '/api/users/agents';
      await api.post(endpoint, {
        fullName: formData.fullName,
        mobile: formData.mobile,
        email: formData.email,
        password: formData.password,
        avatar: formData.avatar,
      });
      setFormData({ fullName: '', mobile: '', email: '', password: '', avatar: '' });
      setShowForm(false);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to create user');
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await api.patch(`/api/users/${user._id}`, { isActive: !user.isActive });
      loadUsers();
    } catch (error) {
      console.error('Failed to toggle user:', error);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete ${user.fullName}? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/users/${user._id}`);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleDeleteMultiple = async () => {
    if (!window.confirm(`Delete ${selectedUserIds.length} selected users? This cannot be undone.`)) return;
    try {
      await api.post('/api/users/bulk-delete', { userIds: selectedUserIds });
      setSelectedUserIds([]);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete selected users');
    }
  };

  const handleEditPerms = (user) => {
    setEditingPerms(user._id);
    setPermForm({
      canSeeLeads: user.permissions?.canSeeLeads ?? true,
      canManageUsers: user.permissions?.canManageUsers ?? false,
      canSeeAnalytics: user.permissions?.canSeeAnalytics ?? true,
      canDeleteMessages: user.permissions?.canDeleteMessages ?? true,
      canCloseChats: user.permissions?.canCloseChats ?? true,
      canAssignLeads: user.permissions?.canAssignLeads ?? false,
      canManageBranding: user.permissions?.canManageBranding ?? false,
      issueTypes: user.permissions?.issueTypes || [],
      avatar: user.avatar || '',
      team: user.team || '',
      department: user.department || '',
    });
  };

  const handleSavePerms = async (userId) => {
    try {
      await api.patch(`/api/users/${userId}/permissions`, { permissions: permForm });
      await api.patch(`/api/users/${userId}`, { avatar: permForm.avatar });
      setEditingPerms(null);
      loadUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update permissions');
    }
  };

  const toggleIssueType = (type) => {
    setPermForm(prev => ({
      ...prev,
      issueTypes: prev.issueTypes.includes(type)
        ? prev.issueTypes.filter(t => t !== type)
        : [...prev.issueTypes, type],
    }));
  };

  const getRoleBadge = (role) => {
    const classes = {
      customer: 'bg-blue-50 text-blue-600',
      agent: 'bg-primary-light text-primary',
      manager: 'bg-[#EDE9FE] text-[#6D28D9]',
      super_admin: 'bg-[#FEF3C7] text-[#92400E]',
    };
    return classes[role] || 'bg-bg text-text-2';
  };

  const createRole = getCreateRole();

  return (
    <div className="bg-surface rounded-lg shadow-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-text-1">
            {initialFilter === 'agent' ? 'Agents' : initialFilter === 'manager' ? 'Managers' : 'Users'}
          </h2>
          <p className="text-sm text-text-2">
            {initialFilter === 'agent' ? 'Manage agents & their permissions' : initialFilter === 'manager' ? 'Manage team managers' : `Manage all users${searchQuery ? ` (${filteredUsers.length} found)` : ''}`}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
          + Add {createRole === 'manager' ? 'Manager' : 'Agent'}
        </button>
      </div>

      {showForm && (
        <div className="p-4 border-b border-border bg-bg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Full Name</label>
                <input type="text" value={formData.fullName} onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))} className="input-field" placeholder="e.g. John Smith" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Mobile</label>
                <input type="tel" value={formData.mobile} onChange={(e) => setFormData(prev => ({ ...prev, mobile: e.target.value }))} placeholder="+919876543210" className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Email Address</label>
                <input type="email" value={formData.email || ''} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="e.g. name@nexgrow.in" className="input-field" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Password</label>
                <input type="password" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} className="input-field" placeholder="Min 6 characters" required minLength={6} />
              </div>
              {!initialFilter && (
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Role</label>
                  <select value={formData.role || 'agent'} onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))} className="input-field">
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Profile Picture (Avatar)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.avatar}
                    onChange={(e) => setFormData(prev => ({ ...prev, avatar: e.target.value }))}
                    placeholder="https://... or upload"
                    className="input-field flex-1"
                  />
                  <label className="btn-secondary text-sm flex items-center justify-center cursor-pointer shrink-0 select-none">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        setUploadingAvatar(true);
                        const fd = new FormData();
                        fd.append('file', file);
                        try {
                          const res = await api.post('/api/messages/media', fd, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                          });
                          setFormData(prev => ({ ...prev, avatar: res.data.mediaUrl }));
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setUploadingAvatar(false);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              {!initialFilter && (
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Role</label>
                  <select value={formData.role || 'agent'} onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))} className="input-field">
                    <option value="agent">Agent</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm">Create {createRole === 'manager' ? 'Manager' : 'Agent'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="p-4 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-xs min-w-[200px]">
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-lg text-sm placeholder-text-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {['', 'customer', 'agent', 'manager', 'super_admin'].map((role) => (
                <button key={role} onClick={() => { setFilter(role); setSelectedUserIds([]); }} className={`px-3 py-1.5 rounded-pill text-xs font-medium transition-colors ${filter === role ? 'bg-primary text-white' : 'bg-bg text-text-2 hover:text-text-1'}`}>
                  {role ? role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'All'}
                </button>
              ))}
            </div>
          </div>

          {user?.role === 'super_admin' && filteredUsers.some(u => u.role !== 'super_admin') && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-text-2 font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filteredUsers.filter(u => u.role !== 'super_admin').length > 0 && filteredUsers.filter(u => u.role !== 'super_admin').every(u => selectedUserIds.includes(u._id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const deletable = filteredUsers.filter(u => u.role !== 'super_admin').map(u => u._id);
                      setSelectedUserIds(deletable);
                    } else {
                      setSelectedUserIds([]);
                    }
                  }}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                />
                Select All
              </label>

              {selectedUserIds.length > 0 && (
                <button
                  onClick={handleDeleteMultiple}
                  className="px-3 py-1.5 bg-danger text-white rounded text-xs font-semibold hover:bg-danger/90 active:scale-95 transition-all"
                >
                  Delete Selected ({selectedUserIds.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {loading ? (
          <div className="p-8 text-center text-sm text-text-2">Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-2">No users found</div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u._id} className="p-4">
              <div className="flex items-center gap-4">
                {user?.role === 'super_admin' && u.role !== 'super_admin' && (
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(u._id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUserIds(prev => [...prev, u._id]);
                      } else {
                        setSelectedUserIds(prev => prev.filter(id => id !== u._id));
                      }
                    }}
                    className="rounded border-border text-primary focus:ring-primary h-4 w-4 mr-1 cursor-pointer select-none"
                  />
                )}
                {u.avatar ? (
                  <img src={u.avatar} alt={u.fullName} className="w-10 h-10 object-cover border border-border flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-white">{u.fullName?.charAt(0) || '?'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-text-1">{u.fullName}</h3>
                  <p className="text-xs text-text-2">{u.mobile} {u.email && `· ${u.email}`}</p>
                </div>
                <span className={`badge ${getRoleBadge(u.role)}`}>
                  {u.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
                <div className="flex items-center gap-2">
                  {u.status && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-pill ${
                      u.status === 'online' ? 'bg-success/10 text-success' :
                      u.status === 'away' ? 'bg-warning/10 text-warning' :
                      'bg-danger/10 text-danger'
                    }`}>{u.status}</span>
                  )}
                  {u.role !== 'super_admin' && (
                    <div className="flex items-center gap-1">
                      {(u.role === 'agent') && (
                        <button onClick={() => editingPerms === u._id ? setEditingPerms(null) : handleEditPerms(u)}
                          className={`px-2 py-1 rounded text-xs font-medium ${editingPerms === u._id ? 'bg-primary text-white' : 'bg-bg text-text-2 hover:text-text-1'}`}>
                          Perms
                        </button>
                      )}
                      <button onClick={() => handleToggleActive(u)} className={`px-2 py-1 rounded text-xs font-medium ${u.isActive ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </button>
                      {user?.role === 'super_admin' && (
                        <button onClick={() => handleDelete(u)} className="px-2 py-1 rounded text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20">
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {editingPerms === u._id && (
                <div className="mt-3 ml-14 p-3 bg-bg rounded-lg border border-border space-y-3">
                  <p className="text-xs font-semibold text-text-1">Profile Photo & Permissions</p>
                  
                  <div className="flex items-center gap-3">
                    {permForm.avatar ? (
                      <img src={permForm.avatar} alt="Preview" className="w-12 h-12 object-cover border border-border" />
                    ) : (
                      <div className="w-12 h-12 bg-primary-light flex items-center justify-center text-primary text-xs font-semibold">
                        No Photo
                      </div>
                    )}
                    <label className="btn-secondary text-xs px-2.5 py-1.5 cursor-pointer">
                      {uploadingAvatar ? 'Uploading...' : 'Upload Avatar'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          setUploadingAvatar(true);
                          const fd = new FormData();
                          fd.append('file', file);
                          try {
                            const res = await api.post('/api/messages/media', fd, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            setPermForm(prev => ({ ...prev, avatar: res.data.mediaUrl }));
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setUploadingAvatar(false);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {permForm.avatar && (
                      <button
                        onClick={() => setPermForm(prev => ({ ...prev, avatar: '' }))}
                        className="text-xs text-danger hover:underline"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'canSeeLeads', label: 'See Leads' },
                      { key: 'canSeeAnalytics', label: 'See Analytics' },
                      { key: 'canDeleteMessages', label: 'Delete Messages' },
                      { key: 'canCloseChats', label: 'Close Chats' },
                      { key: 'canAssignLeads', label: 'Assign Leads' },
                      { key: 'canManageBranding', label: 'Manage Branding' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={permForm[key] || false} onChange={(e) => setPermForm(prev => ({ ...prev, [key]: e.target.checked }))} className="rounded border-border text-primary focus:ring-primary" />
                        <span className="text-xs text-text-2">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                    <div>
                      <label className="block text-[10px] font-semibold text-text-2 mb-1">Team</label>
                      <input
                        type="text"
                        value={permForm.team || ''}
                        onChange={(e) => setPermForm(prev => ({ ...prev, team: e.target.value }))}
                        placeholder="e.g. Alpha"
                        className="w-full px-2 py-1 bg-surface border border-border rounded text-xs text-text-1 focus:outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-text-2 mb-1">Department</label>
                      <input
                        type="text"
                        value={permForm.department || ''}
                        onChange={(e) => setPermForm(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="e.g. VIP Care"
                        className="w-full px-2 py-1 bg-surface border border-border rounded text-xs text-text-1 focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-2 mb-1.5">Handle Issue Types</p>
                    <div className="flex gap-2">
                      {ISSUE_TYPES.map(({ key, label }) => (
                        <button key={key} onClick={() => toggleIssueType(key)} className={`px-2 py-1 rounded text-xs font-medium transition-colors ${permForm.issueTypes?.includes(key) ? 'bg-primary text-white' : 'bg-surface border border-border text-text-2 hover:text-text-1'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleSavePerms(u._id)} className="btn-primary text-xs">Save</button>
                    <button onClick={() => setEditingPerms(null)} className="btn-secondary text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserManager;
