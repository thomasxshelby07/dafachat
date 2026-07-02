const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove } = require('../middleware/roleCheck');
const Banner = require('../models/Banner');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

router.get('/public', async (req, res) => {
  try {
    const banners = await Banner.find({ isActive: true }).sort({ order: 1 });
    res.json({ banners });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public banners' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const query = includeInactive ? {} : { isActive: true };

    const banners = await Banner.find(query).sort({ order: 1 });
    res.json({ banners });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

router.get('/all', auth, isManagerOrAbove, async (req, res) => {
  try {
    const banners = await Banner.find().sort({ order: 1 });
    res.json({ banners });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
});

router.post('/', auth, isManagerOrAbove, async (req, res) => {
  try {
    const banner = new Banner(req.body);
    await banner.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'create_banner',
      entity: 'banner',
      entityId: banner._id,
      after: banner.toObject(),
      ip: req.ip,
    });

    res.status(201).json({ banner });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create banner' });
  }
});

router.patch('/:id', auth, isManagerOrAbove, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    const before = banner.toObject();
    Object.assign(banner, req.body);
    await banner.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'update_banner',
      entity: 'banner',
      entityId: banner._id,
      before,
      after: banner.toObject(),
      ip: req.ip,
    });

    res.json({ banner });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update banner' });
  }
});

router.delete('/:id', auth, isManagerOrAbove, async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'delete_banner',
      entity: 'banner',
      entityId: banner._id,
      before: banner.toObject(),
      ip: req.ip,
    });

    res.json({ message: 'Banner deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete banner' });
  }
});

router.patch('/:id/reorder', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { order } = req.body;
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { order },
      { new: true }
    );
    res.json({ banner });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder banner' });
  }
});

module.exports = router;
