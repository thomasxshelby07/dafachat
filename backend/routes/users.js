const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove, isAdmin } = require('../middleware/roleCheck');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// PATCH /status — Update own status
router.patch('/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['online', 'away', 'break', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be online, away, break or offline.' });
    }

    const { updateUserStatus } = require('../utils/activitySystem');
    const io = req.app.get('io');

    const updatedUser = await updateUserStatus(req.user._id, status, io);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: updatedUser.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// GET /agents/online — Get list of online agents
router.get('/agents/online', auth, async (req, res) => {
  try {
    const agents = await User.find({
      role: 'agent',
      isActive: true,
      status: 'online'
    }).select('fullName avatar permissions.issueTypes');
    
    res.json({ agents });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch online agents' });
  }
});

// Manager + Super Admin can see agents
router.get('/agents', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const query = includeInactive ? { role: 'agent' } : { role: 'agent', isActive: true };

    const agents = await User.find(query)
      .select('-passwordHash')
      .sort({ fullName: 1 });
    res.json({ agents });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// GET /agents/activity (Manager Live Panel)
router.get('/agents/activity', auth, isManagerOrAbove, async (req, res) => {
  try {
    const agents = await User.find({ role: 'agent' }).select('-passwordHash');
    const Lead = require('../models/Lead');
    const Chat = require('../models/Chat');

    const activityData = await Promise.all(
      agents.map(async (agent) => {
        const activeLeads = await Lead.find({
          assignedAgent: agent._id,
          status: { $in: ['assigned', 'in_progress', 'follow_up', 'interested'] }
        }).select('chatId');

        const Message = require('../models/Message');
        let assignedLeadsCount = 0;
        for (const lead of activeLeads) {
          if (lead.chatId) {
            const hasUnread = await Message.exists({
              chatId: lead.chatId,
              senderRole: 'customer',
              status: { $ne: 'read' }
            });
            if (hasUnread) {
              assignedLeadsCount++;
            }
          }
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const resolvedTodayCount = await Lead.countDocuments({
          assignedAgent: agent._id,
          status: { $in: ['closed', 'converted', 'issue_solved'] },
          updatedAt: { $gte: startOfDay }
        });

        return {
          ...agent.toObject(),
          assignedLeadsCount,
          resolvedTodayCount
        };
      })
    );

    res.json({ agents: activityData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agents activity' });
  }
});

// Force status override by Manager
router.patch('/:id/status/force', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['online', 'break', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Invalid forced status. Must be online, break or offline.' });
    }

    const { updateUserStatus } = require('../utils/activitySystem');
    const io = req.app.get('io');

    const updatedUser = await updateUserStatus(req.params.id, status, io);
    if (!updatedUser) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    res.json({ user: updatedUser.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to force update status' });
  }
});

// Only Super Admin can see managers
router.get('/managers', auth, isAdmin, async (req, res) => {
  try {
    const managers = await User.find({ role: 'manager' })
      .select('-passwordHash')
      .sort({ fullName: 1 });
    res.json({ managers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
});

// Manager + Super Admin see users list
router.get('/', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;
    const query = {};
    
    if (req.user.role === 'manager') {
      // Managers are strictly filtered to agent accounts only
      query.role = 'agent';
    } else if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Manager + Super Admin can create agents
router.post('/agents', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { fullName, mobile, email, password } = req.body;

    if (!fullName || !mobile || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const { avatar } = req.body;

    const user = new User({
      fullName,
      mobile,
      email: email.toLowerCase(),
      passwordHash: password,
      role: 'agent',
      avatar: avatar || '',
      permissions: {
        canSeeLeads: true,
        canManageUsers: false,
        canSeeAnalytics: true,
        canDeleteMessages: true,
        canCloseChats: true,
        canAssignLeads: false,
        canManageBranding: false,
        issueTypes: [],
      },
    });
    await user.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'create_agent',
      entity: 'user',
      entityId: user._id,
      after: user.toJSON(),
      ip: req.ip,
    });

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Only Super Admin can create managers
router.post('/managers', auth, isAdmin, async (req, res) => {
  try {
    const { fullName, mobile, email, password } = req.body;

    if (!fullName || !mobile || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await User.findOne({ mobile });
    if (existing) {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const { avatar } = req.body;

    const user = new User({
      fullName,
      mobile,
      email: email.toLowerCase(),
      passwordHash: password,
      role: 'manager',
      avatar: avatar || '',
    });
    await user.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'create_manager',
      entity: 'user',
      entityId: user._id,
      after: user.toJSON(),
      ip: req.ip,
    });

    res.status(201).json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create manager' });
  }
});

// Update own profile - any authenticated user can update their own details
router.patch('/profile', auth, async (req, res) => {
  try {
    const { fullName, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (fullName) user.fullName = fullName;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update user — Super Admin can update anyone, Manager can update agents only
router.patch('/:id', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { fullName, mobile, email, isActive, role, status } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify super admin' });
    }

    if (req.user.role === 'manager' && user.role !== 'agent') {
      return res.status(403).json({ error: 'Managers can only update agents' });
    }

    if (role && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can change roles' });
    }

    const before = user.toObject();

    if (fullName) user.fullName = fullName;
    if (mobile) user.mobile = mobile;
    if (email) user.email = email.toLowerCase();
    if (typeof isActive === 'boolean') user.isActive = isActive;
    if (role && ['agent', 'manager'].includes(role)) user.role = role;
    if (req.body.avatar !== undefined) user.avatar = req.body.avatar;
    if (req.body.team !== undefined) user.team = req.body.team;
    if (req.body.department !== undefined) user.department = req.body.department;

    if (status && ['online', 'away', 'break', 'offline'].includes(status)) {
      const { updateUserStatus } = require('../utils/activitySystem');
      const io = req.app.get('io');
      await updateUserStatus(user._id, status, io);
    }

    await user.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'update_user',
      entity: 'user',
      entityId: user._id,
      before,
      after: user.toJSON(),
      ip: req.ip,
    });

    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Update user permissions — Super Admin and Manager can update
router.patch('/:id/permissions', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot modify super admin permissions' });
    }

    if (permissions) {
      const currentPerms = user.permissions?.toObject?.() || {};
      user.permissions = { ...currentPerms, ...permissions };
      if (permissions.team !== undefined) user.team = permissions.team;
      if (permissions.department !== undefined) user.department = permissions.department;
      user.markModified('permissions');
      await user.save();
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// DELETE /:id — Delete a user (and all associated data if customer)
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot delete super admin' });
    }

    const Customer = require('../models/Customer');
    const Chat = require('../models/Chat');
    const Lead = require('../models/Lead');
    const Message = require('../models/Message');

    // If it's a customer, clean up all associated data
    if (targetUser.role === 'customer') {
      const customer = await Customer.findOne({ userId: targetUser._id });
      if (customer) {
        const chats = await Chat.find({ customerId: customer._id });
        const chatIds = chats.map(c => c._id);

        // Delete messages in customer chats
        await Message.deleteMany({ chatId: { $in: chatIds } });

        // Delete chats
        await Chat.deleteMany({ customerId: customer._id });

        // Delete leads
        await Lead.deleteMany({ customerId: customer._id });

        // Delete customer record
        await Customer.deleteOne({ _id: customer._id });
      }
    } else if (targetUser.role === 'agent' || targetUser.role === 'manager') {
      // Unassign this agent/manager from chats and leads
      await Chat.updateMany({ agentId: targetUser._id }, { $unset: { agentId: "" } });
      await Lead.updateMany({ assignedAgent: targetUser._id }, { $unset: { assignedAgent: "" }, $pull: { assignedAgents: targetUser._id } });
      await Customer.updateMany({ assignedAgent: targetUser._id }, { $unset: { assignedAgent: "" } });
    }

    await User.deleteOne({ _id: targetUser._id });

    await AuditLog.create({
      userId: req.user._id,
      action: 'delete_user',
      entity: 'user',
      entityId: targetUser._id,
      before: targetUser.toObject(),
      ip: req.ip,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
