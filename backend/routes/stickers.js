const express = require('express');
const auth = require('../middleware/auth');
const { isAdmin } = require('../middleware/roleCheck');
const StickerPack = require('../models/StickerPack');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const packs = await StickerPack.find({ isEnabled: true });
    res.json({ packs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sticker packs' });
  }
});

router.get('/all', auth, isAdmin, async (req, res) => {
  try {
    const packs = await StickerPack.find().sort({ name: 1 });
    res.json({ packs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sticker packs' });
  }
});

router.post('/packs', auth, isAdmin, async (req, res) => {
  try {
    const { name, category, stickers } = req.body;
    const pack = new StickerPack({ name, category, stickers });
    await pack.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'create_sticker_pack',
      entity: 'sticker_pack',
      entityId: pack._id,
      after: pack.toObject(),
      ip: req.ip,
    });

    res.status(201).json({ pack });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create sticker pack' });
  }
});

router.patch('/packs/:id', auth, isAdmin, async (req, res) => {
  try {
    const pack = await StickerPack.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!pack) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'update_sticker_pack',
      entity: 'sticker_pack',
      entityId: pack._id,
      after: pack.toObject(),
      ip: req.ip,
    });

    res.json({ pack });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pack' });
  }
});

router.delete('/packs/:id', auth, isAdmin, async (req, res) => {
  try {
    const pack = await StickerPack.findByIdAndDelete(req.params.id);
    if (!pack) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    await AuditLog.create({
      userId: req.user._id,
      action: 'delete_sticker_pack',
      entity: 'sticker_pack',
      entityId: pack._id,
      before: pack.toObject(),
      ip: req.ip,
    });

    res.json({ message: 'Pack deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete pack' });
  }
});

module.exports = router;
