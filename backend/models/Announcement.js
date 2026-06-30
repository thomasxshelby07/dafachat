const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['popup', 'scrolling', 'header', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  scheduledAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

announcementSchema.index({ isActive: 1, type: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
