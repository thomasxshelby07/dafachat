const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: false,
  },
  type: {
    type: String,
    enum: ['text', 'image'],
    default: 'text',
  },
  mediaUrl: {
    type: String,
  },
  mediaPublicId: {
    type: String,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  order: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

templateSchema.index({ category: 1 });
templateSchema.index({ isActive: 1 });
templateSchema.index({ order: 1 });

module.exports = mongoose.model('Template', templateSchema);
