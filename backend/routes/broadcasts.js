const express = require('express');
const auth = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');
const Broadcast = require('../models/Broadcast');
const Customer = require('../models/Customer');
const User = require('../models/User');
const logger = require('../utils/logger');

const router = express.Router();

// Allow Super Admin, Admin (mapped to super_admin or admin role), and Manager
const isAllowedToBroadcast = roleCheck('super_admin', 'admin', 'manager');

/**
 * Helper to process targeted customer IDs based on filters
 */
async function getTargetedCustomers(audience) {
  const query = {};

  if (audience.type === 'filters') {
    // 1. Tags Filter
    if (audience.tags && audience.tags.length > 0) {
      query.tags = { $in: audience.tags };
    }
    // 2. Lead Status Filter
    if (audience.status && audience.status.length > 0) {
      query.leadStatus = { $in: audience.status };
    }
    // 3. Country Filter
    if (audience.country) {
      query.country = { $regex: new RegExp('^' + audience.country.trim() + '$', 'i') };
    }
    // 4. Lead Source Filter
    if (audience.leadSource) {
      query.leadSource = { $regex: new RegExp('^' + audience.leadSource.trim() + '$', 'i') };
    }
    // 5. Assigned Agent Filter
    if (audience.assignedAgent) {
      query.assignedAgent = audience.assignedAgent;
    }
    // 6. VIP Status Filter
    if (audience.isVIP !== undefined) {
      query.isVIP = audience.isVIP;
    }
    // 7. Last Active Filter
    if (audience.lastActiveDays) {
      const activeCutoff = new Date();
      activeCutoff.setDate(activeCutoff.getDate() - audience.lastActiveDays);
      query.lastSeen = { $gte: activeCutoff };
    }
    // 8. Registration Date Filter
    if (audience.regStartDate || audience.regEndDate) {
      query.registrationDate = {};
      if (audience.regStartDate) {
        query.registrationDate.$gte = new Date(audience.regStartDate);
      }
      if (audience.regEndDate) {
        query.registrationDate.$lte = new Date(audience.regEndDate + 'T23:59:59.999Z');
      }
    }
  }

  let dbQuery = Customer.find(query).select('_id');

  // Limit based on count constraints
  if (audience.type === 'count' && audience.count > 0) {
    dbQuery = dbQuery.limit(audience.count);
  }

  const customers = await dbQuery.exec();
  return customers.map(c => c._id);
}

/**
 * Background broadcast sender with chunked updates for live dashboard progress bar
 */
async function sendBroadcastInBackground(broadcastId, io) {
  try {
    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) return;

    broadcast.status = 'sending';
    await broadcast.save();

    if (io) {
      io.emit('new_broadcast');
    }

    const recipientsList = broadcast.recipients;
    const totalRecipients = recipientsList.length;

    if (totalRecipients === 0) {
      broadcast.status = 'completed';
      broadcast.analytics.totalSent = 0;
      broadcast.analytics.pending = 0;
      await broadcast.save();
      return;
    }

    // Process in chunks of 10 for interactive visual ticking on the dashboard progress bar
    const chunkSize = Math.max(1, Math.min(25, Math.ceil(totalRecipients / 10)));
    let index = 0;

    const timer = setInterval(async () => {
      if (index >= totalRecipients) {
        clearInterval(timer);
        broadcast.status = 'completed';
        await broadcast.save();

        if (io) {
          io.emit('new_broadcast');
          io.emit('broadcast_progress', {
            broadcastId: broadcast._id,
            status: 'completed',
            progress: {
              totalSelected: totalRecipients,
              pending: 0,
              sending: 0,
              delivered: broadcast.analytics.totalSent,
              failed: broadcast.analytics.failed,
              skipped: totalRecipients - broadcast.analytics.totalSent - broadcast.analytics.failed,
            }
          });
        }
        return;
      }

      // Process current chunk
      const chunk = recipientsList.slice(index, index + chunkSize);
      let chunkDelivered = 0;
      let chunkFailed = 0;

      for (const recId of chunk) {
        const historyIdx = broadcast.deliveryHistory.findIndex(h => h.customerId.toString() === recId.toString());
        if (historyIdx !== -1) {
          // Update status to delivered or failed/skipped
          broadcast.deliveryHistory[historyIdx].status = 'delivered';
          chunkDelivered++;
        }
      }

      broadcast.analytics.totalSent += chunkDelivered;
      broadcast.analytics.failed += chunkFailed;
      broadcast.analytics.pending = Math.max(0, totalRecipients - broadcast.analytics.totalSent - broadcast.analytics.failed);

      await broadcast.save();

      index += chunk.length;

      if (io) {
        io.emit('broadcast_progress', {
          broadcastId: broadcast._id,
          status: 'sending',
          progress: {
            totalSelected: totalRecipients,
            pending: broadcast.analytics.pending,
            sending: chunk.length,
            delivered: broadcast.analytics.totalSent,
            failed: broadcast.analytics.failed,
            skipped: totalRecipients - broadcast.analytics.totalSent - broadcast.analytics.failed - broadcast.analytics.pending,
          }
        });
      }
    }, 500); // 500ms intervals to display a premium ticking progress bar in admin view

  } catch (error) {
    logger.error('Error in sendBroadcastInBackground:', error);
    try {
      await Broadcast.findByIdAndUpdate(broadcastId, { status: 'failed' });
    } catch (e) {}
  }
}

