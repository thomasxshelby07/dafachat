const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove } = require('../middleware/roleCheck');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

const defaultSettings = {
  branding: {
    companyName: 'DAFA Bet',
    logo: '',
    favicon: '',
    primaryColor: '#635BFF',
    secondaryColor: '#4F46E5',
    headerBg: '#111827',
    footerText: '© 2026 DAFAXBET. All rights reserved.',
    playNowBgColor: '#635BFF',
    playNowTextColor: '#FFFFFF',
    authBgType: 'gradient',
    authBgColor: '#F8FAFC',
    authBgImage: '',
    authBgGradient: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
    authCardBg: '#FFFFFF',
    authCardTextColor: '#0F172A',
    authLinkColor: '#B91C1C',
    authBtnBgColor: '#B91C1C',
    authBtnTextColor: '#FFFFFF',
  },
  homepage: {
    welcomeText: 'Welcome to DAFAXBET Support',
    supportHeader: 'How can we help you?',
    playNowLabel: 'Play Now',
    playNowUrl: '#',
    autoIdLink: '#',
    siteLoginLink: '#',
    helpText: 'Our support team is available 24/7 to assist you.',
    welcome_message_deposit: 'Welcome! Please share a screenshot of your transaction and your registered number so we can process your deposit quickly.',
    welcome_message_withdrawal: 'Welcome! Please share your gaming ID and registered mobile number so we can check your withdrawal status.',
    welcome_message_new_id: 'Welcome! How can we help you create a new DAFAXBET account? Please share your name and mobile number.',
    welcome_message_verify_id: 'Welcome! Please share your registered mobile number and Dafa ID for quick verification.',
    welcome_message_other: 'Welcome to DAFAXBET Support. How can we help you today.',
    faqs: [
      { q: 'How do I make a deposit?', a: 'Click the "Play Now" button in the header, go to the deposit section, choose your payment method, and complete the transfer. If it does not reflect, start a "Deposit Issue" support chat.' },
      { q: 'How long does a withdrawal take?', a: 'Withdrawals are processed within 15-30 minutes. If there is a delay, please contact support by opening a "Withdrawal Issue" chat.' },
      { q: 'How do I verify my account?', a: 'Upload a clear copy of your Identity document in your profile settings or share it directly with our support agent in chat.' },
      { q: 'Is my personal data secure?', a: 'Yes, we use global bank-grade encryption to protect all your account data.' },
    ],
  },
  system: {
    maxFileSize: 10,
    allowedFileTypes: ['image/*', 'audio/*', '.pdf', '.doc', '.docx'],
  },
  notifications: {
    enablePush: true,
    enableEmail: false,
  },
  agentActivity: {
    idleTimeout: 10,
    gracePeriod: 2,
    enableAutoReassignment: true,
  },
};

router.get('/public', async (req, res) => {
  try {
    const settings = await Settings.find();
    const grouped = {};

    for (const group of Object.keys(defaultSettings)) {
      if (group === 'branding' || group === 'homepage') {
        grouped[group] = { ...defaultSettings[group] };
      }
    }

    settings.forEach(s => {
      if (grouped[s.group]) {
        grouped[s.group][s.key] = s.value;
      }
    });

    res.json({ settings: grouped });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const settings = await Settings.find();
    const grouped = {};

    for (const group of Object.keys(defaultSettings)) {
      grouped[group] = { ...defaultSettings[group] };
    }

    settings.forEach(s => {
      if (grouped[s.group]) {
        grouped[s.group][s.key] = s.value;
      }
    });

    res.json({ settings: grouped });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.get('/:group', auth, async (req, res) => {
  try {
    const { group } = req.params;
    const settings = await Settings.find({ group });
    const result = { ...defaultSettings[group] };

    settings.forEach(s => {
      result[s.key] = s.value;
    });

    res.json({ settings: result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { settings } = req.body;

    for (const [key, value] of Object.entries(settings)) {
      let group = 'system';
      if (defaultSettings.branding && key in defaultSettings.branding) group = 'branding';
      else if (defaultSettings.homepage && key in defaultSettings.homepage) group = 'homepage';
      else if (defaultSettings.notifications && key in defaultSettings.notifications) group = 'notifications';
      else if (defaultSettings.agentActivity && key in defaultSettings.agentActivity) group = 'agentActivity';

      const existing = await Settings.findOne({ key });

      if (existing) {
        const before = existing.value;
        existing.value = value;
        existing.group = group; // Force update the group in case it was previously misclassified (e.g. as 'system')
        existing.updatedBy = req.user._id;
        existing.updatedAt = new Date();
        await existing.save();

        await AuditLog.create({
          userId: req.user._id,
          action: 'update_setting',
          entity: 'settings',
          entityId: existing._id,
          before: { value: before },
          after: { value },
          ip: req.ip,
        });
      } else {
        await Settings.create({
          key,
          value,
          group,
          updatedBy: req.user._id,
        });
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('settings_updated', { settings });
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
