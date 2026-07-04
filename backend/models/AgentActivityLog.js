const mongoose = require('mongoose');

const agentActivityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true,
  },
  activeTime: {
    type: Number, // in seconds
    default: 0,
  },
  breakTime: {
    type: Number, // in seconds
    default: 0,
  },
  statusLogs: [
    {
      status: {
        type: String,
        required: true,
      },
      startedAt: {
        type: Date,
        required: true,
      },
      endedAt: {
        type: Date,
      },
      duration: {
        type: Number, // in seconds
        default: 0,
      }
    }
  ]
}, {
  timestamps: true,
});

agentActivityLogSchema.index({ userId: 1, date: 1 }, { unique: true });
agentActivityLogSchema.index({ date: 1 });

module.exports = mongoose.model('AgentActivityLog', agentActivityLogSchema);
