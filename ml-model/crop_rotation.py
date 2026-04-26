from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/")
def home():
    return "Crop Rotation API Running"

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    prev = (data.get("previous_crop") or "").lower()

    rotation_map = {
        "rice": "pulses",
        "pulses": "maize",
        "maize": "legumes",
        "wheat": "vegetables",
        "cotton": "wheat",
        "sugarcane": "pulses",
        "groundnut": "wheat",
        "soybean": "maize"
    }

    next_crop = rotation_map.get(prev, "pulses")

    return jsonify({
        "next_crop": next_crop
    })

if __name__ == "__main__":
    app.run(debug=True)