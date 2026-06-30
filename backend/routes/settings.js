const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove } = require('../middleware/roleCheck');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

const defaultSettings = {
  branding: {
    companyName: 'DAFAX Bet',
    logo: '',
    favicon: '',
    primaryColor: '#635BFF',
    secondaryColor: '#4F46E5',
    headerBg: '#111827',
    footerText: '© 2026 DAFAX Bet. All rights reserved.',
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
    welcomeText: 'Welcome to DAFAX Support',
    supportHeader: 'How can we help you?',
    playNowLabel: 'Play Now',
    playNowUrl: '#',
    helpText: 'Our support team is available 24/7 to assist you.',
  },
  system: {
    maxFileSize: 10,
    allowedFileTypes: ['image/*', 'audio/*', '.pdf', '.doc', '.docx'],
  },
  notifications: {
    enablePush: true,
    enableEmail: false,
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
