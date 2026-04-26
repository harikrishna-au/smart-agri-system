import pandas as pd

# dataset load
df = pd.read_csv("data/crop.csv")

# ---------------------------
# 1️⃣ SOIL TYPE (based on pH)
# ---------------------------
def get_soil_type(ph):
    if ph < 5.5:
        return "sandy"
    elif ph < 7:
        return "loamy"
    elif ph < 8:
        return "clay"
    else:
        return "rock"

df["soil_type"] = df["ph"].apply(get_soil_type)

# ---------------------------
# 2️⃣ PREVIOUS CROP (simple rotation)
# ---------------------------
rotation_map = {
    "rice": "pulses",
    "maize": "legumes",
    "chickpea": "wheat",
    "kidneybeans": "maize",
    "pigeonpeas": "rice"
}

df["previous_crop"] = df["label"].map(rotation_map)

# missing values fill
df["previous_crop"].fillna("none", inplace=True)

# ---------------------------
# SAVE
# ---------------------------
df.to_csv("data/crop_updated.csv", index=False)

print("✅ Soil + Previous crop added")
print(df.head())