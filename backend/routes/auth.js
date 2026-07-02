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
    process.env.JWT_ACCESS_SECRET || 'dafax_access_secret_key_2024_change_in_production',
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '90d' }
  );

  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET || 'dafax_refresh_secret_key_2024_change_in_production',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '365d' }
  );

  return { accessToken, refreshToken };
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000, // 365 days (1 year)
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

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'dafax_refresh_secret_key_2024_change_in_production');
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
    let userObj = req.user.toJSON();
    if (req.user.role === 'customer') {
      const customer = await Customer.findOne({ userId: req.user._id });
      if (customer) {
        userObj.dafaxbetId = customer.dafaxbetId;
        userObj.customerId = customer._id;
        userObj.customerNumber = customer.customerId;
      }
    }
    res.json({ user: userObj });
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

// Smart Login/Register — Customer only, no password needed
// flow = 'existing' → both dafaxbetId AND mobile must match same record → login
// flow = 'new'      → if both match same record → error (already exists). If not → create → login
router.post('/smart-login', async (req, res) => {
  try {
    const { mobile, dafaxbetId, flow } = req.body;

    if (!mobile || !dafaxbetId) {
      return res.status(400).json({ error: 'Mobile number and DAFA ID are required' });
    }
    if (!flow || !['existing', 'new'].includes(flow)) {
      return res.status(400).json({ error: 'flow must be "existing" or "new"' });
    }

    const formattedMobile = mobile.trim().startsWith('+91') ? mobile.trim() : `+91${mobile.trim()}`;
    const cleanDafaId = dafaxbetId.trim();

    // --- Find customer record by mobile first ---
    let matchedCustomer = await Customer.findOne({ mobile: formattedMobile }).populate('userId');

    // ===== EXISTING FLOW =====
    if (flow === 'existing') {
      if (!matchedCustomer || !matchedCustomer.userId) {
        return res.status(404).json({
          error: 'You are not an existing customer. Please continue as a New Customer.',
          suggestNew: true,
        });
      }

      // Check if they need to link their Dafa ID (if they were a lead)
      if (!matchedCustomer.dafaxbetId || matchedCustomer.dafaxbetId.trim() === '') {
        // Verify this Dafa ID is not already used
        const duplicateDafa = await Customer.findOne({
          dafaxbetId: { $regex: new RegExp('^' + cleanDafaId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
        });
        if (duplicateDafa) {
          return res.status(409).json({ error: 'This Dafa ID is already linked to another mobile number.' });
        }

        matchedCustomer.dafaxbetId = cleanDafaId;
        matchedCustomer.fullName = cleanDafaId;
        await matchedCustomer.save();

        if (matchedCustomer.userId) {
          matchedCustomer.userId.fullName = cleanDafaId;
          await matchedCustomer.userId.save();
        }
      } else {
        // If they already have a Dafa ID, verify it matches
        const isMatch = matchedCustomer.dafaxbetId.toLowerCase() === cleanDafaId.toLowerCase();
        if (!isMatch) {
          return res.status(409).json({
            error: 'This mobile number is already linked to a different Dafa ID. Please enter the correct Dafa ID.',
          });
        }
      }

      const user = matchedCustomer.userId;

      if (user.role !== 'customer') {
        return res.status(403).json({ error: 'Access denied.' });
      }
      if (!user.isActive) {
        return res.status(403).json({ error: 'Your account is deactivated. Please contact support.' });
      }

      user.lastLogin = new Date();
      await user.save();

      const { accessToken, refreshToken } = generateTokens(user._id);
      setRefreshTokenCookie(res, refreshToken);

      logger.info(`Smart login (existing customer): ${formattedMobile}`);

      const userObj = user.toJSON();
      userObj.dafaxbetId = matchedCustomer.dafaxbetId;
      userObj.customerId = matchedCustomer._id;
      userObj.customerNumber = matchedCustomer.customerId;

      return res.json({
        message: 'Welcome back!',
        isNewUser: false,
        user: userObj,
        accessToken,
      });
    }

    // ===== NEW CUSTOMER FLOW =====
    if (flow === 'new') {
      // If customer already exists in DB (even if they were a lead or normal client)
      if (matchedCustomer) {
        return res.status(409).json({
          error: 'You are already registered. Please continue as an Existing Customer.',
          suggestExisting: true,
        });
      }

      // Also check: DAFA ID already registered with a different mobile
      const dafaCustomer = await Customer.findOne({
        dafaxbetId: { $regex: new RegExp('^' + cleanDafaId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
      });
      if (dafaCustomer) {
        return res.status(409).json({
          error: 'This DAFA ID is already linked to a different mobile number. Please continue as an Existing Customer.',
          suggestExisting: true,
        });
      }

      // --- AUTO-REGISTER NEW USER ---
      const newUser = new User({
        fullName: cleanDafaId,
        mobile: formattedMobile,
        role: 'customer',
      });
      await newUser.save();

      const newCustomer = new Customer({
        userId: newUser._id,
        fullName: cleanDafaId,
        mobile: formattedMobile,
        dafaxbetId: cleanDafaId,
      });
      await newCustomer.save();

      const lead = new Lead({
        customerId: newCustomer._id,
        status: 'new',
        timeline: [{
          event: 'Lead created on customer verification',
          date: new Date(),
          by: newUser._id,
        }],
      });
      await lead.save();

      const { accessToken, refreshToken } = generateTokens(newUser._id);
      setRefreshTokenCookie(res, refreshToken);

      logger.info(`Smart login (new customer created): ${formattedMobile} / ${cleanDafaId}`);

      return res.status(201).json({
        message: 'Welcome! Connecting you to support...',
        isNewUser: true,
        user: newUser.toJSON(),
        accessToken,
      });
    }
  } catch (error) {
    logger.error('Smart login error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// Lead Registration
router.post('/lead-register', async (req, res) => {
  try {
    const { fullName, mobile } = req.body;

    if (!fullName || !mobile) {
      return res.status(400).json({ error: 'Name and mobile number are required' });
    }

    const formattedMobile = mobile.trim().startsWith('+91') ? mobile.trim() : `+91${mobile.trim()}`;

    const existingUser = await User.findOne({ mobile: formattedMobile });
    if (existingUser) {
      return res.status(409).json({ error: 'Mobile number already registered. Please login.' });
    }

    const user = new User({
      fullName: fullName.trim(),
      mobile: formattedMobile,
      role: 'customer',
    });
    await user.save();

    const customer = new Customer({
      userId: user._id,
      fullName: user.fullName,
      mobile: user.mobile,
      dafaxbetId: '', // initially empty, indicating "New Lead / No Customer"
    });
    await customer.save();

    const lead = new Lead({
      customerId: customer._id,
      status: 'new',
      issueType: 'new_id',
      timeline: [{
        event: 'New Lead registered for ID creation',
        date: new Date(),
        by: user._id,
      }],
    });
    await lead.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    logger.info(`New lead registered: ${formattedMobile}`);

    const userObj = user.toJSON();
    userObj.dafaxbetId = '';
    userObj.customerId = customer._id;
    userObj.customerNumber = customer.customerId;

    res.status(201).json({
      message: 'Registration successful',
      user: userObj,
      customer: customer.toJSON(),
      accessToken,
    });
  } catch (error) {
    logger.error('Lead registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Lead Login
router.post('/lead-login', async (req, res) => {
  try {
    const { mobile } = req.body;

    if (!mobile) {
      return res.status(400).json({ error: 'Mobile number is required' });
    }

    const formattedMobile = mobile.trim().startsWith('+91') ? mobile.trim() : `+91${mobile.trim()}`;

    const customer = await Customer.findOne({ mobile: formattedMobile }).populate('userId');
    if (!customer || !customer.userId) {
      return res.status(404).json({ error: 'This mobile number is not registered. Please register first.' });
    }

    if (customer.dafaxbetId && customer.dafaxbetId.trim() !== '') {
      return res.status(400).json({
        error: 'Your ID is active. Please login with your Dafa ID and mobile number on Customer Care.',
        isClient: true,
        dafaxbetId: customer.dafaxbetId
      });
    }

    const user = customer.userId;
    if (!user.isActive) {
      return res.status(403).json({ error: 'Your account is deactivated. Please contact support.' });
    }

    user.lastLogin = new Date();
    await user.save();

    const { accessToken, refreshToken } = generateTokens(user._id);
    setRefreshTokenCookie(res, refreshToken);

    logger.info(`Lead logged in: ${formattedMobile}`);

    const userObj = user.toJSON();
    userObj.dafaxbetId = '';
    userObj.customerId = customer._id;
    userObj.customerNumber = customer.customerId;

    res.json({
      message: 'Login successful',
      user: userObj,
      customer: customer.toJSON(),
      accessToken,
    });
  } catch (error) {
    logger.error('Lead login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});


module.exports = router;


