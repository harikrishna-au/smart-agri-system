import { motion } from "framer-motion";
import { useState } from "react";
import axios from "axios";
import { apiUrl } from "../api";

function AddField({ onClose, editData }) {

  const [field, setField] = useState(() => {
    if (editData) {
      return {
        ...editData,
        sowingDate: editData.sowingDate ? editData.sowingDate.split('T')[0] : ""
      };
    }
    return {
      fieldName: "", cropName: "", variety: "", season: "", sowingDate: "",
      state: "", district: "", mandal: "", latitude: "", longitude: "",
      village: "", soilType: "", irrigation: "", area: "",
      nitrogen: "", phosphorus: "", potassium: "", ph: "",
    };
  });

  const handleSubmit = async () => {
    const payload = {
      ...field,
      fieldName: field.fieldName.trim(),
      cropName: field.cropName.trim(),
      district: field.district.trim(),
      village: field.village.trim(),
    };

    if (!payload.fieldName || !payload.cropName || !payload.district || !payload.village) {
      alert("Field name, crop name, district, and village are required");
      return;
    }

    try {
      const token = localStorage.getItem("token");

      if (editData) {
        await axios.put(apiUrl("/api/field/update/" + editData._id), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert("Field updated successfully");
      } else {
        await axios.post(apiUrl("/api/field/add"), payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        alert("Field added successfully");
      }
      
      onClose();
    } catch (err) {
      console.error("Save field failed:", err.response?.status, err.response?.data || err);
      alert(err.response?.data?.message || "Failed to Save Field ❌");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-8" onClick={onClose}>

      <motion.div
        initial={{ scale:0.7, opacity:0 }}
        animate={{ scale:1, opacity:1 }}
        transition={{ duration:0.3 }}
        className="w-full max-w-3xl max-h-[90vh] rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >

        <div className="flex h-full max-h-[calc(90vh-3rem)] flex-col">
          <h2 className="mb-4 text-2xl font-bold text-center">🌾 {editData ? "Edit Field" : "Add New Field"}</h2>

          <div className="flex-1 overflow-y-auto pr-1">
            {/* Crop Section */}
            <h3 className="mb-2 font-semibold">🌱 Crop Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={field.fieldName || ""} placeholder="Field Name" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,fieldName:e.target.value})}/>
              <input value={field.cropName || ""} placeholder="Crop Name" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,cropName:e.target.value})}/>
              <input value={field.variety || ""} placeholder="Variety" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,variety:e.target.value})}/>
              <input value={field.season || ""} placeholder="Season" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,season:e.target.value})}/>
              <input value={field.sowingDate || ""} type="date" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,sowingDate:e.target.value})}/>
            </div>

            {/* Location */}
            <h3 className="mt-5 mb-2 font-semibold">📍 Location</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={field.state || ""} placeholder="State" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,state:e.target.value})}/>
              <input value={field.district || ""} placeholder="District" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,district:e.target.value})}/>
              <input value={field.mandal || ""} placeholder="Mandal" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,mandal:e.target.value})}/>
              <input value={field.village || ""} placeholder="Village" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,village:e.target.value})}/>
            </div>

            {/* Soil */}
            <h3 className="mt-5 mb-2 font-semibold">💧 Field Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={field.soilType || ""} placeholder="Soil Type" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,soilType:e.target.value})}/>
              <input value={field.irrigation || ""} placeholder="Irrigation Type" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,irrigation:e.target.value})}/>
              <input value={field.area || ""} placeholder="Area (Acres)" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,area:e.target.value})}/>
            </div>

            {/* Soil Test Data */}
            <h3 className="mt-5 mb-2 font-semibold">🧪 Soil Test Data <span className="text-sm font-normal text-slate-400">(optional — improves crop recommendations)</span></h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={field.nitrogen || ""} placeholder="Nitrogen content (kg/ha)" type="number" min="0" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,nitrogen:e.target.value})}/>
              <input value={field.phosphorus || ""} placeholder="Phosphorus content (kg/ha)" type="number" min="0" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,phosphorus:e.target.value})}/>
              <input value={field.potassium || ""} placeholder="Potassium content (kg/ha)" type="number" min="0" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,potassium:e.target.value})}/>
              <input value={field.ph || ""} placeholder="Soil pH (0–14)" type="number" min="0" max="14" step="0.1" className="input !mb-0 !py-2.5" onChange={(e)=>setField({...field,ph:e.target.value})}/>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
            <button
              onClick={handleSubmit}
              className="flex-1 rounded-full bg-green-700 py-3 text-white"
            >
              Save Field
            </button>

            <button
              onClick={onClose}
              className="flex-1 rounded-full border border-slate-200 bg-white py-3 text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}

export default AddField;
