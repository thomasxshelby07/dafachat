const User = require('../models/User');
const Lead = require('../models/Lead');
const Chat = require('../models/Chat');
const Customer = require('../models/Customer');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const AgentActivityLog = require('../models/AgentActivityLog');
const logger = require('./logger');

async function logHistoricalStatus(userId, status, startedAt, endedAt) {
  try {
    const duration = Math.round((endedAt - startedAt) / 1000);
    if (duration <= 0) return;

    // Format date in local YYYY-MM-DD
    const offset = startedAt.getTimezoneOffset();
    const localStarted = new Date(startedAt.getTime() - (offset * 60 * 1000));
    const dateStr = localStarted.toISOString().split('T')[0];

    // Find or create daily log
    let dailyLog = await AgentActivityLog.findOne({ userId, date: dateStr });
    if (!dailyLog) {
      dailyLog = new AgentActivityLog({
        userId,
        date: dateStr,
        activeTime: 0,
        breakTime: 0,
        statusLogs: [],
      });
    }

    // Accumulate daily totals
    if (status === 'online') {
      dailyLog.activeTime += duration;
    } else if (status === 'break') {
      dailyLog.breakTime += duration;
    }

    // Add detailed status log segment
    dailyLog.statusLogs.push({
      status,
      startedAt,
      endedAt,
      duration,
    });

    await dailyLog.save();
  } catch (err) {
    logger.error('Error logging historical status:', err);
  }
}

// Store active reassignment timers: { [leadId]: setTimeoutInstance }
const reassignmentTimers = {};

/**
 * Update user status and accumulate active/break timers.
 */
async function updateUserStatus(userId, newStatus, io) {
  try {
    const user = await User.findById(userId);
    if (!user) return null;

    const oldStatus = user.status;
    if (oldStatus === newStatus) return user;

    const now = new Date();
    const statusChangedAt = user.statusChangedAt || user.updatedAt || now;

    // Accumulate time in previous status if it was on the same calendar day
    const isSameDay = now.toDateString() === statusChangedAt.toDateString();
    const diffSeconds = Math.round((now - statusChangedAt) / 1000);

    if (diffSeconds > 0) {
      if (isSameDay) {
        if (oldStatus === 'online') {
          user.todayActiveTime = (user.todayActiveTime || 0) + diffSeconds;
        } else if (oldStatus === 'break') {
          user.todayBreakTime = (user.todayBreakTime || 0) + diffSeconds;
        }
      } else {
        // If it crosses midnight, reset the timers for the new day
        user.todayActiveTime = 0;
        user.todayBreakTime = 0;
      }
      // Log status session historically
      await logHistoricalStatus(userId, oldStatus, statusChangedAt, now);
    }

    user.status = newStatus;
    user.statusChangedAt = now;
    user.lastActivityAt = now;
    await user.save();

    // Broadcast status change
    if (io) {
      io.emit('agent_status_changed', {
        userId: user._id,
        status: newStatus,
        fullName: user.fullName,
        team: user.team,
        department: user.department,
        todayActiveTime: user.todayActiveTime,
        todayBreakTime: user.todayBreakTime,
        lastActivityAt: user.lastActivityAt,
      });
    }

    // Handle transitions
    if (newStatus === 'break' || newStatus === 'offline') {
      // Trigger grace period for all active leads assigned to this agent
      await handleAgentGoesBreak(user, io);
    } else if (newStatus === 'online') {
      // Cancel any pending grace period reassignment timers and restore temporary leads
      await handleAgentGoesOnline(user, io);
    }

    return user;
  } catch (error) {
    logger.error('Error in updateUserStatus:', error);
    return null;
  }
}

/**
 * Handle when agent goes online/active: clear any pending reassignment timers and restore temporary leads
 */
