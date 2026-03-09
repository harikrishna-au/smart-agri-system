const express = require("express");
const router = express.Router();

const weatherController = require("../controllers/weatherController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/my-weather", verifyToken, weatherController.getMyWeather);

module.exports = router;