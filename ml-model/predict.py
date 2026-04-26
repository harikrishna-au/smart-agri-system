import joblib
import pandas as pd

# load model + encoders
model = joblib.load("model.pkl")
le_soil = joblib.load("soil_encoder.pkl")
le_prev = joblib.load("prev_crop_encoder.pkl")
le_label = joblib.load("label_encoder.pkl")

def predict_crop(data):
    # convert categorical to numbers
    data["soil_type"] = le_soil.transform([data["soil_type"]])[0]
    data["previous_crop"] = le_prev.transform([data["previous_crop"]])[0]

    df = pd.DataFrame([data])

    pred = model.predict(df)[0]

    # convert back to crop name
    result = le_label.inverse_transform([pred])[0]

    return result


# 🔥 test run
if __name__ == "__main__":
    sample = {
        "N": 90,
        "P": 40,
        "K": 40,
        "temperature": 25,
        "humidity": 80,
        "ph": 6.5,
        "rainfall": 200,
        "soil_type": "loamy",
        "previous_crop": "rice"
    }

    print("Predicted Crop:", predict_crop(sample))