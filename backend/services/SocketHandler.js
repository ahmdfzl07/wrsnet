'use strict';

/**
 * SocketHandler.js - ENHANCED
 * Ditambahkan: subscription room untuk ONT monitoring
 */

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

module.exports = (io) => {
  // Authentication middleware for Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId   = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id} (user: ${socket.userId})`);

    socket.join(`user_${socket.userId}`);

    // Device monitoring
    socket.on('device:subscribe',   (deviceId) => socket.join(`device_${deviceId}`));
    socket.on('device:unsubscribe', (deviceId) => socket.leave(`device_${deviceId}`));

    // General monitoring dashboard
    socket.on('monitoring:subscribe',   () => socket.join('monitoring'));
    socket.on('monitoring:unsubscribe', () => socket.leave('monitoring'));

    // ─── ONT Monitoring (NEW) ─────────────────────────────
    socket.on('ont:subscribe',   () => socket.join('ont_monitoring'));
    socket.on('ont:unsubscribe', () => socket.leave('ont_monitoring'));

    // Subscribe ke ONT tertentu (untuk detail view)
    socket.on('ont:subscribe_device', (ontId) => socket.join(`ont_${ontId}`));
    socket.on('ont:unsubscribe_device', (ontId) => socket.leave(`ont_${ontId}`));

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};
