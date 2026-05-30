"use strict";

const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

module.exports = (io) => {
  // AUTH MIDDLEWARE
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) return next(new Error("Authentication required"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.clientType = socket.handshake.auth?.client || "unknown";
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    logger.debug(`Socket connected: ${socket.id} (${socket.clientType})`);

    // setiap user masuk room personal
    socket.join(`user_${socket.userId}`);

    // =========================
    // 🔥 GLOBAL CHAT BRIDGE
    // =========================
    socket.on("chat:join_global", () => {
      socket.join("global_chat");
      logger.debug(`Joined global_chat: ${socket.id}`);
    });

    socket.on("chat:leave_global", () => {
      socket.leave("global_chat");
    });

    // =========================
    // 💬 SEND CHAT
    // =========================
    socket.on("chat:send", async (data) => {
      const { room, message } = data;

      const payload = {
        room,
        message,
        from: socket.clientType,
        userId: socket.userId,
        created_at: new Date(),
      };

      // 🔥 INI KUNCI: kirim ke semua client portal + admin
      io.to("global_chat").emit("chat:receive", payload);
    });

    // =========================
    // DEVICE MONITORING (tetap)
    // =========================
    socket.on("device:subscribe", (deviceId) =>
      socket.join(`device_${deviceId}`),
    );

    socket.on("device:unsubscribe", (deviceId) =>
      socket.leave(`device_${deviceId}`),
    );

    // =========================
    // ONT MONITORING (tetap)
    // =========================
    socket.on("ont:subscribe", () => socket.join("ont_monitoring"));

    socket.on("ont:unsubscribe", () => socket.leave("ont_monitoring"));

    socket.on("disconnect", () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};
