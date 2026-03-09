const Researcher = require("../models/Researcher");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");


exports.signup = async(req,res)=>{

try{

const hashed = await bcrypt.hash(req.body.password,10);

const researcher = new Researcher({

name:req.body.name,
email:req.body.email,
password:hashed,
center:req.body.center,
location:req.body.location

});

await researcher.save();

res.json({
message:"Researcher created"
});

}catch(err){

res.status(500).json({error:"Signup failed"});

}

};



exports.login = async(req,res)=>{

try{

const researcher = await Researcher.findOne({

email:req.body.email

});

if(!researcher){

return res.status(400).json({
message:"Researcher not found"
});

}

const match = await bcrypt.compare(

req.body.password,
researcher.password

);

if(!match){

return res.status(400).json({
message:"Wrong password"
});

}

const token = jwt.sign(

{id:researcher._id},

process.env.JWT_SECRET

);

res.json({

token,
researcher

});

}catch(err){

res.status(500).json({
error:"Login failed"
});

}

};