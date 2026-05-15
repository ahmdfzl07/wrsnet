const jwt = require('jsonwebtoken');
const { User, Role, Permission } = require('../models');

// Verify JWT Token
const authenticate = async (req, res, next) => {
  try {
    let token = null;

    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Check cookie
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      // Deteksi apakah request dari fetch/AJAX (bukan page load browser)
      const isApiRequest = req.xhr
        || req.headers.accept?.includes('application/json')
        || req.headers['content-type']?.includes('application/json')
        || req.headers['x-requested-with'] === 'XMLHttpRequest'
        || req.path.startsWith('/api');
      if (isApiRequest) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }
      return res.redirect('/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findByPk(decoded.id, {
      include: [{
        model: Role,
        as: 'role',
        include: [{
          model: Permission,
          as: 'permissions',
          through: { attributes: [] }
        }]
      }]
    });

    if (!user || !user.is_active) {
      const isApiRequest = req.xhr
        || req.headers.accept?.includes('application/json')
        || req.headers['content-type']?.includes('application/json')
        || req.path.startsWith('/api');
      if (isApiRequest) {
        return res.status(401).json({ success: false, message: 'User not found or inactive' });
      }
      return res.redirect('/login');
    }

    req.user = user;
    req.userPermissions = user.role?.permissions?.map(p => p.name) || [];
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.redirect('/login');
    }
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    return res.redirect('/login');
  }
};

// Check Role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const userRole = (req.user.role.name || '').toLowerCase();
    const allowed  = roles.map(r => r.toLowerCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ success: false, message: 'Insufficient role permissions' });
    }
    next();
  };
};

// Check Permission
const hasPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.userPermissions) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    // Superadmin bypasses all permission checks
    if (req.user.role?.name === 'superadmin') {
      return next();
    }
    const hasAny = permissions.some(p => req.userPermissions.includes(p));
    if (!hasAny) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};

// Optional auth (for pages that work with or without auth)
const optionalAuth = async (req, res, next) => {
  try {
    let token = req.cookies?.token || req.headers.authorization?.substring(7);
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.id, {
        include: [{ model: Role, as: 'role' }]
      });
      if (user && user.is_active) {
        req.user = user;
      }
    }
  } catch (e) {
    // Ignore auth errors for optional auth
  }
  next();
};

module.exports = { authenticate, authorize, hasPermission, optionalAuth };