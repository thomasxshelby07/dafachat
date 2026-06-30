const mongoose = require('mongoose');

const stickerPackSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  isEnabled: {
    type: Boolean,
    default: true,
  },
  stickers: [{
    url: String,
    publicId: String,
    tags: [String],
  }],
}, {
  timestamps: true,
});

stickerPackSchema.index({ category: 1 });
stickerPackSchema.index({ isEnabled: 1 });

module.exports = mongoose.model('StickerPack', stickerPackSchema);
