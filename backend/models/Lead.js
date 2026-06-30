const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedAgents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  status: {
    type: String,
    enum: ['new', 'assigned', 'in_progress', 'follow_up', 'interested', 'converted', 'closed', 'deposit_done', 'withdrawal_done', 'issue_solved', 'issue_not_solved'],
    default: 'new',
  },
  issueType: {
    type: String,
    enum: ['deposit', 'withdrawal', 'other'],
    default: 'other',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  tags: [{
    type: String,
    trim: true,
  }],
  timeline: [{
    event: String,
    date: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  lastActivity: {
    type: Date,
    default: Date.now,
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
  },
  internalNotes: [{
    text: String,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now },
    editedAt: Date,
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
}, {
  timestamps: true,
});

leadSchema.index({ customerId: 1 });
leadSchema.index({ assignedAgent: 1 });
leadSchema.index({ assignedAgents: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ lastActivity: -1 });
leadSchema.index({ createdAt: -1 });

leadSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Lead', leadSchema);
