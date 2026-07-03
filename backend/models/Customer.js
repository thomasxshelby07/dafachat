const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerId: {
    type: String,
    unique: true,
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  mobile: {
    type: String,
    required: true,
    trim: true,
  },
  dafaxbetId: {
    type: String,
    trim: true,
  },
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  leadStatus: {
    type: String,
    enum: ['new', 'assigned', 'in_progress', 'follow_up', 'interested', 'converted', 'closed', 'deposit_done', 'withdrawal_done', 'issue_solved', 'issue_not_solved', 'verification_pending', 'verification_failed'],
    default: 'new',
  },
  tags: [{
    type: String,
    trim: true,
  }],
  country: {
    type: String,
    trim: true,
    default: '',
  },
  leadSource: {
    type: String,
    trim: true,
    default: '',
  },
  isVIP: {
    type: Boolean,
    default: false,
  },
  notes: [{
    type: String,
    trim: true,
  }],
  isOnline: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

customerSchema.index({ userId: 1 });
customerSchema.index({ customerId: 1 });
customerSchema.index({ mobile: 1 });
customerSchema.index({ assignedAgent: 1 });
customerSchema.index({ leadStatus: 1 });
customerSchema.index({ registrationDate: -1 });
customerSchema.index({ dafaxbetId: 1 }, { unique: true, sparse: true });

customerSchema.pre('save', async function (next) {
  if (!this.customerId) {
    const count = await mongoose.model('Customer').countDocuments();
    this.customerId = `DAF-${String(count + 10001).padStart(5, '0')}`;
  }
  next();
});

customerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Customer', customerSchema);
