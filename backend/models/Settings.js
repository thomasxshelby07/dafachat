const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  group: {
    type: String,
    enum: ['branding', 'homepage', 'system', 'notifications', 'agentActivity'],
    required: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

settingsSchema.index({ key: 1 });
settingsSchema.index({ group: 1 });

module.exports = mongoose.model('Settings', settingsSchema);
