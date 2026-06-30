const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove } = require('../middleware/roleCheck');
const Announcement = require('../models/Announcement');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { type } = req.query;
    const query = { isActive: true };
    if (type) query.type = type;

    const announcements = await Announcement.find(query);
    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.get('/all', auth, isManagerOrAbove, async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json({ announcements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

router.post('/', auth, isManagerOrAbove, async (req, res) => {
  try {
    const announcement = new Announcement(req.body);
    await announcement.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'create_announcement',
      entity: 'announcement',
      entityId: announcement._id,
      after: announcement.toObject(),
      ip: req.ip,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('announcements_changed');
      if (announcement.type === 'system' && announcement.isActive) {
        io.emit('announcement', {
          type: announcement.type,
          content: announcement.content,
        });
      }
    }

    res.status(201).json({ announcement });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.patch('/:id', auth, isManagerOrAbove, async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'update_announcement',
      entity: 'announcement',
      entityId: announcement._id,
      after: announcement.toObject(),
      ip: req.ip,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('announcements_changed');
    }

    res.json({ announcement });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

router.delete('/:id', auth, isManagerOrAbove, async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);

    const io = req.app.get('io');
    if (io) {
      io.emit('announcements_changed');
    }

    res.json({ message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

module.exports = router;
