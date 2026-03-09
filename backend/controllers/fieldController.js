const Field = require("../models/Field");

// Add New Field
exports.addField = async (req,res) => {

  try {

    const newField = new Field({
      ...req.body,
      farmerId: req.user.id   // ✅ FIXED
    });

    await newField.save();

    res.json({ message:"Field Added Successfully" });

  } catch(err){

    console.log("Add Field Error:", err);

    res.status(500).json({ error: err.message });
  }

};

// Get My Fields
exports.getMyFields = async (req,res) => {

  try {

    console.log("Fetching fields for:", req.user.id);  // ✅ FIXED

    const fields = await Field.find({ farmerId: req.user.id });

    res.json(fields);

  } catch(err){

    console.log("Get Fields Error:", err);

    res.status(500).json({ error: err.message });
  }

};