const express = require('express');
const auth = require('../middleware/auth');
const { isAgentOrAbove } = require('../middleware/roleCheck');
const Chat = require('../models/Chat');
const Customer = require('../models/Customer');
const Message = require('../models/Message');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const query = {};

    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ userId: req.user._id });
      if (customer) {
        query.customerId = customer._id;
      } else {
        return res.json({ chats: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
      }
    } else if (req.user.role === 'agent') {
      query.agentId = req.user._id;
    }
    // manager and super_admin see ALL chats

    if (status) query.status = status;

    if (search) {
      const customers = await Customer.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { customerId: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.customerId = { $in: customers.map(c => c._id) };
    }

    const chats = await Chat.find(query)
      .populate('customerId', 'fullName mobile customerId isOnline lastSeen dafaxbetId')
      .populate('agentId', 'fullName mobile status permissions avatar')
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const chatIds = chats.map(c => c._id);
    if (chatIds.length === 0) {
      return res.json({ chats: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } });
    }

    // Get last messages (exclude internal notes for customers)
    const lastMsgQuery = { chatId: { $in: chatIds } };
    if (req.user.role === 'customer') {
      lastMsgQuery.isInternal = { $ne: true };
    }

    const lastMessages = await Message.aggregate([
      { $match: lastMsgQuery },
      { $sort: { createdAt: -1 } },
      { $group: {
        _id: '$chatId',
        lastMessage: { $first: '$$ROOT' },
      }},
    ]);

    const lastMessageMap = {};
    lastMessages.forEach(lm => {
      lastMessageMap[lm._id.toString()] = lm.lastMessage;
    });

    // Unread count: messages NOT sent by current user, NOT read, NOT internal (for customers)
    const unreadQuery = {
      chatId: { $in: chatIds },
      senderId: { $ne: req.user._id },
      status: { $ne: 'read' },
    };

    if (req.user.role === 'customer') {
      unreadQuery.isInternal = { $ne: true };
    }

    const unreadCounts = await Message.aggregate([
      { $match: unreadQuery },
      { $group: {
        _id: '$chatId',
        count: { $sum: 1 },
      }},
    ]);

    const unreadMap = {};
    unreadCounts.forEach(uc => {
      unreadMap[uc._id.toString()] = uc.count;
    });

    const enrichedChats = chats.map(chat => ({
      ...chat,
      lastMessage: lastMessageMap[chat._id.toString()] || null,
      unreadCount: unreadMap[chat._id.toString()] || 0,
    }));

    const total = await Chat.countDocuments(query);

    res.json({
      chats: enrichedChats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// GET /unread-count - Lightweight endpoint to fetch total unread count for the user
router.get('/unread-count', auth, async (req, res) => {
  try {
    let customerId;
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ userId: req.user._id });
      if (!customer) return res.json({ unreadCount: 0 });
      customerId = customer._id;
    }

    const chatQuery = { status: 'active' };
    if (req.user.role === 'customer') {
      chatQuery.customerId = customerId;
    } else if (req.user.role === 'agent') {
      chatQuery.agentId = req.user._id;
    }

    const chats = await Chat.find(chatQuery).select('_id');
    const chatIds = chats.map(c => c._id);
    if (chatIds.length === 0) {
      return res.json({ unreadCount: 0 });
    }

    const unreadQuery = {
      chatId: { $in: chatIds },
      senderId: { $ne: req.user._id },
      status: { $ne: 'read' },
    };

    if (req.user.role === 'customer') {
      unreadQuery.isInternal = { $ne: true };
    }

    const count = await Message.countDocuments(unreadQuery);
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('customerId', 'fullName mobile customerId isOnline lastSeen dafaxbetId')
      .populate('agentId', 'fullName mobile status permissions avatar');

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

router.get('/:id/messages', auth, async (req, res) => {
  try {
    const { before, limit = 50 } = req.query;
    const query = { chatId: req.params.id };

    // Customers never see internal notes
    if (req.user.role === 'customer') {
      query.isInternal = false;
    }

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const hasMore = messages.length === parseInt(limit);

    res.json({
      messages: messages.reverse(),
      hasMore,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/:id/close', auth, isAgentOrAbove, async (req, res) => {
  try {
    const chat = await Chat.findByIdAndUpdate(
      req.params.id,
      { status: 'closed', closedAt: new Date() },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(req.params.id).emit('chat_closed', { chatId: req.params.id });
    }

    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to close chat' });
  }
});

router.post('/:id/reopen', auth, isAgentOrAbove, async (req, res) => {
  try {
    const chat = await Chat.findByIdAndUpdate(
      req.params.id,
      { status: 'active', closedAt: null },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.json({ chat });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reopen chat' });
  }
});

router.post('/:id/transfer-self', auth, async (req, res) => {
  try {
    const { agentId } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const customer = await Customer.findOne({ userId: req.user._id });
    if (!customer || chat.customerId.toString() !== customer._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const User = require('../models/User');
    const Lead = require('../models/Lead');
    const Notification = require('../models/Notification');

    const agent = await User.findOne({ _id: agentId, role: 'agent', isActive: true, status: 'online' });
    if (!agent) {
      return res.status(400).json({ error: 'Selected agent is not available' });
    }

    chat.agentId = agent._id;
    await chat.save();

    customer.assignedAgent = agent._id;
    customer.leadStatus = 'assigned';
    await customer.save();

    const lead = await Lead.findOne({ chatId: chat._id });
    if (lead) {
      lead.assignedAgent = agent._id;
      lead.assignedAgents = [agent._id];
      lead.status = 'assigned';
      lead.timeline.push({
        event: `Customer self-transferred chat to ${agent.fullName}`,
        date: new Date(),
        by: req.user._id
      });
      await lead.save();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(chat._id.toString()).emit('agent_assigned', {
        agentName: agent.fullName,
        chatId: chat._id
      });

      io.emit('new_chat_assigned', {
        chatId: chat._id,
        customer: customer.toObject(),
        issueType: chat.issueType,
        message: `${customer.fullName} connected to you directly.`
      });

      const agentNotif = new Notification({
        userId: agent._id,
        type: 'agent_assigned',
        title: 'Chat Selected By Customer',
        body: `${customer.fullName} selected you to help them`,
        metadata: { chatId: chat._id, customerId: customer._id },
      });
      await agentNotif.save();
      io.emit('new_notification', agentNotif);
    }

    res.json({ chat });
  } catch (error) {
    console.error('Self transfer error:', error);
    res.status(500).json({ error: 'Failed to transfer chat' });
  }
});

module.exports = router;
