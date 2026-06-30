const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove } = require('../middleware/roleCheck');
const Customer = require('../models/Customer');

const router = express.Router();

router.get('/', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, agent } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { customerId: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.leadStatus = status;
    if (agent) query.assignedAgent = agent;

    const customers = await Customer.find(query)
      .populate('assignedAgent', 'fullName mobile')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Customer.countDocuments(query);

    res.json({
      customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('assignedAgent', 'fullName mobile');

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

module.exports = router;
