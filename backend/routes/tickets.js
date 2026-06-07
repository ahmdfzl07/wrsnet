const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const ctrl = require("../controllers/TicketController");
const InfrastructureController = require("../controllers/InfrastructureController");
const CustomerController = require("../controllers/CustomerController");

router.get("/stats", authenticate, ctrl.stats);
router.get("/customers/search", authenticate, ctrl.searchCustomers);
router.get("/customers/search-odp", authenticate, ctrl.searchCustomersOdp);
router.get("/infra/points", authenticate, ctrl.infraPoints);
router.get("/", authenticate, ctrl.index);
router.post("/", authenticate, ctrl.create);
router.get("/:id", authenticate, ctrl.show);
router.put("/:id", authenticate, ctrl.update);
router.delete("/:id", authenticate, ctrl.destroy);
router.post(
  "/:id/timeline",
  authenticate,
  ctrl.uploadMiddleware,
  ctrl.addTimeline,
);

// customer
router.get("/customers", authenticate, CustomerController.index);

// ===== INFRASTRUCTURE =====
router.get("/infrastructure", authenticate, InfrastructureController.index);
router.post("/infrastructure", authenticate, InfrastructureController.create);
router.get("/infrastructure/:id", authenticate, InfrastructureController.show);
router.get("/infrastructure/customer/:id/rx-power", authenticate, (r, s) =>
  InfrastructureController.getCustomerRxPower(r, s),
);

module.exports = router;
