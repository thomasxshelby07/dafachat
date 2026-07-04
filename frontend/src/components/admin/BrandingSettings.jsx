import { useState, useEffect } from 'react';
import api from '../../hooks/api';

const BrandingSettings = () => {
  const [settings, setSettings] = useState({
    companyName: '',
    logo: '',
    primaryColor: '#635BFF',
    secondaryColor: '#4F46E5',
    headerBg: '#111827',
    footerText: '',
    playNowLabel: 'Play Now',
    playNowUrl: '',
    autoIdLink: '',
    siteLoginLink: '',
    playNowBgColor: '#635BFF',
    playNowTextColor: '#FFFFFF',
    authBgType: 'gradient',
    authBgColor: '#0F172A',
    authBgImage: '',
    authBgGradient: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
    authCardBg: '#1E293B',
    authCardTextColor: '#FFFFFF',
    authLinkColor: '#B91C1C',
    authBtnBgColor: '#B91C1C',
    authBtnTextColor: '#FFFFFF',
    welcome_message_deposit: '',
    welcome_message_withdrawal: '',
    welcome_message_new_id: '',
    welcome_message_verify_id: '',
    welcome_message_other: '',
    faqs: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/api/settings');
      setSettings(prev => ({
        ...prev,
        ...res.data.settings.branding,
        ...res.data.settings.homepage,
      }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch('/api/settings', { settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/api/messages/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      handleChange('logo', res.data.mediaUrl);
    } catch (error) {
      console.error('Failed to upload logo:', error);
      alert('Logo upload failed');
    }
  };

  const handleBgUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/api/messages/media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      handleChange('authBgImage', res.data.mediaUrl);
    } catch (error) {
      console.error('Failed to upload background image:', error);
      alert('Background image upload failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="bg-surface rounded-lg shadow-card p-6">
          <h2 className="text-lg font-semibold text-text-1 mb-1">Branding</h2>
          <p className="text-sm text-text-2 mb-6">Changes apply instantly across the platform.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Company Name</label>
              <input
                type="text"
                value={settings.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Company Logo</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={settings.logo}
                  onChange={(e) => handleChange('logo', e.target.value)}
                  placeholder="https://... or upload image"
                  className="input-field flex-1"
                />
                <label className="btn-secondary text-sm flex items-center justify-center cursor-pointer min-h-[44px] shrink-0 select-none">
                  Upload Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="w-10 h-10 rounded-md border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.primaryColor}
                    onChange={(e) => handleChange('primaryColor', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Secondary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.secondaryColor}
                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                    className="w-10 h-10 rounded-md border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.secondaryColor}
                    onChange={(e) => handleChange('secondaryColor', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Header Background</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.headerBg}
                  onChange={(e) => handleChange('headerBg', e.target.value)}
                  className="w-10 h-10 rounded-md border border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.headerBg}
                  onChange={(e) => handleChange('headerBg', e.target.value)}
                  className="input-field flex-1"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-1 mb-1.5">Footer Text</label>
              <input
                type="text"
                value={settings.footerText}
                onChange={(e) => handleChange('footerText', e.target.value)}
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">"Play Now" Label</label>
                <input
                  type="text"
                  value={settings.playNowLabel}
                  onChange={(e) => handleChange('playNowLabel', e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">"Play Now" URL</label>
                <input
                  type="url"
                  value={settings.playNowUrl}
                  onChange={(e) => handleChange('playNowUrl', e.target.value)}
                  placeholder="https://..."
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">Auto ID Registration Link</label>
                <input
                  type="url"
                  value={settings.autoIdLink}
                  onChange={(e) => handleChange('autoIdLink', e.target.value)}
                  placeholder="https://..."
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">🎮 Site Login Link <span className="text-xs text-text-3 font-normal ml-1">(Game site login URL — sent to customer after ID creation)</span></label>
                <input
                  type="url"
                  value={settings.siteLoginLink}
                  onChange={(e) => handleChange('siteLoginLink', e.target.value)}
                  placeholder="https://dafaxbet.com/login"
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">"Play Now" Button Background</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.playNowBgColor || settings.primaryColor}
                    onChange={(e) => handleChange('playNowBgColor', e.target.value)}
                    className="w-10 h-10 rounded-md border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.playNowBgColor || settings.primaryColor}
                    onChange={(e) => handleChange('playNowBgColor', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-1 mb-1.5">"Play Now" Button Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.playNowTextColor || '#FFFFFF'}
                    onChange={(e) => handleChange('playNowTextColor', e.target.value)}
                    className="w-10 h-10 rounded-md border border-border cursor-pointer"
                  />
                  <input
                    type="text"
                    value={settings.playNowTextColor || '#FFFFFF'}
                    onChange={(e) => handleChange('playNowTextColor', e.target.value)}
                    className="input-field flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6 mt-6">
              <h3 className="text-base font-semibold text-text-1 mb-4">Login & Register Pages Customization</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Background Type</label>
                  <select
                    value={settings.authBgType || 'gradient'}
                    onChange={(e) => handleChange('authBgType', e.target.value)}
                    className="input-field w-full"
                  >
                    <option value="color">Solid Color</option>
                    <option value="gradient">Gradient</option>
                    <option value="image">Background Image</option>
                  </select>
                </div>
                
                {settings.authBgType === 'color' && (
                  <div>
                    <label className="block text-sm font-medium text-text-1 mb-1.5">Background Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={settings.authBgColor || '#0F172A'}
                        onChange={(e) => handleChange('authBgColor', e.target.value)}
                        className="w-10 h-10 rounded-md border border-border cursor-pointer"
                      />
                      <input
                        type="text"
                        value={settings.authBgColor || '#0F172A'}
                        onChange={(e) => handleChange('authBgColor', e.target.value)}
                        className="input-field flex-1"
                      />
                    </div>
                  </div>
                )}

                {settings.authBgType === 'gradient' && (
                  <div>
                    <label className="block text-sm font-medium text-text-1 mb-1.5">Background Gradient CSS</label>
                    <input
                      type="text"
                      value={settings.authBgGradient || 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)'}
                      onChange={(e) => handleChange('authBgGradient', e.target.value)}
                      placeholder="linear-gradient(135deg, #0F172A 0%, #1E293B 100%)"
                      className="input-field"
                    />
                  </div>
                )}

                {settings.authBgType === 'image' && (
                  <div>
                    <label className="block text-sm font-medium text-text-1 mb-1.5">Background Image URL</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={settings.authBgImage || ''}
                        onChange={(e) => handleChange('authBgImage', e.target.value)}
                        placeholder="https://... or upload image"
                        className="input-field flex-1"
                      />
                      <label className="btn-secondary text-sm flex items-center justify-center cursor-pointer min-h-[44px] shrink-0 select-none">
                        Upload Bg
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleBgUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Card Background Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.authCardBg || '#1E293B'}
                      onChange={(e) => handleChange('authCardBg', e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.authCardBg || '#1E293B'}
                      onChange={(e) => handleChange('authCardBg', e.target.value)}
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Card Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.authCardTextColor || '#FFFFFF'}
                      onChange={(e) => handleChange('authCardTextColor', e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.authCardTextColor || '#FFFFFF'}
                      onChange={(e) => handleChange('authCardTextColor', e.target.value)}
                      className="input-field flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Link Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.authLinkColor || settings.primaryColor || '#B91C1C'}
                      onChange={(e) => handleChange('authLinkColor', e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.authLinkColor || settings.primaryColor || '#B91C1C'}
                      onChange={(e) => handleChange('authLinkColor', e.target.value)}
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Button BG Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.authBtnBgColor || settings.primaryColor || '#B91C1C'}
                      onChange={(e) => handleChange('authBtnBgColor', e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.authBtnBgColor || settings.primaryColor || '#B91C1C'}
                      onChange={(e) => handleChange('authBtnBgColor', e.target.value)}
                      className="input-field flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Button Text Color</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.authBtnTextColor || '#FFFFFF'}
                      onChange={(e) => handleChange('authBtnTextColor', e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.authBtnTextColor || '#FFFFFF'}
                      onChange={(e) => handleChange('authBtnTextColor', e.target.value)}
                      className="input-field flex-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6 mt-6">
              <h3 className="text-base font-semibold text-text-1 mb-2">Welcome Message Automation (By Category)</h3>
              <p className="text-xs text-text-3 mb-4">Define the custom message that will be automatically sent to the customer from the support side when a chat is started or transferred to each category.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Deposit Welcome Message</label>
                  <textarea
                    value={settings.welcome_message_deposit || ''}
                    onChange={(e) => handleChange('welcome_message_deposit', e.target.value)}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Enter automated message for Deposit chats..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Withdrawal Welcome Message</label>
                  <textarea
                    value={settings.welcome_message_withdrawal || ''}
                    onChange={(e) => handleChange('welcome_message_withdrawal', e.target.value)}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Enter automated message for Withdrawal chats..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">New ID Welcome Message</label>
                  <textarea
                    value={settings.welcome_message_new_id || ''}
                    onChange={(e) => handleChange('welcome_message_new_id', e.target.value)}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Enter automated message for New ID chats..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">Verify ID Welcome Message</label>
                  <textarea
                    value={settings.welcome_message_verify_id || ''}
                    onChange={(e) => handleChange('welcome_message_verify_id', e.target.value)}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Enter automated message for Verify ID chats..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-1 mb-1.5">General / Other Welcome Message</label>
                  <textarea
                    value={settings.welcome_message_other || ''}
                    onChange={(e) => handleChange('welcome_message_other', e.target.value)}
                    rows={2}
                    className="input-field w-full"
                    placeholder="Enter automated message for Other chats..."
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6 mt-6">
              <h3 className="text-base font-semibold text-text-1 mb-4">Homepage FAQs Customization</h3>
              
              <div className="space-y-4">
                {(settings.faqs || []).map((faq, idx) => (
                  <div key={idx} className="p-4 border border-border bg-bg/25 rounded-md space-y-3 relative">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...(settings.faqs || [])];
                        updated.splice(idx, 1);
                        handleChange('faqs', updated);
                      }}
                      className="absolute top-2 right-2 text-danger hover:text-danger-hover text-xs font-semibold"
                    >
                      Delete
                    </button>
                    
                    <div>
                      <label className="block text-xs font-medium text-text-2 mb-1">Question {idx + 1}</label>
                      <input
                        type="text"
                        value={faq.q}
                        onChange={(e) => {
                          const updated = [...(settings.faqs || [])];
                          updated[idx] = { ...updated[idx], q: e.target.value };
                          handleChange('faqs', updated);
                        }}
                        className="input-field w-full text-xs"
                        placeholder="e.g. How do I make a deposit?"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-text-2 mb-1">Answer {idx + 1}</label>
                      <textarea
                        value={faq.a}
                        onChange={(e) => {
                          const updated = [...(settings.faqs || [])];
                          updated[idx] = { ...updated[idx], a: e.target.value };
                          handleChange('faqs', updated);
                        }}
                        className="input-field w-full text-xs h-16 resize-none"
                        placeholder="Answer text..."
                      />
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...(settings.faqs || [])];
                    updated.push({ q: '', a: '' });
                    handleChange('faqs', updated);
                  }}
                  className="px-3 py-1.5 bg-bg border border-border text-xs font-bold text-text-1 hover:bg-bg-hover transition-colors rounded-md"
                >
                  + Add FAQ Item
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Branding'}
            </button>
            {saved && (
              <span className="text-sm text-success">Changes saved successfully</span>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:block w-72">
        <div className="bg-surface rounded-lg shadow-card overflow-hidden sticky top-20">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-text-2 uppercase">Live Preview</p>
          </div>

          <div className="bg-bg">
            {/* Centered Logo header simulation */}
            <div className="p-3 grid grid-cols-3 items-center" style={{ backgroundColor: settings.headerBg }}>
              <div />
              <div className="flex justify-center">
                {settings.logo ? (
                  <img src={settings.logo} alt="Logo" className="h-6 object-contain" />
                ) : (
                  <span className="text-xs font-bold text-white tracking-wider">{settings.companyName || 'DAFAX'}</span>
                )}
              </div>
              <div />
            </div>

            {/* Simulated Banner block with Play Now CTA button preview */}
            <div className="relative h-[90px] w-full bg-primary/10 flex items-center justify-center border-b border-border">
              <span className="text-[10px] text-text-3 font-semibold uppercase tracking-wider">Banner Area</span>
              {settings.playNowUrl && (
                <span
                  className="absolute bottom-2 right-2 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded shadow-sm scale-90"
                  style={{
                    backgroundColor: settings.playNowBgColor || settings.primaryColor,
                    color: settings.playNowTextColor || '#FFFFFF'
                  }}
                >
                  {settings.playNowLabel || 'Play Now'}
                </span>
              )}
            </div>

            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs text-text-2">We're Online</span>
              </div>

              <button
                className="w-full py-2.5 rounded-md text-white text-sm font-semibold"
                style={{ backgroundColor: settings.primaryColor }}
              >
                💬 Start New Chat
              </button>
            </div>

            <div className="px-4 py-2 border-t border-border">
              <p className="text-[10px] text-text-3 text-center">{settings.footerText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandingSettings;
