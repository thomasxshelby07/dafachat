const express = require('express');
const auth = require('../middleware/auth');
const { isAgentOrAbove, isManagerOrAbove, isAdmin } = require('../middleware/roleCheck');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Notification = require('../models/Notification');

const router = express.Router();

const getRedisSafe = (app) => {
  try {
    return app.get('redis');
  } catch (e) {
    return null;
  }
};

const getSocketId = async (app, userId) => {
  const redis = getRedisSafe(app);
  if (redis && typeof redis.get === 'function') {
    try {
      return await redis.get(`user_socket:${userId}`);
    } catch (e) {}
  }
  return null;
};

router.get('/', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, agent, search, startDate, endDate, tag, customerId } = req.query;
    const query = {};

    if (customerId) {
      query.customerId = customerId;
    }

    if (req.user.role === 'agent') {
      if (!customerId) {
        query.assignedAgent = req.user._id;
      }
    } else if (agent) {
      query.assignedAgent = agent;
    }

    if (status) query.status = status;
    if (tag) query.tags = tag;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search) {
      const customers = await Customer.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
          { customerId: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.customerId = { $in: customers.map(c => c._id) };
    }

    const leads = await Lead.find(query)
      .populate('customerId', 'fullName mobile customerId lastSeen dafaxbetId')
      .populate('assignedAgent', 'fullName mobile')
      .sort({ lastActivity: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Lead.countDocuments(query);

    res.json({
      leads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

router.get('/export', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { status, agent, search, startDate, endDate, tag } = req.query;
    const query = {};

    if (req.user.role === 'agent') {
      query.assignedAgent = req.user._id;
    } else if (agent) {
      query.assignedAgent = agent;
    }

    if (status) query.status = status;
    if (tag) query.tags = tag;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
    }

    if (search) {
      const customers = await Customer.find({
        $or: [
          { fullName: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
          { customerId: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      query.customerId = { $in: customers.map(c => c._id) };
    }

    const leads = await Lead.find(query)
      .populate('customerId', 'fullName mobile customerId registrationDate lastSeen dafaxbetId')
      .populate('assignedAgent', 'fullName')
      .sort({ createdAt: -1 });

    let csv = 'Customer Name,Customer ID,Dafabet ID,Mobile,Registration Date,Status,Issue Type,Priority,Assigned Agent,Tags,Created At\n';

    leads.forEach(l => {
      const row = [
        `"${(l.customerId?.fullName || '').replace(/"/g, '""')}"`,
        `"${(l.customerId?.customerId || '').replace(/"/g, '""')}"`,
        `"${(l.customerId?.dafaxbetId || '').replace(/"/g, '""')}"`,
        `"${(l.customerId?.mobile || '').replace(/"/g, '""')}"`,
        l.customerId?.registrationDate ? new Date(l.customerId.registrationDate).toISOString() : '',
        `"${l.status}"`,
        `"${l.issueType}"`,
        `"${l.priority}"`,
        `"${(l.assignedAgent?.fullName || 'Unassigned').replace(/"/g, '""')}"`,
        `"${(l.tags || []).join(', ')}"`,
        new Date(l.createdAt).toISOString()
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads_export_${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export leads' });
  }
});

router.get('/:id', auth, isAgentOrAbove, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('customerId', 'fullName mobile customerId registrationDate lastSeen dafaxbetId')
      .populate('assignedAgent', 'fullName mobile')
      .populate('timeline.by', 'fullName')
      .populate('internalNotes.by', 'fullName');

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

router.patch('/:id/status', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { status } = req.body;
    let lead = await Lead.findById(req.params.id);

    if (!lead) {
      // Fallback: search by customerId if id was passed as customerId
      lead = await Lead.findOne({ customerId: req.params.id });
    }

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const validStatuses = ['new', 'assigned', 'in_progress', 'follow_up', 'interested', 'converted', 'closed', 'deposit_done', 'withdrawal_done', 'issue_solved', 'issue_not_solved'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const oldStatus = lead.status;
    lead.status = status;
    lead.timeline.push({
      event: `Status changed from ${oldStatus} to ${status}`,
      date: new Date(),
      by: req.user._id,
    });
    lead.lastActivity = new Date();
    await lead.save();

    await Customer.findByIdAndUpdate(lead.customerId, { leadStatus: status });

    const io = req.app.get('io');
    if (io) {
      io.emit('lead_updated', { lead });
      if (lead.assignedAgent) {
        const agentSocket = await getSocketId(req.app, lead.assignedAgent);
        if (agentSocket) {
          io.to(agentSocket).emit('lead_status_updated', {
            leadId: lead._id,
            status,
            oldStatus,
          });
        }
      }
    }

    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update lead status' });
  }
});

router.post('/:id/assign', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { agentId } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') {
      return res.status(400).json({ error: 'Invalid agent' });
    }

    // Set active agent to only this agentId
    lead.assignedAgents = [agentId];

    // Also set primary agent
    const oldAgent = lead.assignedAgent;
    lead.assignedAgent = agentId;
    lead.status = 'assigned';
    lead.timeline.push({
      event: `Lead assigned to ${agent.fullName}`,
      date: new Date(),
      by: req.user._id,
    });
    lead.lastActivity = new Date();
    await lead.save();

    await Customer.findByIdAndUpdate(lead.customerId, {
      assignedAgent: agentId,
      leadStatus: 'assigned',
    });

    await Chat.findOneAndUpdate(
      { customerId: lead.customerId },
      { agentId }
    );

    const notification = new Notification({
      userId: agentId,
      type: 'lead_assigned',
      title: 'New Lead Assigned',
      body: `You have been assigned a new lead`,
      metadata: { leadId: lead._id },
    });
    await notification.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('lead_updated', { lead });
    }
    const agentSocket = await getSocketId(req.app, agentId);
    if (agentSocket) {
      io.to(agentSocket).emit('new_lead', {
        lead: lead.toObject(),
        assignedBy: req.user.fullName,
      });
    }

    if (oldAgent && oldAgent.toString() !== agentId) {
      const oldAgentSocket = await getSocketId(req.app, oldAgent);
      if (oldAgentSocket) {
        io.to(oldAgentSocket).emit('lead_reassigned', {
          leadId: lead._id,
          newAgent: agent.fullName,
        });
      }
    }

    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to assign lead' });
  }
});

router.post('/auto-assign', auth, isManagerOrAbove, async (req, res) => {
  try {
    const unassignedLeads = await Lead.find({ status: 'new', assignedAgent: null })
      .limit(10);

    let assignableUsers = await User.find({ role: 'agent', isActive: true, status: 'online' });
    if (assignableUsers.length === 0) {
      assignableUsers = await User.find({ role: 'manager', isActive: true, status: 'online' });
    }
    if (assignableUsers.length === 0) {
      assignableUsers = await User.find({ role: 'super_admin', isActive: true, status: 'online' });
    }

    if (assignableUsers.length === 0) {
      return res.json({ assigned: 0, message: 'No support users available' });
    }

    let assignedCount = 0;
    for (let i = 0; i < unassignedLeads.length; i++) {
      const agent = assignableUsers[i % assignableUsers.length];
      const lead = unassignedLeads[i];

      lead.assignedAgent = agent._id;
      lead.status = 'assigned';
      lead.timeline.push({
        event: `Auto-assigned to ${agent.fullName} (Round Robin)`,
        date: new Date(),
        by: req.user._id,
      });
      lead.lastActivity = new Date();
      await lead.save();

      await Customer.findByIdAndUpdate(lead.customerId, {
        assignedAgent: agent._id,
        leadStatus: 'assigned',
      });

      assignedCount++;
    }

    res.json({ assigned: assignedCount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to auto-assign leads' });
  }
});

router.post('/:id/transfer', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { agentId, reason } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (req.user.role === 'agent' && lead.assignedAgent?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'You can only transfer your own leads' });
    }

    const newAgent = await User.findById(agentId);
    if (!newAgent || newAgent.role !== 'agent') {
      return res.status(400).json({ error: 'Invalid agent' });
    }

    const oldAgentId = lead.assignedAgent;
    lead.assignedAgent = agentId;
    lead.status = 'assigned';
    lead.timeline.push({
      event: `Lead transferred to ${newAgent.fullName}${reason ? `: ${reason}` : ''}`,
      date: new Date(),
      by: req.user._id,
    });
    lead.lastActivity = new Date();
    await lead.save();

    await Customer.findByIdAndUpdate(lead.customerId, {
      assignedAgent: agentId,
      leadStatus: 'assigned',
    });

    await Chat.findOneAndUpdate(
      { customerId: lead.customerId },
      { agentId }
    );

    const notification = new Notification({
      userId: agentId,
      type: 'lead_assigned',
      title: 'Lead Transferred to You',
      body: `A lead has been transferred to you${reason ? `: ${reason}` : ''}`,
      metadata: { leadId: lead._id, transferredBy: req.user._id },
    });
    await notification.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('lead_updated', { lead });
    }
    const newAgentSocket = await getSocketId(req.app, agentId);
    if (newAgentSocket) {
      io.to(newAgentSocket).emit('new_lead', {
        lead: lead.toObject(),
        transferredBy: req.user.fullName,
      });
    }

    if (oldAgentId) {
      const oldAgentSocket = await getSocketId(req.app, oldAgentId);
      if (oldAgentSocket) {
        io.to(oldAgentSocket).emit('lead_reassigned', {
          leadId: lead._id,
          newAgent: newAgent.fullName,
        });
      }
    }

    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to transfer lead' });
  }
});

router.post('/:id/notes', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { text } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    lead.internalNotes.push({
      text,
      by: req.user._id,
      date: new Date(),
    });
    lead.lastActivity = new Date();
    await lead.save();

    const updatedLead = await Lead.findById(req.params.id)
      .populate('internalNotes.by', 'fullName');

    res.json({ lead: updatedLead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add note' });
  }
});

router.patch('/:id/notes/:noteId', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { text } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const note = lead.internalNotes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Only the author or super_admin can edit
    if (note.by.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'You can only edit your own notes' });
    }

    note.text = text;
    note.editedAt = new Date();
    note.editedBy = req.user._id;
    lead.lastActivity = new Date();
    await lead.save();

    const updatedLead = await Lead.findById(req.params.id)
      .populate('internalNotes.by', 'fullName')
      .populate('internalNotes.editedBy', 'fullName');

    res.json({ lead: updatedLead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id/notes/:noteId', auth, isAgentOrAbove, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const note = lead.internalNotes.id(req.params.noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Only the author or super_admin can delete
    if (note.by.toString() !== req.user._id.toString() && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }

    lead.internalNotes.pull(req.params.noteId);
    lead.lastActivity = new Date();
    await lead.save();

    const updatedLead = await Lead.findById(req.params.id)
      .populate('internalNotes.by', 'fullName');

    res.json({ lead: updatedLead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

router.post('/:id/tags', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { tag } = req.body;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    lead.tags = lead.tags || [];
    if (!lead.tags.includes(tag)) {
      lead.tags.push(tag);
      await Customer.findByIdAndUpdate(lead.customerId, {
        $addToSet: { tags: tag },
      });
    }

    await lead.save();
    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

router.delete('/:id/tags/:tag', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { tag } = req.params;
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    lead.tags = (lead.tags || []).filter(t => t !== tag);
    await lead.save();

    await Customer.findByIdAndUpdate(lead.customerId, {
      $pull: { tags: tag },
    });

    res.json({ lead });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// DELETE /:id — Delete a lead and all associated customer data
router.delete('/:id', auth, isAdmin, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const customerId = lead.customerId;
    const customer = await Customer.findById(customerId);
    if (customer) {
      // Delete user
      if (customer.userId) {
        await User.deleteOne({ _id: customer.userId });
      }

      // Delete chats and messages
      const Message = require('../models/Message');
      const chats = await Chat.find({ customerId: customer._id });
      const chatIds = chats.map(c => c._id);
      await Message.deleteMany({ chatId: { $in: chatIds } });
      await Chat.deleteMany({ customerId: customer._id });

      // Delete customer
      await Customer.deleteOne({ _id: customer._id });
    }

    // Delete lead
    await Lead.deleteOne({ _id: lead._id });

    // Create Audit Log
    const AuditLog = require('../models/AuditLog');
    await AuditLog.create({
      userId: req.user._id,
      action: 'delete_lead',
      entity: 'lead',
      entityId: lead._id,
      before: lead.toObject(),
      ip: req.ip,
    });

    res.json({ message: 'Lead and associated customer data deleted successfully' });
  } catch (error) {
    console.error('Lead delete error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// POST /:id/upgrade-client — Upgrade a lead to client by assigning a Dafa ID
router.post('/:id/upgrade-client', auth, isAgentOrAbove, async (req, res) => {
  try {
    const { dafaxbetId, password } = req.body;
    if (!dafaxbetId || !dafaxbetId.trim()) {
      return res.status(400).json({ error: 'Dafa ID is required' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const customer = await Customer.findById(lead.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check if Dafa ID is already taken
    const existingCustomer = await Customer.findOne({
      dafaxbetId: { $regex: new RegExp('^' + dafaxbetId.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
    });
    if (existingCustomer) {
      return res.status(409).json({ error: 'This Dafa ID is already registered' });
    }

    // Update Customer
    customer.dafaxbetId = dafaxbetId.trim();
    await customer.save();

    // Update User
    if (customer.userId) {
      await User.findByIdAndUpdate(customer.userId, { fullName: dafaxbetId.trim() });
    }

    const hadDafaId = !!lead.requestedDafaId;

    // Update Lead status
    lead.status = 'converted';
    lead.requestedDafaId = undefined;
    lead.timeline.push({
      event: `Lead upgraded to Client with Dafa ID: ${dafaxbetId.trim()}`,
      date: new Date(),
      by: req.user._id,
    });
    await lead.save();

    // Send automatic message in the chat
    if (lead.chatId) {
      const Message = require('../models/Message');
      const Settings = require('../models/Settings');

      // Fetch siteLoginLink from settings
      let siteLoginLink = null;
      try {
        const siteLinkSetting = await Settings.findOne({ group: 'homepage', key: 'siteLoginLink' });
        if (siteLinkSetting && siteLinkSetting.value && siteLinkSetting.value !== '#') {
          siteLoginLink = siteLinkSetting.value;
        }
      } catch (e) {}

      // Build the chat message
      let msgContent = '';
      if (hadDafaId) {
        msgContent = `Now you connect with customer support\n\n[Chat with Customer Support](#chat-with-support)`;
      } else {
        msgContent = `Congratulations! Your Dafa Gaming ID has been created.\n\n`;
        msgContent += `**Dafa ID / Username:** ${dafaxbetId.trim()}\n`;
        if (password && password.trim()) {
          msgContent += `**Password:** ${password.trim()}\n`;
        }
        msgContent += `\n`;
        msgContent += `You can start playing now. You have been granted 24x7 full Customer Support. No need to log out, you can now access deposit and withdrawal support directly from the dashboard.\n\n`;
        if (siteLoginLink) {
          msgContent += `[Play Now on Game Site](${siteLoginLink})`;
        }
      }

      const systemMsg = new Message({
        chatId: lead.chatId,
        senderId: req.user._id,
        senderRole: 'agent',
        content: msgContent,
        type: 'text'
      });
      await systemMsg.save();

      // Emit to socket
      const io = req.app.get('io');
      if (io) {
        io.to(lead.chatId.toString()).emit('new_message', systemMsg.toObject ? systemMsg.toObject() : systemMsg);
        io.to(lead.chatId.toString()).emit('lead_upgraded', {
          dafaxbetId: dafaxbetId.trim(),
          mobile: customer.mobile,
        });
        io.to(lead.chatId.toString()).emit('lead_updated', { lead });
      }
    }

    res.json({ message: 'Lead upgraded to client successfully', dafaxbetId: dafaxbetId.trim() });
  } catch (error) {
    console.error('Lead upgrade error:', error);
    res.status(500).json({ error: 'Failed to upgrade lead' });
  }
});

// POST /:id/reject-verification — Reject a verification request
router.post('/:id/reject-verification', auth, isAgentOrAbove, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const customer = await Customer.findById(lead.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update Lead status to verification_failed
    lead.status = 'verification_failed';
    lead.timeline.push({
      event: `Lead verification rejected/failed`,
      date: new Date(),
      by: req.user._id,
    });
    await lead.save();

    // Update Customer status
    customer.leadStatus = 'verification_failed';
    await customer.save();

    // Send automatic message in the chat
    if (lead.chatId) {
      const Message = require('../models/Message');

      const systemMsg = new Message({
        chatId: lead.chatId,
        senderId: req.user._id,
        senderRole: 'agent',
        content: `❌ We couldn't verify your details. Please check your Dafa Gaming ID and registered mobile number, or contact our support team for assistance.`,
        type: 'text'
      });
      await systemMsg.save();

      // Emit to socket
      const io = req.app.get('io');
      if (io) {
        io.to(lead.chatId.toString()).emit('new_message', systemMsg.toObject ? systemMsg.toObject() : systemMsg);
        io.to(lead.chatId.toString()).emit('lead_verification_failed', {
          leadId: lead._id,
          customerId: customer._id,
        });
        io.to(lead.chatId.toString()).emit('lead_updated', { lead });
      }
    }

    res.json({ message: 'Lead verification rejected successfully' });
  } catch (error) {
    console.error('Lead reject verification error:', error);
    res.status(500).json({ error: 'Failed to reject verification' });
  }
});


// POST /request-link — Submit a request to link an existing Dafa ID (Requires verification by agent)
router.post('/request-link', auth, async (req, res) => {
  try {
    const { dafaxbetId } = req.body;
    if (!dafaxbetId || !dafaxbetId.trim()) {
      return res.status(400).json({ error: 'Dafa ID is required' });
    }

    const customer = await Customer.findOne({ userId: req.user._id });
    if (!customer) {
      return res.status(404).json({ error: 'Customer profile not found' });
    }

    if (customer.dafaxbetId && customer.dafaxbetId.trim() !== '') {
      return res.status(400).json({ error: 'Your account is already linked to a Dafa ID' });
    }

    // Check if this Dafa ID is already taken by another customer profile
    const existingCustomer = await Customer.findOne({
      dafaxbetId: { $regex: new RegExp('^' + dafaxbetId.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
    });
    if (existingCustomer) {
      return res.status(409).json({ error: 'This Dafa ID is already registered' });
    }

    // Find or create a lead associated with this customer
    let lead = await Lead.findOne({ customerId: customer._id });
    if (!lead) {
      lead = new Lead({
        customerId: customer._id,
        status: 'new',
        issueType: 'verify_id',
      });
    }

    // Set the requested ID and status
    lead.requestedDafaId = dafaxbetId.trim();
    lead.status = 'verification_pending';
    lead.timeline.push({
      event: `Customer requested to link Dafa ID: ${dafaxbetId.trim()}`,
      date: new Date(),
      by: req.user._id,
    });
    await lead.save();

    customer.leadStatus = 'verification_pending';
    await customer.save();

    // Check if chat room exists, if not create one
    let chatId = lead.chatId;
    if (!chatId) {
      const Chat = require('../models/Chat');
      let chat = await Chat.findOne({ customerId: customer._id, status: 'active' });
      if (!chat) {
        chat = new Chat({
          customerId: customer._id,
          status: 'active',
          issueType: 'verify_id',
        });
        await chat.save();
      }
      chatId = chat._id;
      lead.chatId = chatId;
      await lead.save();
    }

    // Send automatic request message in the chat
    const Message = require('../models/Message');
    const systemMsg = new Message({
      chatId: chatId,
      senderId: req.user._id,
      senderRole: 'customer',
      content: `🔑 **Dafa ID Verification Request**:\nSir, I have requested to link my existing Dafa ID: **${dafaxbetId.trim()}**. Please verify and link my account.\n\nसर, मैंने अपनी मौजूदा दाफा आईडी: **${dafaxbetId.trim()}** को लिंक करने का अनुरोध किया है। कृपया जांचें और लिंक करें।`,
      type: 'text'
    });
    await systemMsg.save();

    // Emit message to room
    const io = req.app.get('io');
    if (io) {
      io.to(chatId.toString()).emit('new_message', systemMsg.toObject ? systemMsg.toObject() : systemMsg);
      io.to(chatId.toString()).emit('lead_updated', { lead });
    }

    res.json({ message: 'Request submitted successfully', requestedDafaId: dafaxbetId.trim(), chatId });
  } catch (error) {
    console.error('Request Dafa ID link error:', error);
    res.status(500).json({ error: 'Failed to submit verification request' });
  }
});

module.exports = router;