async function handleAgentGoesOnline(user, io) {
  const activeLeads = await Lead.find({
    assignedAgent: user._id,
    status: { $in: ['assigned', 'in_progress', 'follow_up', 'interested'] }
  });

  for (const lead of activeLeads) {
    const leadIdStr = lead._id.toString();
    if (reassignmentTimers[leadIdStr]) {
      clearTimeout(reassignmentTimers[leadIdStr]);
      delete reassignmentTimers[leadIdStr];
      logger.info(`Cancelled reassignment grace period for lead ${leadIdStr} as agent ${user.fullName} is active`);
    }
  }

  // Restore temporarily reassigned leads back to this agent!
  try {
    const tempLeads = await Lead.find({
      originalAgent: user._id,
      assignedAgent: { $ne: user._id },
      status: { $in: ['assigned', 'in_progress', 'follow_up', 'interested'] }
    }).populate('customerId');

    for (const lead of tempLeads) {
      const oldAgentId = lead.assignedAgent;
      lead.assignedAgent = user._id;
      lead.originalAgent = undefined; // clear originalAgent reference
      lead.timeline.push({
        event: `Lead returned to original agent ${user.fullName} (Agent came back online)`,
        date: new Date(),
        by: user._id,
      });
      await lead.save();

      // Update customer & chat
      await Customer.findByIdAndUpdate(lead.customerId._id, { assignedAgent: user._id });
      if (lead.chatId) {
        await Chat.findByIdAndUpdate(lead.chatId, { agentId: user._id });
        if (io) {
          io.to(lead.chatId.toString()).emit('agent_assigned', {
            agentName: user.fullName,
            chatId: lead.chatId
          });
        }
      }
      logger.info(`Restored lead ${lead._id} back to original agent ${user.fullName} from agent ${oldAgentId}`);
    }
  } catch (error) {
    logger.error('Error restoring leads to returned agent:', error);
  }

  // Fetch and auto-allot any unassigned leads waiting in the queue
  try {
    const unassignedLeads = await Lead.find({
      status: 'new',
      assignedAgent: null
    }).populate('customerId');

    for (const lead of unassignedLeads) {
      const category = lead.issueType || 'other';

      // Check if agent handles this category
      const handlesCategory = !user.permissions?.issueTypes || 
                             user.permissions.issueTypes.length === 0 || 
                             user.permissions.issueTypes.includes(category);

      if (handlesCategory) {
        lead.assignedAgent = user._id;
        lead.assignedAgents = [user._id];
        lead.status = 'assigned';
        lead.timeline.push({
          event: `Lead auto-assigned to ${user.fullName} from queue (Agent came online)`,
          date: new Date(),
          by: user._id
        });
        lead.lastActivity = new Date();
        await lead.save();

        await Customer.findByIdAndUpdate(lead.customerId._id, {
          assignedAgent: user._id,
          leadStatus: 'assigned'
        });

        if (lead.chatId) {
          await Chat.findByIdAndUpdate(lead.chatId, { agentId: user._id });
          if (io) {
            io.to(lead.chatId.toString()).emit('agent_assigned', {
              agentName: user.fullName,
              chatId: lead.chatId
            });
          }
        }

        // Notify agent via DB notification & sockets
        const agentNotif = new Notification({
          userId: user._id,
          type: 'agent_assigned',
          title: 'Queued Chat Assigned',
          body: `Queued lead for ${lead.customerId?.fullName || 'Customer'} automatically assigned to you.`,
          metadata: { chatId: lead.chatId, customerId: lead.customerId?._id },
        });
        await agentNotif.save();

        if (io) {
          io.emit('new_notification', agentNotif);
          io.emit('new_chat_assigned', {
            chatId: lead.chatId,
            customer: lead.customerId?.toObject(),
            issueType: lead.issueType,
            message: `Lead auto-assigned from queue.`
          });
        }

        logger.info(`Auto-assigned queued lead ${lead._id} to newly online agent ${user.fullName}`);
      }
    }
  } catch (error) {
    logger.error('Error auto-allotting queued leads on agent online:', error);
  }
}

/**
 * Handle when agent goes on break: start grace period reassignment timer (default 2 mins)
 */
async function handleAgentGoesBreak(user, io) {
  const activeLeads = await Lead.find({
    assignedAgent: user._id,
    status: { $in: ['assigned', 'in_progress', 'follow_up', 'interested'] }
  }).populate('customerId');

  // Send notification to manager that agent is offline/on break
  await notifyManagers(
    'agent_break',
    `Agent ${user.status === 'offline' ? 'Offline' : 'on Break'}`,
    `${user.fullName} went ${user.status || 'offline'}. Their active leads with pending messages have been instantly reassigned.`,
    { userId: user._id, fullName: user.fullName },
    io
  );

  // Notify customer of agent going on break
  let compName = 'SUPPORT';
  try {
    const compSetting = await Settings.findOne({ key: 'branding' });
    if (compSetting?.value?.companyName) {
      compName = `${compSetting.value.companyName.toUpperCase()} SUPPORT`;
    }
  } catch (e) {}

  for (const lead of activeLeads) {
    if (lead.chatId) {
      const customer = lead.customerId;
      if (customer) {
        io.to(lead.chatId.toString()).emit('agent_on_break', {
          chatId: lead.chatId,
          message: `Your agent is on break. ${compName} will assist you shortly.`,
        });
      }
    }
  }

  for (const lead of activeLeads) {
    const leadIdStr = lead._id.toString();

    // Clear existing timer if any
    if (reassignmentTimers[leadIdStr]) {
      clearTimeout(reassignmentTimers[leadIdStr]);
      delete reassignmentTimers[leadIdStr];
    }

    logger.info(`Instantly reassigning lead ${leadIdStr} as agent went offline/on break`);
    await reassignLead(lead._id, user, io);
  }
}

