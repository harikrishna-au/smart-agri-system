const soilRuleMap = {
  "clay": ["paddy", "sugarcane"],
  "loam": ["paddy", "groundnut", "cotton", "maize", "vegetables"],
  "sandy": ["groundnut", "millets", "watermelon", "cowpea"],
  "black": ["cotton", "chilli", "pigeon pea", "sunflower"],
  "red": ["groundnut", "millets", "cotton", "maize"],
};

const cropProfiles = {
  paddy: {
    label: "Paddy",
    preferredSoils: ["clay", "loam"],
    waterNeed: "high",
    rotationAvoid: ["paddy"],
    rotationPreferred: ["pulses", "groundnut", "millets"],
  },
  cotton: {
    label: "Cotton",
    preferredSoils: ["black", "red", "loam"],
    waterNeed: "medium",
    rotationAvoid: ["cotton", "chilli"],
    rotationPreferred: ["pulses", "groundnut", "maize"],
  },
  groundnut: {
    label: "Groundnut",
    preferredSoils: ["sandy", "red", "loam"],
    waterNeed: "medium",
    rotationAvoid: ["groundnut", "cotton"],
    rotationPreferred: ["paddy", "millets", "maize"],
  },
  maize: {
    label: "Maize",
    preferredSoils: ["loam", "red", "black"],
    waterNeed: "medium",
    rotationAvoid: ["maize"],
    rotationPreferred: ["pulses", "groundnut", "millets"],
  },
  millets: {
    label: "Millets",
    preferredSoils: ["sandy", "red", "black", "loam"],
    waterNeed: "low",
    rotationAvoid: ["millets"],
    rotationPreferred: ["pulses", "groundnut", "cotton"],
  },
  pulses: {
    label: "Pulses",
    preferredSoils: ["loam", "red", "black"],
    waterNeed: "low",
    rotationAvoid: ["pulses"],
    rotationPreferred: ["paddy", "maize", "cotton"],
  },
  vegetables: {
    label: "Vegetables",
    preferredSoils: ["loam", "red"],
    waterNeed: "medium",
    rotationAvoid: ["vegetables"],
    rotationPreferred: ["pulses", "millets"],
  },
  sugarcane: {
    label: "Sugarcane",
    preferredSoils: ["clay", "loam"],
    waterNeed: "high",
    rotationAvoid: ["sugarcane"],
    rotationPreferred: ["pulses", "groundnut"],
  },
};

function normalize(value) {
  return (value || "").trim().toLowerCase();
}

function scoreCrop(field, cropKey, recentCropKey) {
  const profile = cropProfiles[cropKey];
  if (!profile) return null;

  let score = 50;
  const notes = [];
  const soil = normalize(field.soilType);
  const irrigation = normalize(field.irrigation);
  const season = normalize(field.season);
  const district = normalize(field.district);

  if (profile.preferredSoils.includes(soil)) {
    score += 20;
    notes.push(`Matches ${soil || "your"} soil`);
  } else if (soil) {
    score -= 10;
  }

  if (profile.waterNeed === "high" && (irrigation.includes("drip") || irrigation.includes("canal") || irrigation.includes("regular"))) {
    score += 10;
  }

  if (profile.waterNeed === "low" && irrigation.includes("rain")) {
    score += 8;
  }

  if (season.includes("kharif") && ["paddy", "cotton", "groundnut", "maize"].includes(cropKey)) {
    score += 10;
  }
  if (season.includes("rabi") && ["pulses", "millets", "vegetables"].includes(cropKey)) {
    score += 8;
  }

  if (recentCropKey && profile.rotationAvoid.includes(recentCropKey)) {
    score -= 25;
    notes.push(`Avoid repeating ${recentCropKey} after the last season`);
  }

  if (district && (district.includes("godavari") || district.includes("guntur") || district.includes("krishna"))) {
    if (["paddy", "cotton", "groundnut"].includes(cropKey)) score += 5;
  }

  return {
    crop: profile.label,
    cropKey,
    score: Math.max(0, Math.min(score, 100)),
    notes,
  };
}

function getRecommendations(field, recentCropKey) {
  const candidates = Object.keys(cropProfiles)
    .map((cropKey) => scoreCrop(field, cropKey, recentCropKey))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  const best = candidates.slice(0, 3).map((item) => ({
    crop: item.crop,
    score: item.score,
    reasons: item.notes.length ? item.notes : ["Fits the available field profile"],
  }));

  return best;
}

function buildRotationPlan(field, lastCropKey) {
  const currentCrop = normalize(field.cropName);
  const lastCrop = lastCropKey || currentCrop;
  const profile = cropProfiles[currentCrop] || cropProfiles[lastCrop];

  const nextOptions = profile?.rotationPreferred || ["pulses", "millets", "groundnut"];
  const immediateNext = nextOptions
    .filter((cropKey) => cropKey !== currentCrop && cropKey !== lastCrop)
    .slice(0, 3)
    .map((cropKey) => cropProfiles[cropKey]?.label || cropKey);

  const rotationNotes = [];
  if (profile?.rotationAvoid?.includes(lastCrop)) {
    rotationNotes.push(`Avoid planting ${profile.label} after ${cropProfiles[lastCrop]?.label || lastCrop}`);
  }
  rotationNotes.push("Insert a pulse or legume crop to restore soil nitrogen.");

  return {
    currentCrop: profile?.label || field.cropName || "Unknown",
    lastCrop: cropProfiles[lastCrop]?.label || field.cropName || "Unknown",
    nextCropOptions: immediateNext.length ? immediateNext : ["Pulses", "Millets"],
    notes: rotationNotes,
  };
}

module.exports = {
  getRecommendations,
  buildRotationPlan,
  cropProfiles,
};
