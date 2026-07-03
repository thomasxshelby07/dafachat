const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Chat = require('../models/Chat');

const router = express.Router();

const sanitizeConfigValue = (val) => {
  if (!val) return val;
  return val.trim().replace(/^["']|["']$/g, '');
};

cloudinary.config({
  cloud_name: sanitizeConfigValue(process.env.CLOUDINARY_CLOUD_NAME),
  api_key: sanitizeConfigValue(process.env.CLOUDINARY_API_KEY),
  api_secret: sanitizeConfigValue(process.env.CLOUDINARY_API_SECRET),
});

const printCloudinaryConfigInfo = () => {
  const secret = process.env.CLOUDINARY_API_SECRET || '';
  const key = process.env.CLOUDINARY_API_KEY || '';
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || '';
  const cleanSecret = sanitizeConfigValue(secret);
  const cleanKey = sanitizeConfigValue(key);
  const cleanCloud = sanitizeConfigValue(cloud);

  logger.info(`[CLOUDINARY DIAGNOSTICS] Raw: Cloud="${cloud}", KeyLen=${key.length}, SecretLen=${secret.length}`);
  logger.info(`[CLOUDINARY DIAGNOSTICS] Sanitized: Cloud="${cleanCloud}", Key="${cleanKey ? cleanKey.substring(0, 4) + '...' + cleanKey.substring(cleanKey.length - 2) : 'NONE'}" (len=${cleanKey.length}), Secret="${cleanSecret ? cleanSecret.substring(0, 4) + '...' + cleanSecret.substring(cleanSecret.length - 2) : 'NONE'}" (len=${cleanSecret.length})`);
};
printCloudinaryConfigInfo();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp3|wav|ogg|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|mp4|webm/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error('File type not allowed'));
  },
});

const uploadToCloudinary = (file, folder = 'dafax-chat') => {
  return new Promise((resolve, reject) => {
    const isAudio = file.mimetype.startsWith('audio/');
    const isVideo = file.mimetype.startsWith('video/');

    const options = {
      folder,
      resource_type: isAudio || isVideo ? 'video' : 'auto',
    };

    if (isAudio) {
      options.format = 'webm';
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
};

router.get('/:chatId', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { before, limit = 50 } = req.query;

    const query = { chatId };

    if (req.user.role === 'customer') {
      query.isInternal = false;
    }

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'fullName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    const enriched = messages.map(m => ({
      ...m,
      senderName: m.senderName || m.senderId?.fullName || '',
    }));

    res.json({
      messages: enriched.reverse(),
      hasMore: messages.length === parseInt(limit),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { chatId, content, type = 'text', mediaUrl, mediaPublicId, isInternal = false } = req.body;

    if (!chatId) {
      return res.status(400).json({ error: 'ChatId is required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    const message = new Message({
      chatId,
      senderId: req.user._id,
      senderRole: req.user.role,
      senderName: req.user.fullName || '',
      content,
      type,
      mediaUrl,
      mediaPublicId,
      isInternal,
      status: 'sent',
    });
    await message.save();

    await Chat.findByIdAndUpdate(chatId, { lastMessageAt: new Date() });

    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('new_message', message.toObject());
    }

    // If sender is customer and agent is offline/break, trigger grace period reassignment timer!
    if (req.user.role === 'customer' && chat.agentId) {
      const User = require('../models/User');
      const agent = await User.findById(chat.agentId);
      if (agent && (agent.status === 'offline' || agent.status === 'break')) {
        const { triggerGracePeriodForLead } = require('../utils/activitySystem');
        const Lead = require('../models/Lead');
        const leadObj = await Lead.findOne({ chatId: chat._id });
        if (leadObj) {
          triggerGracePeriodForLead(leadObj, agent, io);
        }
      }
    }

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

router.post('/media', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadToCloudinary(req.file);

    let type = 'file';
    if (req.file.mimetype.startsWith('image/')) type = 'image';
    else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
    else if (req.file.mimetype.startsWith('video/')) type = 'video';

    res.status(201).json({
      mediaUrl: result.secure_url,
      mediaPublicId: result.public_id,
      type,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  } catch (error) {
    console.error('[MEDIA UPLOAD DETAIL ERROR]:', error);
    res.status(500).json({ 
      error: 'Failed to upload media',
      details: error.message || error,
      code: error.http_code || null
    });
  }
});

router.delete('/:messageId', auth, async (req, res) => {
  try {
    if (req.user.role === 'customer') {
      return res.status(403).json({ error: 'Customers cannot delete messages' });
    }

    const message = await Message.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderRole === 'customer') {
      return res.status(403).json({ error: 'Customer messages cannot be deleted' });
    }

    await Message.findByIdAndDelete(req.params.messageId);

    const io = req.app.get('io');
    if (io) {
      io.to(message.chatId.toString()).emit('message_deleted', {
        messageId: message._id.toString(),
        chatId: message.chatId.toString(),
      });
    }

    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

module.exports = router;
