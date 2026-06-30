const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    required: true,
  },
  entity: {
    type: String,
    required: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
  },
  before: {
    type: mongoose.Schema.Types.Mixed,
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
  },
  ip: {
    type: String,
  },
}, {
  timestamps: true,
});

auditLogSchema.index({ userId: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
