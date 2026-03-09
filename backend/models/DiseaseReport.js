const mongoose = require("mongoose");

const diseaseReportSchema = new mongoose.Schema({

farmerId:{
type:mongoose.Schema.Types.ObjectId,
ref:"Farmer"
},

crop:String,
location:String,
problem:String,
symptomLocation:String,
spread:String,
weather:String,
image:String,

status:{
type:String,
default:"Pending"
},

researchResponse:{
type:String,
default:""
},

createdAt:{
type:Date,
default:Date.now
}

});

module.exports = mongoose.model("DiseaseReport",diseaseReportSchema);