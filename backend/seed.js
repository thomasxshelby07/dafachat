require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const ADMIN_MOBILE = process.env.SUPER_ADMIN_MOBILE;
    const ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD;

    console.log('Using mobile:', ADMIN_MOBILE);
    console.log('Using password: [hidden]');

    // Check existing
    const existing = await User.findOne({ mobile: ADMIN_MOBILE });
    if (existing) {
      console.log('Found existing super_admin, deleting...');
      await User.deleteOne({ _id: existing._id });
    }

    // Create super admin - use plain password, let pre-save hook hash it
    const admin = new User({
      fullName: 'Super Admin',
      mobile: ADMIN_MOBILE,
      email: process.env.SUPER_ADMIN_EMAIL,
      passwordHash: ADMIN_PASSWORD,
      role: 'super_admin',
      status: 'online',
    });
    await admin.save();
    console.log('Super Admin saved with ID:', admin._id);

    // Verify
    const verify = await User.findOne({ mobile: ADMIN_MOBILE });
    console.log('Found in DB:', !!verify);
    console.log('Hash starts with $2:', verify.passwordHash.startsWith('$2'));
    
    const isMatch = await bcrypt.compare(ADMIN_PASSWORD, verify.passwordHash);
    console.log('Password match:', isMatch);

    // List all users
    const allUsers = await User.find({}).select('fullName mobile role isActive');
    console.log('\nAll users in DB:');
    allUsers.forEach(u => console.log(`  ${u.fullName} | ${u.mobile} | ${u.role} | active=${u.isActive}`));

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
};

seed();
