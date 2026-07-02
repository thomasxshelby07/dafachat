const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Broadcast title is required'],
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'text_image', 'text_button', 'text_image_button'],
    required: true,
  },
  content: {
    type: String,
    trim: true,
  },
  image: {
    type: String,
    trim: true,
  },
  buttonText: {
    type: String,
    trim: true,
  },
  buttonLink: {
    type: String,
    trim: true,
  },
  audience: {
    type: {
      type: String,
      enum: ['all', 'count', 'filters'],
      default: 'all',
    },
    count: {
      type: Number,
      default: 0,
    },
    tags: [{
      type: String,
      trim: true,
    }],
    status: [{
      type: String,
    }],
    country: {
      type: String,
      trim: true,
    },
    leadSource: {
      type: String,
      trim: true,
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastActiveDays: {
      type: Number,
    },
    regStartDate: {
      type: Date,
    },
    regEndDate: {
      type: Date,
    },
    isVIP: {
      type: Boolean,
    },
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
  }],
  deliveryHistory: [{
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sending', 'delivered', 'failed', 'skipped'],
      default: 'pending',
    },
    viewed: {
      type: Boolean,
      default: false,
    },
    clicked: {
      type: Boolean,
      default: false,
    },
    viewedAt: {
      type: Date,
    },
    clickedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
  }],
  expiry: {
    type: {
      type: String,
      enum: ['never', '1_day', '3_days', '7_days', 'custom'],
      default: 'never',
    },
    date: {
      type: Date,
    },
  },
  expiresAt: {
    type: Date,
  },
  schedule: {
    type: {
      type: String,
      enum: ['now', 'later'],
      default: 'now',
    },
    time: {
      type: Date,
    },
  },
  status: {
    type: String,
    enum: ['scheduled', 'sending', 'completed', 'failed'],
    default: 'scheduled',
  },
  analytics: {
    totalSent: {
      type: Number,
      default: 0,
    },
    viewed: {
      type: Number,
      default: 0,
    },
    buttonClicked: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    pending: {
      type: Number,
      default: 0,
    },
  },
}, {
  timestamps: true,
});

broadcastSchema.index({ createdBy: 1 });
broadcastSchema.index({ status: 1 });
broadcastSchema.index({ expiresAt: 1 });
broadcastSchema.index({ 'deliveryHistory.customerId': 1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);
