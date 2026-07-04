const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  senderRole: {
    type: String,
    enum: ['customer', 'agent', 'manager', 'super_admin'],
    required: true,
  },
  senderName: {
    type: String,
    default: '',
  },
  type: {
    type: String,
    enum: ['text', 'image', 'audio', 'document', 'file', 'sticker', 'emoji', 'link'],
    default: 'text',
  },
  content: {
    type: String,
    default: '',
  },
  mediaUrl: {
    type: String,
  },
  mediaPublicId: {
    type: String,
  },
  isInternal: {
    type: Boolean,
    default: false,
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  readAt: {
    type: Date,
  },
  deliveredAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

messageSchema.index({ chatId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });
messageSchema.index({ status: 1 });
messageSchema.index({ chatId: 1, senderId: 1, status: 1, isInternal: 1 });
messageSchema.index({ chatId: 1, isInternal: 1, createdAt: -1 });

messageSchema.post('save', async function (doc) {
  try {
    const Chat = mongoose.model('Chat');
    const update = {
      lastMessage: doc._id,
      lastMessageAt: doc.createdAt || new Date(),
    };
    if (!doc.isInternal) {
      update.lastExternalMessage = doc._id;
    }
    await Chat.findByIdAndUpdate(doc.chatId, update);
  } catch (err) {
    console.error('Failed to update chat lastMessage:', err);
  }
});

messageSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Message', messageSchema);
