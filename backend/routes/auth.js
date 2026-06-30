const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const auth = require('../middleware/auth');
const { validate, registerSchema, loginSchema } = require('../middleware/validate');
const logger = require('../utils/logger');

const router = express.Router();

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );

  return { accessToken, refreshToken };
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// Customer Registration
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { fullName, mobile, password, dafaxbetId, securityPin } = req.body;

    if (!fullName || !mobile || !password || !dafaxbetId || !securityPin) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }

    const existingCustomer = await Customer.findOne({
      dafaxbetId: { $regex: new RegExp('^' + dafaxbetId.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
    });
    if (existingCustomer) {
      return res.status(409).json({ error: 'Enter your correct Dafaxbet ID' });
    }

    const user = new User({
      fullName,
      mobile,
      passwordHash: password,
      securityPinHash: securityPin,
      role: 'customer',
    });
    await user.save();

    const customer = new Customer({
      userId: user._id,
      fullName: user.fullName,
      mobile: user.mobile,
      dafaxbetId,
    });
    await customer.save();

    const lead = new Lead({
      customerId: customer._id,
      status: 'new',
      timeline: [{
        event: 'Lead created on customer registration',
        date: new Date(),
        by: user._id,
      }],
    });
    await lead.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    logger.info(`New customer registered: ${user.mobile}`);

    res.status(201).json({
      message: 'Registration successful',
      user: user.toJSON(),
      customer: customer.toJSON(),
      accessToken,
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Reset Password (Customer only, via Security PIN)
router.post('/reset-password', async (req, res) => {
  try {
    const { dafaxbetId, securityPin, newPassword } = req.body;

    if (!dafaxbetId || !securityPin || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const genericError = 'Incorrect Dafaxbet ID or Security PIN';

    // Find customer by dafaxbetId and populate their User ID reference
    const customer = await Customer.findOne({ dafaxbetId: dafaxbetId.trim() }).populate('userId');
    if (!customer || !customer.userId) {
      return res.status(400).json({ error: genericError });
    }

    const user = customer.userId;
    if (user.role !== 'customer') {
      return res.status(400).json({ error: genericError });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isMatch = await user.compareSecurityPin(securityPin);
    if (!isMatch) {
      return res.status(400).json({ error: genericError });
    }

    // Hash is generated in pre-save hook
    user.passwordHash = newPassword;
    await user.save();

    logger.info(`Customer password reset successfully for Dafaxbet ID: ${dafaxbetId}`);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Password reset error:', error);
    res.status(500).json({ error: 'Password reset failed' });
  }
});

// Login (all roles)
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({ error: 'Mobile and password are required' });
    }

    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(401).json({ error: 'This number not register on dafaxbet customer care please register' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    logger.info(`User logged in: ${user.mobile} (${user.role})`);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      accessToken,
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Refresh Token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    const tokens = generateTokens(user._id);
    setRefreshTokenCookie(res, tokens.refreshToken);

    res.json({
      accessToken: tokens.accessToken,
      user: user.toJSON(),
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    res.clearCookie('refreshToken');
    logger.info(`User logged out: ${req.user.mobile}`);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Admin/Agent Login (Email-based)
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role === 'customer') {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    logger.info(`Admin/Agent logged in: ${user.email} (${user.role})`);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      accessToken,
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Check availability of Mobile Number and Dafaxbet ID
router.post('/check-availability', async (req, res) => {
  try {
    const { mobile, dafaxbetId } = req.body;

    if (!mobile || !dafaxbetId) {
      return res.status(400).json({ error: 'Mobile and Dafaxbet ID are required' });
    }

    const formattedMobile = mobile.startsWith('+91') ? mobile : `+91${mobile.trim()}`;

    const existingUser = await User.findOne({ mobile: formattedMobile });
    if (existingUser) {
      return res.status(409).json({ error: 'Mobile number already registered' });
    }

    const existingCustomer = await Customer.findOne({
      dafaxbetId: { $regex: new RegExp('^' + dafaxbetId.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
    });
    if (existingCustomer) {
      return res.status(409).json({ error: 'Enter your correct Dafaxbet ID' });
    }

    res.json({ available: true });
  } catch (error) {
    logger.error('Check availability error:', error);
    res.status(500).json({ error: 'Failed to verify availability' });
  }
});

module.exports = router;
