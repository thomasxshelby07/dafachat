const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove, isAdmin } = require('../middleware/roleCheck');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

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
    if (status && ['online', 'away', 'break'].includes(status)) user.status = status;
    if (role && ['agent', 'manager'].includes(role)) user.role = role;
    if (req.body.avatar !== undefined) user.avatar = req.body.avatar;

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
      user.markModified('permissions');
      await user.save();
    }

    res.json({ user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});

// Delete/deactivate — Super Admin can remove anyone, Manager can remove agents
router.delete('/:id', auth, isManagerOrAbove, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'super_admin') {
      return res.status(403).json({ error: 'Cannot deactivate super admin' });
    }

    if (req.user.role === 'manager' && user.role !== 'agent') {
      return res.status(403).json({ error: 'Managers can only deactivate agents' });
    }

    user.isActive = false;
    await user.save();

    await AuditLog.create({
      userId: req.user._id,
      action: 'deactivate_user',
      entity: 'user',
      entityId: user._id,
      before: { isActive: true },
      after: { isActive: false },
      ip: req.ip,
    });

    res.json({ message: 'User deactivated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

module.exports = router;
