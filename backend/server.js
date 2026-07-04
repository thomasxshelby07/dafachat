require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { connectDB, connectRedis, getRedis } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const User = require('./models/User');
const Customer = require('./models/Customer');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const Lead = require('./models/Lead');
const Notification = require('./models/Notification');
const Banner = require('./models/Banner');
const Announcement = require('./models/Announcement');
const Settings = require('./models/Settings');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  perMessageDeflate: false,
});

const redis = connectRedis();

const safeRedis = {
  sadd: async (key, val) => { try { const r = getRedis(); if (r) return await r.sadd(key, val); } catch(e) {} },
  srem: async (key, val) => { try { const r = getRedis(); if (r) return await r.srem(key, val); } catch(e) {} },
  scard: async (key) => { try { const r = getRedis(); if (r) return await r.scard(key); } catch(e) {} return 0; },
  set: async (key, val, ...args) => { try { const r = getRedis(); if (r) return await r.set(key, val, ...args); } catch(e) {} },
  get: async (key) => { try { const r = getRedis(); if (r) return await r.get(key); } catch(e) {} return null; },
  del: async (key) => { try { const r = getRedis(); if (r) return await r.del(key); } catch(e) {} },
  keys: async (pattern) => { try { const r = getRedis(); if (r) return await r.keys(pattern); } catch(e) {} return []; },
};

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(morgan('dev', {
  stream: { write: (message) => logger.info(message.trim()) },
  skip: () => process.env.NODE_ENV === 'production',
}));

