const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['promotional', 'offer', 'festival', 'maintenance'],
    required: true,
  },
  imageUrl: {
    type: String,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  bgColor: {
    type: String,
    default: '#635BFF',
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
  order: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

bannerSchema.index({ isActive: 1, order: 1 });
bannerSchema.index({ type: 1 });

module.exports = mongoose.model('Banner', bannerSchema);
