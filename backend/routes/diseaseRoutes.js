const express = require("express");
const router = express.Router();

const diseaseController = require("../controllers/diseaseController");
const { verifyToken } = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });

// Farmer sends report (with image upload support)
router.post("/report", verifyToken, upload.single("image"), diseaseController.reportDisease);

// Researcher fetch all reports
router.get("/all-reports", verifyToken, diseaseController.getAllReports);

// Researcher updates report
router.put("/update/:id", verifyToken, diseaseController.updateReport);

module.exports = router;