// 1. Create Broadcast
router.post('/', auth, isAllowedToBroadcast, async (req, res) => {
  try {
    const { title, type, content, image, buttonText, buttonLink, audience, expiry, schedule } = req.body;

    if (!title || !type) {
      return res.status(400).json({ error: 'Title and Type are required' });
    }

    const recipients = await getTargetedCustomers(audience);

    // Calculate expiry date
    let expiresAt = null;
    if (expiry && expiry.type !== 'never') {
      const now = new Date();
      if (expiry.type === '1_day') {
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (expiry.type === '3_days') {
        expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      } else if (expiry.type === '7_days') {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (expiry.type === 'custom' && expiry.date) {
        expiresAt = new Date(expiry.date);
      }
    }

    // Calculate schedule date
    let scheduleTime = new Date();
    if (schedule && schedule.type === 'later' && schedule.time) {
      scheduleTime = new Date(schedule.time);
    }

    const isScheduledLater = schedule && schedule.type === 'later' && scheduleTime > new Date();

    const deliveryHistory = recipients.map(cId => ({
      customerId: cId,
      status: 'pending',
    }));

    const broadcast = new Broadcast({
      title,
      createdBy: req.user._id,
      type,
      content,
      image,
      buttonText,
      buttonLink,
      audience,
      recipients,
      deliveryHistory,
      expiry,
      expiresAt,
      schedule: {
        type: schedule?.type || 'now',
        time: scheduleTime,
      },
      status: isScheduledLater ? 'scheduled' : 'scheduled', // we set scheduled first, then trigger background worker
      analytics: {
        totalSent: 0,
        viewed: 0,
        buttonClicked: 0,
        failed: 0,
        pending: recipients.length,
      }
    });

    await broadcast.save();

    const io = req.app.get('io');

    if (!isScheduledLater) {
      // Trigger background sending immediately
      sendBroadcastInBackground(broadcast._id, io);
    }

    res.status(201).json({ broadcast });
  } catch (error) {
    logger.error('Create broadcast error:', error);
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

// 2. List All Broadcasts (for Admin/Manager History log)
router.get('/', auth, isAllowedToBroadcast, async (req, res) => {
  try {
    const broadcasts = await Broadcast.find()
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });

    res.json({ broadcasts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

// 3. Customer Side: Fetch active broadcasts targeting current customer
router.get('/active', auth, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Only customers can access active broadcasts' });
    }

    const customer = await Customer.findOne({ userId: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }

    const now = new Date();
    // Find completed/sending broadcasts containing this customer in recipients, and not expired
    const activeBroadcasts = await Broadcast.find({
      recipients: customer._id,
      status: { $in: ['completed', 'sending'] },
      $or: [
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    }).populate('createdBy', 'fullName').lean();

    // Map to include this specific customer's delivery history metrics (viewed, clicked)
    const formatted = activeBroadcasts.map(b => {
      const hist = b.deliveryHistory.find(h => h.customerId.toString() === customer._id.toString());
      return {
        _id: b._id,
        title: b.title,
        type: b.type,
        content: b.content,
        image: b.image,
        buttonText: b.buttonText,
        buttonLink: b.buttonLink,
        expiresAt: b.expiresAt,
        viewed: hist ? hist.viewed : false,
        clicked: hist ? hist.clicked : false,
      };
    });

    res.json({ broadcasts: formatted });
  } catch (error) {
    logger.error('Fetch active broadcasts error:', error);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

// 4. Customer Side: Mark broadcast as viewed
router.post('/:id/view', auth, async (req, res) => {
  try {
    const customer = await Customer.findOne({ userId: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const histIdx = broadcast.deliveryHistory.findIndex(h => h.customerId.toString() === customer._id.toString());
    if (histIdx !== -1) {
      if (!broadcast.deliveryHistory[histIdx].viewed) {
        broadcast.deliveryHistory[histIdx].viewed = true;
        broadcast.deliveryHistory[histIdx].viewedAt = new Date();
        broadcast.analytics.viewed += 1;
        await broadcast.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register broadcast view' });
  }
});

// 5. Customer Side: Mark button clicked
router.post('/:id/click', auth, async (req, res) => {
  try {
    const customer = await Customer.findOne({ userId: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const histIdx = broadcast.deliveryHistory.findIndex(h => h.customerId.toString() === customer._id.toString());
    if (histIdx !== -1) {
      if (!broadcast.deliveryHistory[histIdx].clicked) {
        broadcast.deliveryHistory[histIdx].clicked = true;
        broadcast.deliveryHistory[histIdx].clickedAt = new Date();
        broadcast.analytics.buttonClicked += 1;
        await broadcast.save();
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to register button click' });
  }
});

// 6. Get Broadcast Analytics & Progress details
router.get('/:id/analytics', auth, isAllowedToBroadcast, async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id)
      .populate('recipients', 'fullName mobile leadStatus')
      .lean();

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json({ broadcast });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// 7. Delete Broadcast
router.delete('/:id', auth, isAllowedToBroadcast, async (req, res) => {
  try {
    const broadcast = await Broadcast.findByIdAndDelete(req.params.id);
    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('new_broadcast');
    }

    res.json({ message: 'Broadcast deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

// 8. Edit/Update Broadcast
router.patch('/:id', auth, isAllowedToBroadcast, async (req, res) => {
  try {
    const { title, type, content, image, buttonText, buttonLink, audience, expiry, schedule } = req.body;

    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (title) broadcast.title = title;
    if (type) broadcast.type = type;
    if (content !== undefined) broadcast.content = content;
    if (image !== undefined) broadcast.image = image;
    if (buttonText !== undefined) broadcast.buttonText = buttonText;
    if (buttonLink !== undefined) broadcast.buttonLink = buttonLink;

    if (audience) {
      broadcast.audience = { ...broadcast.audience, ...audience };
      const recipients = await getTargetedCustomers(broadcast.audience);
      broadcast.recipients = recipients;
      broadcast.deliveryHistory = recipients.map(cId => ({
        customerId: cId,
        status: 'pending',
      }));
      broadcast.analytics = {
        totalSent: 0,
        viewed: 0,
        buttonClicked: 0,
        failed: 0,
        pending: recipients.length,
      };
    }

    if (expiry) {
      broadcast.expiry = expiry;
      let expiresAt = null;
      const now = new Date();
      if (expiry.type === '1_day') {
        expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      } else if (expiry.type === '3_days') {
        expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      } else if (expiry.type === '7_days') {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (expiry.type === 'custom' && expiry.date) {
        expiresAt = new Date(expiry.date);
      }
      broadcast.expiresAt = expiresAt;
    }

    if (schedule) {
      broadcast.schedule = schedule;
      if (schedule.type === 'now') {
        broadcast.schedule.time = new Date();
      } else if (schedule.time) {
        broadcast.schedule.time = new Date(schedule.time);
      }
      if (schedule.type === 'now') {
        broadcast.status = 'scheduled';
      }
    }

    await broadcast.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('new_broadcast');
      if (schedule && schedule.type === 'now') {
        sendBroadcastInBackground(broadcast._id, io);
      }
    }

    res.json({ broadcast });
  } catch (error) {
    logger.error('Update broadcast error:', error);
    res.status(500).json({ error: 'Failed to update broadcast' });
  }
});

module.exports = {
  router,
  sendBroadcastInBackground,
};
