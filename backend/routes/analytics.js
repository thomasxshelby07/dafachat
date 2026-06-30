const express = require('express');
const auth = require('../middleware/auth');
const { isManagerOrAbove } = require('../middleware/roleCheck');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const { getRedis } = require('../config/db');

const router = express.Router();

router.get('/overview', auth, isManagerOrAbove, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalCustomers = await Customer.countDocuments();

    let onlineNow = 0;
    try {
      const redis = getRedis();
      if (redis) {
        onlineNow = await redis.scard('online_users');
      }
    } catch (e) {
      // Redis not available
    }

    const activeChats = await Chat.countDocuments({ status: 'active' });
    const waitingLeads = await Lead.countDocuments({
      $or: [
        { status: 'new' },
        { assignedAgent: null },
      ],
    });

    const availableAgents = await User.countDocuments({
      role: 'agent',
      isActive: true,
    });

    const todayRegistrations = await Customer.countDocuments({
      registrationDate: { $gte: today },
    });

    const todayConversions = await Lead.countDocuments({
      status: 'converted',
      lastActivity: { $gte: today },
    });

    const avgResponseTime = await Message.aggregate([
      {
        $lookup: {
          from: 'chats',
          localField: 'chatId',
          foreignField: '_id',
          as: 'chat',
        },
      },
      { $unwind: '$chat' },
      {
        $match: {
          senderRole: 'customer',
          createdAt: { $gte: today },
        },
      },
      {
        $lookup: {
          from: 'messages',
          let: { chatId: '$chatId', customerTime: '$createdAt' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$chatId', '$$chatId'] },
                    { $gt: ['$createdAt', '$$customerTime'] },
                    { $ne: ['$senderRole', 'customer'] },
                  ],
                },
              },
            },
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
          ],
          as: 'firstReply',
        },
      },
      { $unwind: { path: '$firstReply', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          responseTime: {
            $subtract: ['$firstReply.createdAt', '$createdAt'],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgResponse: { $avg: '$responseTime' },
        },
      },
    ]);

    const avgMs = avgResponseTime[0]?.avgResponse || 0;
    const avgMinutes = Math.floor(avgMs / 60000);
    const avgSeconds = Math.floor((avgMs % 60000) / 1000);

    res.json({
      totalCustomers,
      onlineNow,
      activeChats,
      waitingQueue: waitingLeads,
      availableAgents,
      todayRegistrations,
      todayConversions,
      avgResponseTime: `${avgMinutes}m ${avgSeconds}s`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/reports', auth, isManagerOrAbove, async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    startDate.setHours(0, 0, 0, 0);

    const dailyRegistrations = await Customer.aggregate([
      { $match: { registrationDate: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$registrationDate' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dailyConversions = await Lead.aggregate([
      {
        $match: {
          status: 'converted',
          lastActivity: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$lastActivity' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const leadStatusBreakdown = await Lead.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const agentPerformance = await User.aggregate([
      { $match: { role: 'agent' } },
      {
        $lookup: {
          from: 'chats',
          localField: '_id',
          foreignField: 'agentId',
          as: 'chats',
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          totalChats: { $size: '$chats' },
        },
      },
      { $sort: { totalChats: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      dailyRegistrations,
      dailyConversions,
      leadStatusBreakdown,
      agentPerformance,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

module.exports = router;
