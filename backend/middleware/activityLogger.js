const { ActivityLog } = require('../models');

const logActivity = (action, module) => {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);
    
    res.json = function(data) {
      // Log only on successful operations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        ActivityLog.create({
          user_id: req.user?.id || null,
          action,
          module,
          description: `${action} on ${module}`,
          target_type: module,
          target_id: req.params.id || data?.data?.id || null,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        }).catch(err => {
          console.error('Activity log error:', err.message);
        });
      }
      return originalJson(data);
    };
    
    next();
  };
};

module.exports = { logActivity };
