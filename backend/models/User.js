const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    trim: true,
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
  },
  securityPinHash: {
    type: String,
  },
  role: {
    type: String,
    enum: ['customer', 'agent', 'manager', 'super_admin'],
    default: 'customer',
  },
  isVerified: {
    type: Boolean,
    default: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: ['online', 'away', 'break', 'offline'],
    default: 'online',
  },
  team: {
    type: String,
    default: '',
    trim: true,
  },
  department: {
    type: String,
    default: '',
    trim: true,
  },
  todayActiveTime: {
    type: Number,
    default: 0,
  },
  todayBreakTime: {
    type: Number,
    default: 0,
  },
  statusChangedAt: {
    type: Date,
    default: Date.now,
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
  },
  permissions: {
    canSeeLeads: { type: Boolean, default: true },
    canManageUsers: { type: Boolean, default: false },
    canSeeAnalytics: { type: Boolean, default: true },
    canDeleteMessages: { type: Boolean, default: true },
    canCloseChats: { type: Boolean, default: true },
    canAssignLeads: { type: Boolean, default: false },
    canManageBranding: { type: Boolean, default: false },
    issueTypes: [{
      type: String,
      enum: ['deposit', 'withdrawal', 'other', 'new_id', 'verify_id'],
    }],
  },
  avatar: {
    type: String,
    default: '',
  },
  lastLogin: {
    type: Date,
  },
}, {
  timestamps: true,
});

userSchema.index({ mobile: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ status: 1 });

userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash')) {
    if (this.passwordHash && !this.passwordHash.startsWith('$2a$') && !this.passwordHash.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(12);
      this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    }
  }
  if (this.isModified('securityPinHash')) {
    if (this.securityPinHash && !this.securityPinHash.startsWith('$2a$') && !this.securityPinHash.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(12);
      this.securityPinHash = await bcrypt.hash(this.securityPinHash, salt);
    }
  }
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.compareSecurityPin = async function (candidatePin) {
  if (!this.securityPinHash) return false;
  return bcrypt.compare(candidatePin, this.securityPinHash);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.securityPinHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
