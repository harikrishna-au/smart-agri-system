const express = require("express");
const router = express.Router();

const fieldController = require("../controllers/fieldController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/add", verifyToken, fieldController.addField);
router.get("/my-fields", verifyToken, fieldController.getMyFields);

module.exports = router;