const express = require("express");
const router = express.Router();

const cropPlanningController = require("../controllers/cropPlanningController");
const { requireAuth, requireRole } = require("../middleware/authMiddleware");

router.get(
  "/overview",
  requireAuth,
  requireRole(["farmer", "researcher", "admin"]),
  cropPlanningController.getCropPlanning
);

module.exports = router;
