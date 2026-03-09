const DiseaseReport = require("../models/DiseaseReport");

/* FARMER SEND REPORT */
exports.reportDisease = async (req, res) => {
  try {
    const { crop, location, problem, symptomLocation, spread, weather } = req.body;
    let image = req.file ? req.file.path : "";
    const farmerId = req.user.id;

    const report = new DiseaseReport({
      farmerId,
      crop,
      location,
      problem,
      symptomLocation,
      spread,
      weather,
      image
    });
    await report.save();
    res.json({ message: "Report submitted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* RESEARCHER GET ALL REPORTS */
exports.getAllReports = async (req, res) => {
  try {
    if (req.user.role !== "researcher") {
      return res.status(403).json({ message: "Access denied" });
    }
    const reports = await DiseaseReport.find().populate("farmerId", "name");
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* RESEARCHER UPDATE RESPONSE */
exports.updateReport = async (req, res) => {
  try {
    if (req.user.role !== "researcher") {
      return res.status(403).json({ message: "Access denied" });
    }
    const { response, status } = req.body;
    const update = {};
    if (response !== undefined) update.researchResponse = response;
    if (status !== undefined) update.status = status;
    const report = await DiseaseReport.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json({ message: "Response updated", report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};