/**
 * Find the best candidate with least chats from candidates list
 */
async function findBestCandidate(query) {
  const candidates = await User.find(query);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const counts = await Promise.all(
    candidates.map(async (cand) => {
      const count = await Chat.countDocuments({ agentId: cand._id, status: 'active' });
      return { cand, count };
    })
  );
  counts.sort((a, b) => a.count - b.count);
  return counts[0].cand;
}

/**
 * Reassign lead to a new agent following reassignment priority
 */
async function reassignLead(leadId, oldAgent, io) {
  try {
    const lead = await Lead.findById(leadId).populate('customerId');
    if (!lead || lead.status === 'closed' || lead.status === 'converted') return;

    // Check if auto reassignment is enabled
    let enableAutoReassignment = true;
    try {
      const reassignSetting = await Settings.findOne({ key: 'enableAutoReassignment' });
      if (reassignSetting && typeof reassignSetting.value === 'boolean') {
        enableAutoReassignment = reassignSetting.value;
      }
    } catch (e) {}

    if (!enableAutoReassignment) {
      logger.info(`Auto reassignment is disabled. Lead ${leadId} remains with ${oldAgent.fullName}`);
      return;
    }

    let newAgent = null;
    const category = lead.issueType || 'other';

    // Helper query constructor for issueTypes match (matches category, empty array, or empty key)
    const buildCategoryQuery = (cat) => ({
      $or: [
        { 'permissions.issueTypes': cat },
        { 'permissions.issueTypes': { $size: 0 } },
        { 'permissions.issueTypes': { $exists: false } }
      ]
    });

    // Priority 1: Same Category + Same Team Active Agent
    if (oldAgent.team) {
      newAgent = await findBestCandidate({
        role: 'agent',
        isActive: true,
        status: 'online',
        team: oldAgent.team,
        _id: { $ne: oldAgent._id },
        ...buildCategoryQuery(category)
      });
    }

    // Priority 2: Same Category + Same Department Active Agent
    if (!newAgent && oldAgent.department) {
      newAgent = await findBestCandidate({
        role: 'agent',
        isActive: true,
        status: 'online',
        department: oldAgent.department,
        _id: { $ne: oldAgent._id },
        ...buildCategoryQuery(category)
      });
    }

    // Priority 3: Same Category + Any Active Agent
    if (!newAgent) {
      newAgent = await findBestCandidate({
        role: 'agent',
        isActive: true,
        status: 'online',
        _id: { $ne: oldAgent._id },
        ...buildCategoryQuery(category)
      });
    }

    // Priority 4: General/Other Category + Same Team Active Agent
    if (!newAgent && category !== 'other' && oldAgent.team) {
      newAgent = await findBestCandidate({
        role: 'agent',
        isActive: true,
        status: 'online',
        team: oldAgent.team,
        _id: { $ne: oldAgent._id },
        ...buildCategoryQuery('other')
      });
    }

    // Priority 5: General/Other Category + Same Department Active Agent
    if (!newAgent && category !== 'other' && oldAgent.department) {
      newAgent = await findBestCandidate({
        role: 'agent',
        isActive: true,
        status: 'online',
        department: oldAgent.department,
        _id: { $ne: oldAgent._id },
        ...buildCategoryQuery('other')
      });
    }

    // Priority 6: General/Other Category + Any Active Agent
    if (!newAgent && category !== 'other') {
      newAgent = await findBestCandidate({
        role: 'agent',
        isActive: true,
        status: 'online',
        _id: { $ne: oldAgent._id },
        ...buildCategoryQuery('other')
      });
    }

    // Priority 7: Any Active Agent regardless of category
    if (!newAgent) {
      newAgent = await findBestCandidate({
        role: 'agent',
        isActive: true,
        status: 'online',
        _id: { $ne: oldAgent._id }
      });
    }

    // Save the old agent as the original agent before reassigning!
    if (!lead.originalAgent) {
      lead.originalAgent = oldAgent._id;
    }

    const customerName = lead.customerId?.fullName || 'Customer';

    if (newAgent) {
      logger.info(`Reassigning lead ${leadId} from ${oldAgent.fullName} to ${newAgent.fullName}`);

      // Perform assignment updates
      lead.assignedAgent = newAgent._id;
      lead.assignedAgents = [newAgent._id];
      lead.status = 'assigned';
      lead.timeline.push({
        event: `Lead auto-reassigned from ${oldAgent.fullName} to ${newAgent.fullName} (Grace period expired)`,
        date: new Date(),
        by: oldAgent._id, // triggered by break
      });
      lead.lastActivity = new Date();
      await lead.save();

      // Update customer & chat
      await Customer.findByIdAndUpdate(lead.customerId, {
        assignedAgent: newAgent._id,
        leadStatus: 'assigned',
      });

      if (lead.chatId) {
        await Chat.findByIdAndUpdate(lead.chatId, { agentId: newAgent._id });

        // Emit to chat room
        if (io) {
          io.to(lead.chatId.toString()).emit('agent_assigned', {
            agentName: newAgent.fullName,
            chatId: lead.chatId,
          });
        }
      }

      // Notify managers
      await notifyManagers(
        'lead_reassigned',
        'Lead Reassigned',
        `Lead for ${customerName} reassigned from ${oldAgent.fullName} to ${newAgent.fullName} due to agent break.`,
        { leadId, oldAgentId: oldAgent._id, newAgentId: newAgent._id },
        io
      );

      // Notify new agent
      const agentNotif = new Notification({
        userId: newAgent._id,
        type: 'lead_assigned',
        title: 'New Lead Auto-Assigned',
        body: `Lead for ${customerName} was reassigned to you.`,
        metadata: { leadId: lead._id },
      });
      await agentNotif.save();

      if (io) {
        io.emit('new_lead', {
          lead: lead.toObject(),
          assignedBy: 'System (Auto-Reassignment)',
        });
      }
    } else {
      // Priority 5: Go to Lead Queue
      logger.info(`No active agents available. Lead ${leadId} sent back to queue.`);

      lead.assignedAgent = null;
      lead.assignedAgents = [];
      lead.status = 'new';
      lead.timeline.push({
        event: `Lead unassigned from ${oldAgent.fullName} (Grace period expired, no active agents available)`,
        date: new Date(),
        by: oldAgent._id,
      });
      lead.lastActivity = new Date();
      await lead.save();

      await Customer.findByIdAndUpdate(lead.customerId, {
        assignedAgent: null,
        leadStatus: 'new',
      });

      if (lead.chatId) {
        let compName = 'SUPPORT';
        try {
          const compSetting = await Settings.findOne({ key: 'branding' });
          if (compSetting?.value?.companyName) {
            compName = `${compSetting.value.companyName.toUpperCase()} SUPPORT`;
          }
        } catch (e) {}

        await Chat.findByIdAndUpdate(lead.chatId, { agentId: null });
        if (io) {
          io.to(lead.chatId.toString()).emit('agent_assigned', {
            agentName: compName,
            chatId: lead.chatId,
          });
        }
      }

      // Alert managers about unassigned lead & no active agent
      await notifyManagers(
        'no_active_agent_alert',
        'No Active Agents Available',
        `Alert: Lead for ${customerName} went to queue. No active agents are online.`,
        { leadId },
        io
      );
    }
  } catch (error) {
    logger.error('Error in reassignLead:', error);
  }
}

/**
 * Trigger grace period reassignment timer for a specific lead if its agent goes offline/break
 */
async function triggerGracePeriodForLead(lead, agent, io) {
  const leadIdStr = lead._id.toString();
  logger.info(`Reassigning lead ${leadIdStr} instantly because customer sent message while agent is offline/break`);
  await reassignLead(lead._id, agent, io);
}

/**
 * Save notification & send it via socket to all managers (excludes super_admin)
 */
async function notifyManagers(type, title, body, metadata = {}, io = null) {
  try {
    const managers = await User.find({
      role: 'manager',
      isActive: true,
    });

    for (const mgr of managers) {
      const notif = new Notification({
        userId: mgr._id,
        type,
        title,
        body,
        metadata,
      });
      await notif.save();

      if (io) {
        io.emit('new_notification', notif);
        if (type === 'no_active_agent_alert') {
          io.emit('manager_alert', { title, body, metadata });
        }
      }
    }
  } catch (error) {
    logger.error('Error notifying managers:', error);
  }
}

module.exports = {
  updateUserStatus,
  reassignLead,
  notifyManagers,
  triggerGracePeriodForLead,
};
