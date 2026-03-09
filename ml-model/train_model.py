import pandas as pd
from sklearn.ensemble import RandomForestClassifier
import pickle

# Example simple dataset
data = {
    "temperature":[20,25,30,35,40],
    "humidity":[60,65,70,55,50],
    "rainfall":[10,5,0,0,0],
    "label":[
        "Good conditions",
        "Monitor crop",
        "Irrigation recommended",
        "High heat stress",
        "Extreme heat risk"
    ]
}

df = pd.DataFrame(data)

X = df[["temperature","humidity","rainfall"]]
y = df["label"]

model = RandomForestClassifier()
model.fit(X,y)

pickle.dump(model,open("model.pkl","wb"))

print("Model trained and saved as model.pkl")