import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score
import joblib

# ---------------------------
# 1. Load dataset
# ---------------------------
df = pd.read_csv("data/crop_updated.csv")

# ---------------------------
# 2. Encode categorical columns
# ---------------------------
le_soil = LabelEncoder()
le_prev = LabelEncoder()
le_label = LabelEncoder()

df["soil_type"] = le_soil.fit_transform(df["soil_type"])
df["previous_crop"] = le_prev.fit_transform(df["previous_crop"])
df["label"] = le_label.fit_transform(df["label"])

# ---------------------------
# 3. Features and target
# ---------------------------
X = df[[
    "N", "P", "K",
    "temperature", "humidity", "ph", "rainfall",
    "soil_type", "previous_crop"
]]

y = df["label"]

# ---------------------------
# 4. Train-test split
# ---------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ---------------------------
# 5. Train model
# ---------------------------
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# ---------------------------
# 6. Evaluate
# ---------------------------
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print("Accuracy:", accuracy)

# ---------------------------
# 7. Save model + encoders
# ---------------------------
joblib.dump(model, "model.pkl")
joblib.dump(le_soil, "soil_encoder.pkl")
joblib.dump(le_prev, "prev_crop_encoder.pkl")
joblib.dump(le_label, "label_encoder.pkl")

print("Model and encoders saved successfully")