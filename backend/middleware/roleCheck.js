const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

const isCustomer = roleCheck('customer');
const isAgentOrAbove = roleCheck('agent', 'manager', 'super_admin');
const isManagerOrAbove = roleCheck('manager', 'super_admin');
const isAdmin = roleCheck('super_admin');

module.exports = { roleCheck, isCustomer, isAgentOrAbove, isManagerOrAbove, isAdmin };
