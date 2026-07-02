const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
  },
  issueType: {
    type: String,
    enum: ['deposit', 'withdrawal', 'other', 'new_id'],
    default: 'other',
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'transferred'],
    default: 'active',
  },
  isPinned: {
    type: Boolean,
    default: false,
  },
  isImportant: {
    type: Boolean,
    default: false,
  },
  closedAt: {
    type: Date,
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

chatSchema.index({ customerId: 1 });
chatSchema.index({ agentId: 1 });
chatSchema.index({ leadId: 1 });
chatSchema.index({ status: 1 });
chatSchema.index({ lastMessageAt: -1 });

chatSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Chat', chatSchema);
