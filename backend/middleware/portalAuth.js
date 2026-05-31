const jwt = require("jsonwebtoken");
const { Customer, User } = require("../models");

const portalAuth = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }

    if (!token && req.cookies && req.cookies.portal_token) {
      token = req.cookies.portal_token;
    }

    if (!token) {
      const isApi =
        req.path.startsWith("/api") ||
        req.headers.accept?.includes("application/json") ||
        req.xhr;

      if (isApi) {
        return res
          .status(401)
          .json({ success: false, message: "Authentication required" });
      }

      return res.redirect("/portal/login");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "superadmin" || decoded.role === "admin") {
      req.portalUser = {
        id: decoded.id,
        name: decoded.name || "Admin",
        role: decoded.role,
        isAdmin: true,
      };

      return next();
    }

    if (!decoded.id) {
      return res.status(403).json({
        success: false,
        message: "Invalid token",
      });
    }

    const customer = await Customer.findByPk(decoded.id);

    if (!customer || !customer.portal_enabled) {
      return res.status(401).json({
        success: false,
        message: "Account disabled",
      });
    }

    req.portalUser = {
      id: customer.id,
      customer_id: customer.customer_id,
      name: customer.name,
      status: customer.status,
      isAdmin: false,
    };

    next();
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      const isApi =
        req.path.startsWith("/api") ||
        req.headers.accept?.includes("application/json");

      if (isApi) {
        return res
          .status(401)
          .json({ success: false, message: "Token expired" });
      }

      return res.redirect("/portal/login");
    }

    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

module.exports = { portalAuth };