app.set('io', io);
app.set('redis', redis);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/stickers', require('./routes/stickers'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/banners', require('./routes/banners'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/users', require('./routes/users'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/broadcasts', require('./routes/broadcasts').router);
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.patch('/api/users/status', require('./middleware/auth'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['online', 'away', 'break', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const { updateUserStatus } = require('./utils/activitySystem');
    const user = await updateUserStatus(req.user._id, status, io);

    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

const ONLINE_KEY = 'online_users';
const userSocketMap = {};

const getSocketId = async (userId) => {
  return userSocketMap[userId] || await safeRedis.get(`user_socket:${userId}`);
};

const sendNotificationToUser = async (userId, notification) => {
  const socketId = await getSocketId(userId.toString());
  if (socketId) {
    io.to(socketId).emit('new_notification', notification);
  }
};

const notifyAgentsNewChat = async (chat, customer) => {
  const agents = await User.find({
    role: { $in: ['agent', 'manager', 'super_admin'] },
    isActive: true,
    status: 'online',
  });

  io.emit('new_chat_available', {
    chatId: chat._id,
    customerId: customer._id,
    customerName: customer.fullName,
  });

  for (const agent of agents) {
    const notif = new Notification({
      userId: agent._id,
      type: 'new_chat',
      title: 'New Chat',
      body: `${customer.fullName} needs help`,
      metadata: { chatId: chat._id, customerId: customer._id },
    });
    await notif.save();
    await sendNotificationToUser(agent._id, notif);
  }
};

const notifyAgentNewMessage = async (chat, message, senderUser) => {
  if (chat.agentId && chat.agentId.toString() !== senderUser._id.toString()) {
    const customer = await Customer.findById(chat.customerId);
    const notif = new Notification({
      userId: chat.agentId,
      type: 'new_message',
      title: 'New Message',
      body: `${customer?.fullName || 'Customer'}: ${message.content?.substring(0, 50) || 'Sent a file'}`,
      metadata: { chatId: chat._id, messageId: message._id },
    });
    await notif.save();
    await sendNotificationToUser(chat.agentId, notif);
  }
};

const findBestAgent = async (issueType) => {
  logger.info(`findBestAgent: looking for active support user handling "${issueType}"`);

  let candidates = [];

  if (issueType === 'new_id') {
    // Only agents/managers/admins who explicitly have 'new_id' permission
    candidates = await User.find({
      isActive: true,
      status: 'online',
      role: { $in: ['agent', 'manager', 'super_admin'] },
      'permissions.issueTypes': 'new_id',
    }).select('_id fullName status permissions role');
  } else {
    // Step 1: Look for active, online AGENTS specializing in issueType
    candidates = await User.find({
      role: 'agent',
      isActive: true,
      status: 'online',
      'permissions.issueTypes': issueType,
    }).select('_id fullName status permissions role');

    // Step 2: Look for active, online AGENTS specializing in nothing (handles all except new_id)
    if (candidates.length === 0) {
      candidates = await User.find({
        role: 'agent',
        isActive: true,
        status: 'online',
        $or: [
          { 'permissions.issueTypes': { $size: 0 } },
          { 'permissions.issueTypes': { $exists: false } },
          { $expr: { $eq: [{ $size: { $ifNull: ['$permissions.issueTypes', []] } }, 0] } },
        ],
      }).select('_id fullName status permissions role');
    }

    // Step 3: Look for any active, online AGENTS who DO NOT have 'new_id' permission
    if (candidates.length === 0) {
      candidates = await User.find({
        role: 'agent',
        isActive: true,
        status: 'online',
        'permissions.issueTypes': { $ne: 'new_id' }
      }).select('_id fullName status permissions role');
    }

    // Step 4: If no active, online AGENTS are available, look for active, online MANAGERS specializing in issueType
    if (candidates.length === 0) {
      logger.info(`findBestAgent: No active/online agents. Looking for active/online managers specializing in "${issueType}"`);
      candidates = await User.find({
        role: 'manager',
        isActive: true,
        status: 'online',
        'permissions.issueTypes': issueType,
      }).select('_id fullName status permissions role');
    }

    // Step 5: Look for active, online MANAGERS specializing in nothing (handles all except new_id)
    if (candidates.length === 0) {
      candidates = await User.find({
        role: 'manager',
        isActive: true,
        status: 'online',
        $or: [
          { 'permissions.issueTypes': { $size: 0 } },
          { 'permissions.issueTypes': { $exists: false } },
          { $expr: { $eq: [{ $size: { $ifNull: ['$permissions.issueTypes', []] } }, 0] } },
        ],
      }).select('_id fullName status permissions role');
    }

    // Step 6: Look for any active, online MANAGERS who DO NOT have 'new_id' permission
    if (candidates.length === 0) {
      candidates = await User.find({
        role: 'manager',
        isActive: true,
        status: 'online',
        'permissions.issueTypes': { $ne: 'new_id' }
      }).select('_id fullName status permissions role');
    }

    // Step 7: Fallback to active, online SUPER ADMINS if absolutely nobody else is available (who don't have 'new_id' exclusively)
    if (candidates.length === 0) {
      logger.info('findBestAgent: No active/online agents or managers. Looking for active/online super admins');
      candidates = await User.find({
        role: 'super_admin',
        isActive: true,
        status: 'online',
      }).select('_id fullName status permissions role');
    }
  }

  logger.info(`findBestAgent: found ${candidates.length} candidate active support users`);

  if (candidates.length === 0) {
    logger.info('findBestAgent: NO active/online support users available!');
    return null;
  }

  // Find user with least active chats (load balancing)
  const candidateChatCounts = await Promise.all(
    candidates.map(async (cand) => {
      const count = await Chat.countDocuments({ agentId: cand._id, status: 'active' });
      return { cand, count };
    })
  );

  candidateChatCounts.sort((a, b) => a.count - b.count);
  const best = candidateChatCounts[0].cand;
  logger.info(`findBestAgent: assigned to ${best.fullName} (${best.status}, role: ${best.role}) with ${candidateChatCounts[0].count} active chats`);
  return best;
};

const notifyCustomerNewMessage = async (chat, message, senderUser) => {
  const customer = await Customer.findById(chat.customerId);
  if (customer && customer.userId.toString() !== senderUser._id.toString()) {
    let compName = 'SUPPORT';
    try {
      const compSetting = await Settings.findOne({ key: 'branding' });
      if (compSetting?.value?.companyName) {
        compName = `${compSetting.value.companyName.toUpperCase()} SUPPORT`;
      }
    } catch (e) {}

    const notif = new Notification({
      userId: customer.userId,
      type: 'new_message',
      title: compName,
      body: `${message.content?.substring(0, 50) || 'Sent a file'}`,
      metadata: { chatId: chat._id, messageId: message._id },
    });
    await notif.save();
    await sendNotificationToUser(customer.userId, notif);
  }
};

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'dafax_access_secret_key_2024_change_in_production');
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.userRole = user.role;
    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  const userId = socket.userId;
  const userRole = socket.userRole;

  logger.info(`Socket connected: ${socket.id} (user: ${userId})`);

  userSocketMap[userId] = socket.id;
  await safeRedis.set(`user_socket:${userId}`, socket.id, 'EX', 86400);
  await safeRedis.sadd(ONLINE_KEY, userId);
  io.emit('user_status', { userId, status: 'online' });

  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });

  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
  });

  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, type = 'text', mediaUrl, mediaPublicId, isInternal = false, replyTo } = data;
 
      const actualIsInternal = isInternal && ['agent', 'manager', 'super_admin'].includes(userRole);
 
      const chat = await Chat.findById(chatId);
      if (!chat) {
        return socket.emit('error', { message: 'Chat not found' });
      }
 
      const message = new Message({
        chatId,
        senderId: userId,
        senderRole: userRole,
        senderName: socket.user.fullName || '',
        content,
        type,
        mediaUrl,
        mediaPublicId,
        isInternal: actualIsInternal,
        status: 'sent',
        replyTo: replyTo || undefined,
      });
      await message.save();
 
      await Chat.findByIdAndUpdate(chatId, { lastMessageAt: new Date() });
 
      const messageObj = message.toObject();
      messageObj.senderName = socket.user.fullName;

      if (replyTo) {
        const repliedMsg = await Message.findById(replyTo).select('_id content senderName senderRole type mediaUrl');
        if (repliedMsg) {
          messageObj.replyTo = repliedMsg.toObject();
        }
      }

      if (actualIsInternal) {
        const staffInChat = await User.find({
          _id: { $ne: userId },
          role: { $in: ['agent', 'manager', 'super_admin'] },
          isActive: true,
        }).select('_id');

        for (const staff of staffInChat) {
          const staffSocket = userSocketMap[staff._id.toString()];
          if (staffSocket) {
            io.to(staffSocket).emit('new_message', messageObj);
          }
        }
        const senderSocket = userSocketMap[userId];
        if (senderSocket) {
          io.to(senderSocket).emit('message_delivered', { messageId: message._id, chatId, message: messageObj });
        }
      } else {
        messageObj.senderName = socket.user.fullName;

        // Check if recipient is online — if yes, mark delivered immediately
        const recipientIds = [];
        if (userRole === 'customer' && chat.agentId) {
          recipientIds.push(chat.agentId.toString());
        } else if (userRole !== 'customer' && chat.customerId) {
          const customer = await Customer.findById(chat.customerId);
          if (customer) recipientIds.push(customer.userId.toString());
        }

        let isDelivered = false;
        for (const rid of recipientIds) {
          if (userSocketMap[rid]) {
            isDelivered = true;
            break;
          }
        }

        if (isDelivered) {
          message.status = 'delivered';
          message.deliveredAt = new Date();
          await Message.findByIdAndUpdate(message._id, { status: 'delivered', deliveredAt: message.deliveredAt });
          messageObj.status = 'delivered';
          messageObj.deliveredAt = message.deliveredAt;
        }

        socket.to(chatId).emit('new_message', messageObj);

        // Send to all individual sockets (sender, customer, staff)
        const senderSocket = userSocketMap[userId];
        if (senderSocket) {
          io.to(senderSocket).emit('new_message', messageObj);
        }

        // Send to customer directly (they may not be in the room)
        if (userRole !== 'customer' && chat.customerId) {
          const customer = await Customer.findById(chat.customerId);
          if (customer) {
            const custSocket = userSocketMap[customer.userId.toString()];
            if (custSocket && custSocket !== senderSocket) {
              io.to(custSocket).emit('new_message', messageObj);
            }
          }
        }

        if (userRole === 'customer') {
          await notifyAgentNewMessage(chat, message, socket.user);
        } else {
          await notifyCustomerNewMessage(chat, message, socket.user);
        }

        const allStaff = await User.find({
          role: { $in: ['agent', 'manager', 'super_admin'] },
          isActive: true,
          _id: { $ne: userId },
        }).select('_id');

        for (const staff of allStaff) {
          const staffSocket = userSocketMap[staff._id.toString()];
          if (staffSocket) {
            io.to(staffSocket).emit('new_message', messageObj);
          }
        }
      }
    } catch (error) {
      logger.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing_start', (data) => {
    socket.to(data.chatId).emit('user_typing', {
      userId,
      chatId: data.chatId,
      fullName: socket.user.fullName,
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(data.chatId).emit('user_typing_stopped', { userId, chatId: data.chatId });
  });

  socket.on('delete_message', async (data) => {
    try {
      if (userRole === 'customer') {
        return socket.emit('error', { message: 'Customers cannot delete messages' });
      }
      const { messageId } = data;
      const message = await Message.findById(messageId);
      if (!message) return;

      await Message.findByIdAndDelete(messageId);
      io.to(message.chatId.toString()).emit('message_deleted', {
        messageId: message._id.toString(),
        chatId: message.chatId.toString(),
      });
    } catch (error) {
      logger.error('Delete message error:', error);
    }
  });

  socket.on('mark_read', async (data) => {
    try {
      const { chatId, messageIds } = data;
      const now = new Date();

      const messages = await Message.find({ _id: { $in: messageIds }, chatId }).select('senderId status');

      await Message.updateMany(
        { _id: { $in: messageIds }, chatId, status: { $ne: 'read' } },
        { status: 'read', readAt: now }
      );

      // Notify the SENDER of each message that it was read
      const senderMessageMap = {};
      for (const msg of messages) {
        if (msg.status !== 'read') {
          const senderId = msg.senderId.toString();
          if (!senderMessageMap[senderId]) senderMessageMap[senderId] = [];
          senderMessageMap[senderId].push(msg._id.toString());
        }
      }

      for (const [senderId, ids] of Object.entries(senderMessageMap)) {
        const senderSocket = userSocketMap[senderId];
        if (senderSocket) {
          io.to(senderSocket).emit('message_status_changed', {
            chatId,
            messageIds: ids,
            status: 'read',
          });
        }
      }

      // Notify the reader themselves so they clear unread count locally
      const readerSocket = userSocketMap[userId];
      if (readerSocket) {
        io.to(readerSocket).emit('chat_read', { chatId });
      }

      // Mark all notifications for this user as read
      await Notification.updateMany({ userId, isRead: false }, { isRead: true });
      const updatedCount = await Notification.countDocuments({ userId, isRead: false });
      if (readerSocket) {
        io.to(readerSocket).emit('notifications_cleared', { unreadCount: updatedCount });
      }

      // Broadcast to chat room
      io.to(chatId).emit('message_read', { chatId, messageIds, readBy: userId });

      // Broadcast to all staff for chat list unread count update
      const allStaff = await User.find({
        role: { $in: ['agent', 'manager', 'super_admin'] },
        isActive: true,
        _id: { $ne: userId },
      }).select('_id');
      for (const staff of allStaff) {
        const staffSocket = userSocketMap[staff._id.toString()];
        if (staffSocket) {
          io.to(staffSocket).emit('message_read', { chatId, messageIds, readBy: userId });
        }
      }

      // Notify customer if they sent those messages
      const chat = await Chat.findById(chatId);
      if (chat) {
        const customer = await Customer.findById(chat.customerId);
        if (customer && customer.userId.toString() !== userId) {
          const custSocket = userSocketMap[customer.userId.toString()];
          if (custSocket) {
            io.to(custSocket).emit('message_read', { chatId, messageIds, readBy: userId });
          }
        }
      }
    } catch (error) {
      logger.error('Mark read error:', error);
    }
  });

  socket.on('start_chat', async (data) => {
    try {
      const { issueType = 'other', fallbackAgentId } = data || {};
      const customer = await Customer.findOne({ userId });
      if (!customer) {
        return socket.emit('error', { message: 'Customer profile not found' });
      }

      let chat = await Chat.findOne({ customerId: customer._id, status: 'active' });
      let issueTypeChanged = false;

      if (chat) {
        if (chat.issueType !== issueType) {
          issueTypeChanged = true;
          chat.issueType = issueType;
          await chat.save();

          const lead = await Lead.findOne({ customerId: customer._id });
          if (lead) {
            lead.issueType = issueType;
            lead.lastActivity = new Date();
            await lead.save();
          }
        }
      } else {
        chat = new Chat({ customerId: customer._id, status: 'active', issueType });
        await chat.save();

        const lead = await Lead.findOne({ customerId: customer._id });
        if (lead) {
          lead.chatId = chat._id;
          lead.issueType = issueType;
          lead.timeline.push({ event: `Chat started (${issueType})`, date: new Date(), by: userId });
          lead.lastActivity = new Date();
          await lead.save();
        }
      }

      // Re-fetch chat fresh context to prevent any cached object issues
      let freshChat = await Chat.findById(chat._id);
      if (!freshChat) {
        return socket.emit('error', { message: 'Failed to initialize chat' });
      }

      if (!freshChat.agentId || issueTypeChanged || fallbackAgentId) {
        const oldAgentId = freshChat.agentId;
        let agent = null;

        if (fallbackAgentId) {
          agent = await User.findOne({
            _id: fallbackAgentId,
            isActive: true,
            status: 'online',
            role: { $in: ['agent', 'manager', 'super_admin'] }
          }).select('_id fullName status permissions role');
        }

        if (!agent) {
          const categoryQuery = {
            isActive: true,
            status: 'online',
            role: { $in: ['agent', 'manager', 'super_admin'] }
          };

          categoryQuery.$or = [
            { 'permissions.issueTypes': issueType },
            { 'permissions.issueTypes': { $size: 0 } },
            { 'permissions.issueTypes': { $exists: false } },
            { $expr: { $eq: [{ $size: { $ifNull: ['$permissions.issueTypes', []] } }, 0] } }
          ];

          const candidates = await User.find(categoryQuery).select('_id fullName status permissions role');
          if (candidates.length > 0) {
            const counts = await Promise.all(
              candidates.map(async (cand) => {
                const count = await Chat.countDocuments({ agentId: cand._id, status: 'active' });
                return { cand, count };
              })
            );
            counts.sort((a, b) => a.count - b.count);
            agent = counts[0].cand;
          }
        }

        if (agent) {
          if (!oldAgentId || oldAgentId.toString() !== agent._id.toString()) {
            freshChat.agentId = agent._id;
            await freshChat.save();

            customer.assignedAgent = agent._id;
            customer.leadStatus = 'assigned';
            await customer.save();

            const lead = await Lead.findOne({ customerId: customer._id });
            if (lead) {
              lead.assignedAgent = agent._id;
              lead.assignedAgents = [agent._id];
              lead.status = 'assigned';
              lead.timeline.push({
                event: `Auto-assigned to ${agent.fullName} (${issueType})`,
                date: new Date(),
                by: userId,
              });
              lead.lastActivity = new Date();
              await lead.save();
            }

            const agentNotif = new Notification({
              userId: agent._id,
              type: 'agent_assigned',
              title: 'New Chat Assigned',
              body: `${customer.fullName} needs help with ${issueType}`,
              metadata: { chatId: freshChat._id, customerId: customer._id, issueType },
            });
            await agentNotif.save();
            await sendNotificationToUser(agent._id, agentNotif);

            const agentSocketId = userSocketMap[agent._id.toString()];
            if (agentSocketId) {
              io.to(agentSocketId).emit('new_chat_assigned', {
                chatId: freshChat._id,
                customer: customer.toObject(),
                issueType,
                message: `${customer.fullName} needs help with ${issueType}`,
              });
            }

            if (oldAgentId) {
              const oldAgentSocketId = userSocketMap[oldAgentId.toString()];
              if (oldAgentSocketId) {
                io.to(oldAgentSocketId).emit('lead_reassigned', {
                  leadId: lead ? lead._id : null,
                  chatId: freshChat._id,
                  newAgent: agent.fullName,
                });
              }
            }

            const customerNotif = new Notification({
              userId: customer.userId,
              type: 'agent_assigned',
              title: 'Agent Assigned',
              body: `${agent.fullName} is now assisting you`,
              metadata: { chatId: freshChat._id, agentId: agent._id },
            });
            await customerNotif.save();
            io.to(socket.id).emit('new_notification', customerNotif);

            io.to(socket.id).emit('agent_assigned', {
              agentName: agent.fullName,
              chatId: freshChat._id,
            });
          }
        } else {
          const onlineOthers = await User.find({
            isActive: true,
            status: 'online',
            role: { $in: ['agent', 'manager', 'super_admin'] }
          }).select('_id fullName avatar permissions.issueTypes role');

          if (onlineOthers.length > 0) {
            return socket.emit('no_agents_for_category', {
              issueType,
              chatId: freshChat._id.toString(),
              onlineAgents: onlineOthers
            });
          } else {
            await notifyAgentsNewChat(freshChat, customer);
          }
        }
      }

      // Auto-send welcome message from agent if brand new chat OR if issue type changed
      const messagesCount = await Message.countDocuments({ chatId: freshChat._id });
      if (messagesCount === 0 || issueTypeChanged) {
        // Load welcome message setting for this category
        const welcomeMessages = {
          deposit: 'Welcome! Please share a screenshot of your transaction and your registered number so we can process your deposit quickly.',
          withdrawal: 'Welcome! Please share your gaming ID and registered mobile number so we can check your withdrawal status.',
          new_id: 'Welcome! How can we help you create a new DAFAXBET account? Please share your name and mobile number.',
          other: 'Welcome to DAFAXBET Support. How can we help you today?',
        };

        const settingKey = `welcome_message_${issueType}`;
        let welcomeSetting = await Settings.findOne({ key: settingKey });
        let welcomeText = welcomeSetting?.value;
        if (!welcomeText) {
          welcomeText = welcomeMessages[issueType] || welcomeMessages.other;
        }

        const agent = freshChat.agentId ? await User.findById(freshChat.agentId) : null;
        const welcomeMsg = new Message({
          chatId: freshChat._id,
          senderId: agent ? agent._id : null,
          senderRole: 'agent',
          senderName: agent ? agent.fullName : 'Support Agent',
          content: welcomeText,
          type: 'text',
          status: 'sent',
        });
        await welcomeMsg.save();
        await Chat.findByIdAndUpdate(freshChat._id, { lastMessageAt: new Date() });

        const welcomeMsgObj = welcomeMsg.toObject();
        welcomeMsgObj.senderName = agent ? agent.fullName : 'Support Agent';

        // Send to all staff
        const allStaff = await User.find({ role: { $in: ['agent', 'manager', 'super_admin'] }, isActive: true }).select('_id');
        for (const staff of allStaff) {
          const staffSocket = userSocketMap[staff._id.toString()];
          if (staffSocket) {
            io.to(staffSocket).emit('new_message', welcomeMsgObj);
          }
        }
        // Send back to customer
        io.to(socket.id).emit('new_message', welcomeMsgObj);
      }

      // Finally, join the room and emit chat_joined!
      socket.join(freshChat._id.toString());
      socket.emit('chat_joined', { chatId: freshChat._id.toString(), chat: freshChat.toObject() });

    } catch (error) {
      logger.error('Start chat error:', error);
      socket.emit('error', { message: 'Failed to start chat' });
    }
  });

  socket.on('agent_join_chat', async (data) => {
    try {
      const { chatId } = data;

      const chat = await Chat.findById(chatId);
      if (!chat) return socket.emit('error', { message: 'Chat not found' });

      if (!chat.agentId) {
        await Chat.findByIdAndUpdate(chatId, { agentId: userId });
        await Lead.findOneAndUpdate(
          { customerId: chat.customerId },
          {
            assignedAgent: userId,
            status: 'assigned',
            $push: { timeline: { event: 'Lead assigned to agent', date: new Date(), by: userId } },
            lastActivity: new Date(),
          }
        );
      } else if (chat.agentId.toString() !== userId.toString()) {
        // Agent is different from assigned — allow manager/super_admin to take over
        if (['manager', 'super_admin'].includes(userRole)) {
          await Chat.findByIdAndUpdate(chatId, { agentId: userId });
          await Lead.findOneAndUpdate(
            { customerId: chat.customerId },
            {
              assignedAgent: userId,
              $push: { timeline: { event: `Chat taken over by ${socket.user.fullName}`, date: new Date(), by: userId } },
              lastActivity: new Date(),
            }
          );
        }
      }

      socket.join(chatId.toString());

       const customer = await Customer.findById(chat.customerId);
      if (customer) {
        const customerSocket = userSocketMap[customer.userId.toString()];
        if (customerSocket) {
          let compName = 'SUPPORT';
          try {
            const compSetting = await Settings.findOne({ key: 'branding' });
            if (compSetting?.value?.companyName) {
              compName = `${compSetting.value.companyName.toUpperCase()} SUPPORT`;
            }
          } catch (e) {}

          const agent = await User.findById(userId).select('fullName status');
          io.to(customerSocket).emit('agent_assigned', {
            agentName: agent.status === 'break' ? compName : agent.fullName,
            chatId,
          });

          // Notify customer
          const notif = new Notification({
            userId: customer.userId,
            type: 'agent_assigned',
            title: 'Agent Assigned',
            body: `${compName} is now assisting you`,
            metadata: { chatId, agentId: userId },
          });
          await notif.save();
          io.to(customerSocket).emit('new_notification', notif);
        }
      }

      socket.emit('chat_joined', { chatId: chatId.toString(), chat: chat.toObject() });
    } catch (error) {
      logger.error('Agent join chat error:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  socket.on('close_chat', async (data) => {
    try {
      const { chatId } = data;
      await Chat.findByIdAndUpdate(chatId, { status: 'closed', closedAt: new Date() });
      io.to(chatId).emit('chat_closed', { chatId });

      const chat = await Chat.findById(chatId);
      if (chat) {
        await Lead.findOneAndUpdate(
          { customerId: chat.customerId },
          {
            status: 'closed',
            $push: { timeline: { event: 'Chat closed', date: new Date(), by: userId } },
            lastActivity: new Date(),
          }
        );
      }
    } catch (error) {
      logger.error('Close chat error:', error);
      socket.emit('error', { message: 'Failed to close chat' });
    }
  });

  socket.on('set_status', async (data) => {
    try {
      const { status } = data;
      if (!['online', 'away', 'break', 'offline'].includes(status)) return;

      const { updateUserStatus } = require('./utils/activitySystem');
      await updateUserStatus(userId, status, io);
    } catch (error) {
      logger.error('Set status error:', error);
    }
  });

  socket.on('disconnect', async () => {
    delete userSocketMap[userId];
    await safeRedis.srem(ONLINE_KEY, userId);
    await safeRedis.del(`user_socket:${userId}`);
    io.emit('user_status', { userId, status: 'offline' });
    logger.info(`Socket disconnected: ${socket.id} (user: ${userId})`);
    
    // To prevent immediate reassignment on simple page reload/refresh,
    // wait a short period and check if they reconnected on a new socket.
    setTimeout(async () => {
      const { userSocketMap: currentSocketMap } = require('./server');
      if (!currentSocketMap || !currentSocketMap[userId]) {
        const user = await User.findById(userId);
        if (user && ['agent', 'manager', 'super_admin'].includes(user.role) && user.status !== 'offline') {
          const { updateUserStatus } = require('./utils/activitySystem');
          await updateUserStatus(userId, 'offline', io);
          logger.info(`Automatically set agent ${user.fullName} status to offline due to socket disconnect.`);
        }
      }
    }, 5000);
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  // Clean up empty dafaxbetId strings to prevent sparse unique index conflicts
  try {
    const CustomerModel = require('./models/Customer');
    await CustomerModel.updateMany({ dafaxbetId: "" }, { $unset: { dafaxbetId: 1 } });
    logger.info('Cleaned up empty string dafaxbetId fields to prevent index conflicts.');
  } catch (err) {
    logger.error('Failed to clean empty dafaxbetId fields from database:', err);
  }

  // Migrate chats lastMessage fields
  try {
    const Chat = require('./models/Chat');
    const Message = require('./models/Message');

    const chats = await Chat.find({
      $or: [
        { lastMessage: { $exists: false } },
        { lastExternalMessage: { $exists: false } }
      ]
    });

    if (chats.length > 0) {
      logger.info(`[MIGRATION] Migrating ${chats.length} chats for lastMessage fields...`);
      for (const chat of chats) {
        const lastMsg = await Message.findOne({ chatId: chat._id }).sort({ createdAt: -1 });
        const lastExtMsg = await Message.findOne({ chatId: chat._id, isInternal: false }).sort({ createdAt: -1 });

        const update = {};
        if (lastMsg) update.lastMessage = lastMsg._id;
        if (lastExtMsg) update.lastExternalMessage = lastExtMsg._id;

        if (Object.keys(update).length > 0) {
          await Chat.findByIdAndUpdate(chat._id, update);
        }
      }
      logger.info(`[MIGRATION] Successfully migrated chats.`);
    }
  } catch (err) {
    logger.error('Failed to run lastMessage migration:', err);
  }

  // Auto-seed default banners and announcements if database is empty
  try {
    const bannerCount = await Banner.countDocuments();
    if (bannerCount === 0) {
      await Banner.insertMany([
        {
          type: 'promotional',
          title: 'Welcome Bonus 100%',
          description: 'Get a 100% bonus on your first deposit! Maximum bonus up to ₹10,000.',
          imageUrl: 'https://images.unsplash.com/photo-1518152006812-cdab29b069a8?q=80&w=600&auto=format&fit=crop',
          bgColor: '#635BFF',
          isActive: true,
          order: 0,
        },
        {
          type: 'offer',
          title: 'Instant UPI Deposits',
          description: 'Experience lightning fast UPI and IMPS deposit credits within 10 seconds.',
          imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop',
          bgColor: '#10B981',
          isActive: true,
          order: 1,
        }
      ]);
      logger.info('Default banners seeded successfully.');
    }

    const announcementCount = await Announcement.countDocuments();
    if (announcementCount === 0) {
      await Announcement.insertMany([
        {
          type: 'scrolling',
          content: '🔥 Welcome to Support! Get 100% Welcome Bonus on your first deposit! 24/7 Live Agent Assistance.',
          isActive: true,
        },
        {
          type: 'scrolling',
          content: '⚡ Deposit issues? Use IMPS/UPI for instant credits. Withdrawal processed within 15 minutes.',
          isActive: true,
        }
      ]);
      logger.info('Default announcements seeded successfully.');
    }
  } catch (err) {
    logger.error('Error seeding default banners/announcements:', err);
  }

  server.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });

  // Scheduled broadcasts checker
  setInterval(async () => {
    try {
      const Broadcast = require('./models/Broadcast');
      const { sendBroadcastInBackground } = require('./routes/broadcasts');
      
      const now = new Date();
      const scheduled = await Broadcast.find({
        status: 'scheduled',
        'schedule.type': 'later',
        'schedule.time': { $lte: now }
      });

      for (const b of scheduled) {
        logger.info(`Scheduled broadcast ${b._id} is due. Triggering sending...`);
        sendBroadcastInBackground(b._id, io);
      }
    } catch (err) {
      logger.error('Error processing scheduled broadcasts:', err);
    }
  }, 30000);
};

startServer();

module.exports = { app, server, io, getSocketId, userSocketMap };
