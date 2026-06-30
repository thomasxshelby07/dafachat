const express = require('express');
const auth = require('../middleware/auth');
const { isAgentOrAbove } = require('../middleware/roleCheck');
const Template = require('../models/Template');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const templates = await Template.find({ isActive: true })
      .populate('createdBy', 'fullName')
      .sort({ order: 1 });

    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { title, body, category, order, type = 'text', mediaUrl, mediaPublicId } = req.body;

    const template = new Template({
      title,
      body,
      category,
      order,
      type,
      mediaUrl,
      mediaPublicId,
      createdBy: req.user._id,
    });
    await template.save();

    res.status(201).json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.patch('/:id', auth, isAgentOrAbove, async (req, res) => {
  try {
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/:id', auth, isAgentOrAbove, async (req, res) => {
  try {
    const template = await Template.findByIdAndDelete(req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
