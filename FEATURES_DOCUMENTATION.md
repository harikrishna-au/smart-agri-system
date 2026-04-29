# Crop Recommendation & Crop Rotation — Complete Technical Documentation

> **Purpose:** This document explains every aspect of the Crop Recommendation and Crop Rotation features implemented in this project — from dataset design and machine-learning algorithms to system architecture and end-to-end request flow. It is written to support a final-year project review presentation.

---

## Table of Contents

1. [Problem Statement and Motivation](#1-problem-statement-and-motivation)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Crop Recommendation Feature](#3-crop-recommendation-feature)
   - 3.1 [Two-Layer Design Philosophy](#31-two-layer-design-philosophy)
   - 3.2 [The Dataset](#32-the-dataset)
   - 3.3 [The Machine Learning Model](#33-the-machine-learning-model)
   - 3.4 [Random Forest Algorithm — Deep Dive](#34-random-forest-algorithm--deep-dive)
   - 3.5 [Training Pipeline](#35-training-pipeline)
   - 3.6 [Hyperparameter Tuning](#36-hyperparameter-tuning)
   - 3.7 [Model Performance Metrics](#37-model-performance-metrics)
   - 3.8 [Feature Importance Analysis](#38-feature-importance-analysis)
   - 3.9 [Flask ML Sidecar Service](#39-flask-ml-sidecar-service)
   - 3.10 [Rule-Based Scoring Engine](#310-rule-based-scoring-engine)
   - 3.11 [Weather Integration](#311-weather-integration)
   - 3.12 [Confidence Threshold and Graceful Degradation](#312-confidence-threshold-and-graceful-degradation)
   - 3.13 [End-to-End Request Flow](#313-end-to-end-request-flow)
4. [Crop Rotation Feature](#4-crop-rotation-feature)
   - 4.1 [What Is Crop Rotation and Why It Matters](#41-what-is-crop-rotation-and-why-it-matters)
   - 4.2 [Simple Rotation API (Flask)](#42-simple-rotation-api-flask)
   - 4.3 [Advanced Rotation Planner (Node.js Service)](#43-advanced-rotation-planner-nodejs-service)
   - 4.4 [Crop Profiles and Rotation Rules](#44-crop-profiles-and-rotation-rules)
   - 4.5 [Rotation Integration with Crop Recommendation](#45-rotation-integration-with-crop-recommendation)
5. [All Python Libraries and Models Used](#5-all-python-libraries-and-models-used)
6. [Design Decisions and Why](#6-design-decisions-and-why)
7. [Complete Crop and Data Reference](#7-complete-crop-and-data-reference)

---

## 1. Problem Statement and Motivation

Indian smallholder farmers make crop-planting decisions primarily based on tradition and intuition. This leads to three major problems:

1. **Wrong crop for the soil** — a farmer may plant a nitrogen-hungry crop on nitrogen-depleted soil without realising it, causing poor yield.
2. **Climate mismatch** — a crop with high water requirements may be planted in a low-rainfall district.
3. **Continuous monoculture** — planting the same crop year after year depletes specific nutrients, increases pest pressure, and degrades soil health.

This project addresses all three by:
- Using a **trained machine-learning model** that considers soil nutrient levels (N, P, K, pH) and real-time climate data (temperature, humidity, rainfall) to recommend the statistically most suitable crop.
- Providing a **rule-based fallback** that gives reasonable recommendations even without soil test data or internet connectivity.
- Generating **crop rotation plans** that break monoculture cycles and restore soil fertility.

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       React Frontend                             │
│  CropPlanning.js — Tailwind CSS — Axios                         │
│                                                                  │
│  User fills in field details → clicks "Get Recommendation"      │
└───────────────────────────────┬─────────────────────────────────┘
                                │  HTTP POST  (JWT auth header)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js / Express Backend  (port 5400)              │
│                                                                  │
│  cropRecommendationController.js                                 │
│   ├── Reads field data from MongoDB                              │
│   ├── Calls OpenWeatherMap for live temperature + humidity       │
│   ├── Looks up district-average monthly rainfall                 │
│   ├── Calls Flask ML sidecar via POST /predict-crop              │
│   └── Calls rule-based engine (cropPlanningService.js)           │
│                                                                  │
│  cropPlanningService.js                                          │
│   ├── getRecommendations()  — weighted score for every crop      │
│   └── buildRotationPlan()   — next-season rotation options       │
└───────────────────────────────┬─────────────────────────────────┘
                                │  POST /predict-crop
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│         Python Flask ML Sidecar  (port 5401)                     │
│                                                                  │
│  app.py                                                          │
│   └── Loads crop_pipeline.pkl at startup                         │
│       Pipeline: StandardScaler → RandomForestClassifier          │
│       Returns: recommended_crop, confidence, top3                │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     MongoDB Atlas                                 │
│   Fields Collection — User Collection — Crop History             │
└─────────────────────────────────────────────────────────────────┘
```

**Why two separate processes (Node.js + Flask)?**
Node.js cannot execute scikit-learn models natively. Running the ML model in a separate Flask sidecar keeps the runtimes isolated: the ML service can be retrained, restarted, or scaled without touching the main API server. They communicate over localhost HTTP.

---

## 3. Crop Recommendation Feature

### 3.1 Two-Layer Design Philosophy

The system uses two independent recommendation engines that always run together:

| Layer | What it does | When it works |
|-------|-------------|---------------|
| **ML-based** | Feeds soil + climate features into a trained RandomForest and returns a probabilistic crop ranking | Requires soil test data (N, P, K, pH) + weather API access |
| **Rule-based** | Scores each crop profile against field attributes using agronomic rules | Always works — no external dependencies |

The two results are returned side-by-side. If the ML service is offline, the rule-based layer ensures the user always gets a useful answer. If ML confidence is below 35%, it is flagged as uncertain and the rule-based result is promoted.

This is called **graceful degradation** — the system never completely fails; it just switches to a less precise but still valid mode.

---

### 3.2 The Dataset

#### Location
`ml-model/crop_recommendation/Crop_recommendation.csv`  
Generated by: `ml-model/crop_recommendation/generate_crop_dataset.py`

#### Dataset Summary

| Property | Value |
|----------|-------|
| Total rows | 6,600 |
| Crop classes | 22 |
| Samples per crop | 300 |
| Features | 7 numeric |
| Label column | `label` (crop name string) |
| Data type | Synthetic, agronomically validated |

#### The 22 Crop Classes

| Category | Crops |
|----------|-------|
| Cereals & staples | rice, maize, jute |
| Pulses | chickpea, kidneybeans, pigeonpeas, mothbeans, mungbean, blackgram, lentil |
| Cash crops | cotton, coffee |
| Fruits | pomegranate, banana, mango, grapes, watermelon, muskmelon, apple, orange, papaya, coconut |

#### The 7 Input Features

| Feature | Unit | Meaning |
|---------|------|---------|
| `N` | kg/ha | Nitrogen content of the soil |
| `P` | kg/ha | Phosphorus content of the soil |
| `K` | kg/ha | Potassium content of the soil |
| `temperature` | °C | Mean temperature during growing season |
| `humidity` | % | Relative humidity during growing season |
| `ph` | — | Soil pH (acidity/alkalinity) |
| `rainfall` | mm/month | Average monthly rainfall |

#### How the Dataset Was Generated

Pure real-world collection of 6,600 soil samples would take years. Instead, the dataset was **synthetically generated** using agronomic profiles sourced from **FAO (Food and Agriculture Organization) crop manuals** and **ICAR (Indian Council of Agricultural Research) package-of-practices**.

For every crop, a valid range `(lo, hi)` for each feature was defined. For example:
```
rice:   N=(60,120), P=(30,60), K=(30,60), temperature=(20,27),
        humidity=(80,90), ph=(5.5,6.5), rainfall=(150,300)
cotton: N=(80,160), P=(40,80), K=(40,80), temperature=(21,30),
        humidity=(50,70), ph=(6.0,7.5), rainfall=(60,110)
```

Each of the 300 samples per crop was generated using a **70/30 Gaussian–Uniform blend**:

```python
def _sample_feature(lo, hi, n):
    n_gauss = int(n * 0.70)        # 210 samples near ideal centre
    n_unif  = n - n_gauss          # 90 samples spread across full range

    mid   = (lo + hi) / 2.0
    sigma = (hi - lo) / 6.0        # 99.7% of Gaussian values stay in range

    gauss = rng.normal(loc=mid, scale=sigma, size=n_gauss)
    unif  = rng.uniform(low=lo, high=hi, size=n_unif)

    return np.clip(np.concatenate([gauss, unif]), lo, hi)
```

**Why this blend?**
- **Pure Gaussian** clusters too tightly around the ideal midpoint — the model never sees edge conditions (e.g., rice grown at the cool end of its temperature range).
- **Pure Uniform** loses the realistic peak signal — in practice, most rice is grown near 23°C, not at 20°C or 27°C equally.
- The **70/30 blend** gives the model both: realistic peak behaviour and coverage of the full valid range, producing better generalisation on real-world inputs.

---

### 3.3 The Machine Learning Model

**Algorithm:** `sklearn.ensemble.RandomForestClassifier`  
**Pipeline:** `StandardScaler` → `RandomForestClassifier`  
**Output:** Multi-class probability distribution over 22 crops

The model is trained once, serialised to disk as `crop_pipeline.pkl`, and loaded at Flask startup. All predictions call `pipeline.predict_proba(X)` which returns a probability for each of the 22 crop classes. The top-3 highest-probability crops are returned.

---

### 3.4 Random Forest Algorithm — Deep Dive

#### Step 1: Decision Trees (Building Blocks)

A Decision Tree is a binary tree where each internal node splits the data based on a feature and a threshold:

```
Is rainfall < 100 mm?
    YES → Is temperature > 30°C?
              YES → mothbeans  (dry + hot)
              NO  → cotton     (dry + warm)
    NO  → Is humidity > 80%?
              YES → rice       (wet + humid)
              NO  → maize      (wet + moderate)
```

Each split is chosen to maximise **information gain** (how much the split reduces uncertainty about the crop class). The tree keeps splitting until it perfectly classifies the training data (or hits a depth limit).

**Problem with a single tree:** It overfits the training data. Small changes in input can lead to completely different outputs.

#### Step 2: Ensemble = Many Trees (Bagging)

A Random Forest builds **N independent decision trees** (300 trees in this project) using a technique called **Bootstrap Aggregation (Bagging)**:

1. For each tree, draw a **bootstrap sample** — a random subset of training rows with replacement. Each tree sees ~63% of the data; the rest (~37%) is the "out-of-bag" validation set.
2. At each split, consider only a **random subset of features** (by default: √7 ≈ 3 features). This forces diversity among trees — no single dominant feature can control all trees.
3. Each tree independently predicts class probabilities.
4. The forest's final prediction is the **average of all 300 trees' probability distributions**.

```
Tree 1:  rice=0.85, maize=0.08, jute=0.07, ...
Tree 2:  rice=0.91, jute=0.06, maize=0.03, ...
Tree 3:  rice=0.78, maize=0.14, chickpea=0.08, ...
...
Tree 300: rice=0.82, maize=0.11, jute=0.07, ...

AVERAGE → rice=0.84, maize=0.09, jute=0.06, ...
                  ↑
          Final recommendation: RICE at 84% confidence
```

#### Why Random Forest for This Problem?

| Requirement | How RF handles it |
|-------------|------------------|
| 22-class classification | Natively multi-class; no one-vs-rest wrappers needed |
| Mixed feature scales (N: 10–200 vs pH: 5.5–7.5) | Not sensitive to scale differences (tree splits use thresholds, not distances) |
| Non-linear relationships | Captures complex interactions (e.g., high N is good for rice only when humidity is also high) |
| Feature importance | Mean Decrease in Impurity (MDI) is free — every tree tracks how much each feature reduced Gini impurity |
| Outlier robustness | A single outlier affects at most a few trees; the ensemble averages it out |
| Training speed | Fully parallelisable (`n_jobs=-1` uses all CPU cores) |

#### Gini Impurity (Split Criterion)

At each node, the algorithm tries every possible (feature, threshold) pair and picks the one that maximises the **Gini gain**:

```
Gini(node) = 1 - Σ(p_i²)   for all classes i

where p_i = fraction of samples in the node belonging to class i
```

A pure node (all samples are rice) has Gini = 0. A perfectly mixed 22-class node has Gini ≈ 1 − 22 × (1/22)² ≈ 0.955.

---

### 3.5 Training Pipeline

The full pipeline used for training is:

```python
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier

# Step 1: Encode 22 crop name strings → integers 0–21
le = LabelEncoder()
y  = le.fit_transform(df["label"])   # "rice" → 20, "apple" → 0, etc.
X  = df[["N","P","K","temperature","humidity","ph","rainfall"]].values

# Step 2: Stratified 80/20 train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y
)
# 5,280 training samples  |  1,320 test samples
# stratify=y ensures every crop has 80% in train and 20% in test

# Step 3: Build Pipeline
pipeline = Pipeline([
    ("scaler", StandardScaler()),         # z-score normalise each feature
    ("clf",    RandomForestClassifier(    # tuned by RandomizedSearchCV
                   n_estimators=300,
                   max_depth=None,
                   min_samples_split=4,
                   min_samples_leaf=1,
                   max_features="sqrt",
                   random_state=42,
                   n_jobs=-1
               ))
])
```

**Why `StandardScaler` inside the Pipeline?**

`StandardScaler` converts each feature to zero mean and unit variance:  
```
z = (x − mean) / std
```

For example, `temperature` ranges 0–55°C while `N` ranges 0–200 kg/ha. Without scaling, a distance-based model would treat a 1°C difference as equivalent to a 1 kg/ha difference — clearly wrong. Even though Random Forest doesn't strictly need scaling (it uses thresholds, not distances), bundling the scaler in the Pipeline guarantees:
- The **same mean and std** used during training are automatically applied during prediction — no "forgot to scale" bug.
- If the model is later swapped to an SVM or KNN (which need scaling), the pipeline still works unchanged.

**Why wrap everything in a `Pipeline`?**

A scikit-learn Pipeline bundles preprocessing and model into a single object. When you call `pipeline.predict(X)`, it automatically applies `StandardScaler.transform(X)` then `RandomForestClassifier.predict(transformed_X)`. This eliminates the most common source of train-test leakage: accidentally fitting the scaler on test data.

---

### 3.6 Hyperparameter Tuning

**Method:** `RandomizedSearchCV` with `StratifiedKFold` cross-validation

```python
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold

param_dist = {
    "clf__n_estimators":      [100, 200, 300, 500],       # number of trees
    "clf__max_depth":         [None, 10, 15, 20, 30],     # max tree depth (None = unlimited)
    "clf__min_samples_split": [2, 4, 6],                   # min samples to split a node
    "clf__min_samples_leaf":  [1, 2, 3],                   # min samples in a leaf node
    "clf__max_features":      ["sqrt", "log2", None],      # features per split
}

cv_splitter = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

search = RandomizedSearchCV(
    pipeline,
    param_distributions=param_dist,
    n_iter=30,             # try 30 random combinations (not all 4×5×3×3×3 = 540)
    scoring="accuracy",
    cv=cv_splitter,
    n_jobs=-1,
    random_state=42,
)
search.fit(X_train, y_train)
```

#### What each hyperparameter controls

| Hyperparameter | Effect |
|---------------|--------|
| `n_estimators` | More trees → more stable predictions, but slower training. 300 is a good balance. |
| `max_depth` | Limits tree growth. `None` means trees grow until all leaves are pure — best accuracy on this dataset. |
| `min_samples_split` | Minimum samples required to split a node. Higher values reduce overfitting. Best: 4. |
| `min_samples_leaf` | Minimum samples in a leaf. 1 means the tree can create single-sample leaves. |
| `max_features` | `"sqrt"` means use √7 ≈ 3 random features per split — core to RF diversity. |

#### Why RandomizedSearchCV instead of GridSearchCV?

GridSearchCV would try all 4 × 5 × 3 × 3 × 3 = **540 combinations**, each with 5-fold CV = **2,700 model fits**. At ~3 seconds each, that's over 2 hours.

RandomizedSearchCV picks **30 random combinations** (30 × 5 = 150 fits). Research has shown that random search finds near-optimal hyperparameters as reliably as grid search in far fewer iterations, because typically only a few parameters matter a lot and the others are largely irrelevant.

#### What is Stratified K-Fold CV?

In standard K-Fold, the training data is split into K equal parts. Each fold is used as validation once, and the remaining K−1 folds form the training set. The average accuracy across all folds is the CV score.

**Stratified** K-Fold ensures each fold contains the same proportion of each class as the original dataset. Without stratification, a fold might accidentally contain very few rice samples, making rice accuracy artificially low.

With 5,280 training samples × 22 crops × 300 samples each, each fold has exactly 240 samples per crop.

---

### 3.7 Model Performance Metrics

From `ml-model/crop_recommendation/model_metrics.json` (trained 2026-04-27):

| Metric | Value |
|--------|-------|
| Test accuracy | **94.92%** |
| Cross-validation mean accuracy | **95.32%** |
| Cross-validation std | ±0.70% |
| Best CV accuracy (single fold) | 95.32% |
| Training samples | 5,280 |
| Test samples | 1,320 |
| Model type | Pipeline(StandardScaler + RandomForestClassifier) |
| Crop classes | 22 |

**Best hyperparameters found by RandomizedSearchCV:**

```json
{
    "clf__n_estimators": 300,
    "clf__min_samples_split": 4,
    "clf__min_samples_leaf": 1,
    "clf__max_features": "sqrt",
    "clf__max_depth": null
}
```

**Interpreting the results:**

- **94.92% test accuracy** means the model correctly identifies the crop from 7 soil/climate features in ~95 out of 100 cases on data it has never seen.
- **CV std of ±0.70%** is very low — the model performs consistently regardless of which 80% of the data it trains on. This confirms it is not overfitting.
- The small gap between CV accuracy (95.32%) and test accuracy (94.92%) is normal and expected.

---

### 3.8 Feature Importance Analysis

Random Forest computes **Mean Decrease in Impurity (MDI)** — how much each feature reduces Gini impurity across all trees. Higher importance = the feature is more discriminative.

| Rank | Feature | Importance | Interpretation |
|------|---------|-----------|----------------|
| 1 | `humidity` | **26.3%** | Humidity range is the primary distinguisher: rice needs 80–90%, cotton needs 50–70%, apple needs 88–97% |
| 2 | `rainfall` | **21.9%** | Monthly rainfall strongly separates fruit crops (coconut: 130–200 mm) from dryland crops (mothbeans: 40–75 mm) |
| 3 | `temperature` | **15.8%** | Apple (0–20°C) vs papaya (22–32°C) vs mothbeans (28–40°C) — temperature separates climate zones |
| 4 | `N` (Nitrogen) | **12.5%** | Pulses have very low N needs (10–30 kg/ha); cereals and cash crops need 60–180 kg/ha |
| 5 | `K` (Potassium) | **12.4%** | Banana and coconut need very high K (80–160 kg/ha); pulses need very little (20–40 kg/ha) |
| 6 | `ph` | **5.6%** | pH distinguishes coffee/blueberries (acidic 5.5–6.5) from pulses (6.0–7.5) |
| 7 | `P` (Phosphorus) | **5.5%** | Least discriminative feature — most crops tolerate similar P ranges |

**Key insight:** Climate features (humidity, rainfall, temperature) are more important than soil nutrients for distinguishing the 22 crop classes, because the crops were deliberately drawn from very different climate zones. Within a given climate zone, NPK becomes more important for fine-grained selection.

---

### 3.9 Flask ML Sidecar Service

**File:** `backend/app.py`  
**Port:** 5401 (configurable via `ML_PORT` environment variable)

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Plain-text health check |
| `GET` | `/health` | JSON health status + model readiness |
| `GET` | `/metrics` | Full model metadata from `model_metrics.json` |
| `POST` | `/predict-crop` | Main prediction endpoint |

#### Prediction Endpoint: `POST /predict-crop`

**Request body (JSON):**
```json
{
    "N": 90,
    "P": 42,
    "K": 43,
    "temperature": 21.5,
    "humidity": 82,
    "ph": 6.5,
    "rainfall": 130
}
```

**Response:**
```json
{
    "recommended_crop": "rice",
    "confidence": 0.9233,
    "top3": [
        {"crop": "rice",  "confidence": 0.9233},
        {"crop": "jute",  "confidence": 0.0412},
        {"crop": "maize", "confidence": 0.0201}
    ]
}
```

#### Input Validation

Before running inference, the service validates every input against hard agronomic bounds:

| Feature | Valid Range | Rationale |
|---------|------------|-----------|
| N | 0–200 kg/ha | Above 200 causes nitrogen burn |
| P | 0–150 kg/ha | Physical soil capacity limit |
| K | 0–250 kg/ha | Physical soil capacity limit |
| temperature | −10 to 55°C | Below −10 = permafrost; above 55 = no crops survive |
| humidity | 0–100% | Physical bound |
| ph | 0–14 | Standard pH scale |
| rainfall | 0–500 mm/month | Practical maximum for India (Cherrapunji is ~1,100 mm/month — extreme outlier) |

Out-of-range values return `400 Bad Request` with a specific error message, rather than silently producing a nonsensical prediction.

#### Model Loading at Startup

```python
_pipeline      = None   # StandardScaler + RandomForestClassifier
_label_encoder = None   # int → crop name
_model_metrics = {}     # accuracy, feature importance, etc.

def _load_model():
    with open("crop_pipeline.pkl", "rb") as f:
        _pipeline = pickle.load(f)
    with open("label_encoder.pkl", "rb") as f:
        _label_encoder = pickle.load(f)
    # Log test accuracy so it's visible in server logs
    log.info("Model loaded (test accuracy: %s)", _model_metrics.get("test_accuracy"))

_load_model()  # called once at Flask startup
```

Loading once at startup (not per request) means prediction latency is typically under 10 ms.

---

### 3.10 Rule-Based Scoring Engine

**File:** `backend/services/cropPlanningService.js`  
**Function:** `getRecommendations(field, recentCropKey)`

This engine scores every crop profile against a field and returns the top-3 scoring crops. It works entirely from the field's stored attributes — no ML, no external APIs.

#### Scoring Algorithm

Starting score for every crop: **50 points**

| Factor | Condition | Points |
|--------|-----------|--------|
| Soil type | Profile's `preferredSoils` includes field's soil | +20 |
| Soil type | Profile's `preferredSoils` does NOT include field's soil | −10 |
| Water need (high) | Crop needs high water AND field has canal/drip/regular irrigation | +10 |
| Water need (low) | Crop needs low water AND field is rain-fed | +8 |
| Season (Kharif) | Season is kharif AND crop is paddy/cotton/groundnut/maize | +10 |
| Season (Rabi) | Season is rabi AND crop is pulses/millets/vegetables | +8 |
| Rotation conflict | Last crop is in this crop's `rotationAvoid` list | **−25** |
| Nitrogen | Field's N is within crop's ideal range | +8 |
| Nitrogen | Field's N is outside crop's ideal range | −8 |
| Phosphorus | Field's P is within crop's ideal range | +8 |
| Phosphorus | Field's P is outside crop's ideal range | −8 |
| Potassium | Field's K is within crop's ideal range | +8 |
| Potassium | Field's K is outside crop's ideal range | −8 |
| pH | Field's pH is within crop's ideal range | +10 |
| pH | Field's pH is too acidic | −10 |
| pH | Field's pH is too alkaline | −10 |
| Regional preference | Field is in AP delta (Godavari/Guntur/Krishna) + crop is paddy/cotton/groundnut | +5 |

Final score is clamped to [0, 100]. Crops are ranked by score and the top 3 are returned.

#### Example Scoring: Paddy on a Clay Kharif Field

```
Field: soilType="clay", irrigation="canal", season="kharif",
       nitrogen=90, phosphorus=40, potassium=45, ph=6.2

Paddy profile:
  preferredSoils: ["clay", "loam", "alluvial"]
  waterNeed: "high"
  rotationAvoid: ["paddy"]
  npk: { nMin:60, nMax:120, pMin:30, pMax:60, kMin:30, kMax:60 }
  phRange: { min:5.5, max:6.5 }

Score calculation:
  Start           = 50
  Clay soil match = +20  (clay is in preferredSoils)
  Canal + high    = +10  (water need matched)
  Kharif season   = +10  (paddy is kharif crop)
  N=90 in [60,120]= +8
  P=40 in [30,60] = +8
  K=45 in [30,60] = +8
  pH=6.2 in [5.5,6.5] = +10
  Total           = 124 → clamped to 100
```

Paddy scores 100 for this field — exactly as expected agronomically.

#### Crop Profiles

The engine has 16 crop profiles covering the major crops grown in India:

paddy · cotton · groundnut · maize · millets · pulses · vegetables · sugarcane · chilli · sunflower · pigeon pea · watermelon · cowpea · jute · coffee · coconut

Each profile contains: preferred soil types, water need level, crops to avoid in rotation, crops preferred in rotation, NPK ideal ranges, and ideal pH range.

#### Soil-Type Rule Map

A simpler lookup table also maps soil type directly to compatible crops:

```javascript
const soilRuleMap = {
    "clay":     ["paddy", "sugarcane", "jute"],
    "loam":     ["paddy", "groundnut", "cotton", "maize", "vegetables", ...],
    "sandy":    ["groundnut", "millets", "watermelon", "cowpea"],
    "black":    ["cotton", "chilli", "pigeonpea", "sunflower", "maize"],
    "red":      ["groundnut", "millets", "cotton", "maize", "chickpea"],
    "alluvial": ["paddy", "sugarcane", "jute", "maize", "vegetables"],
    "laterite": ["coffee", "coconut", "millets"],
};
```

---

### 3.11 Weather Integration

Live weather is fetched from **OpenWeatherMap API** using the field's geographic coordinates. The response provides:
- `main.temp` → temperature (°C)
- `main.humidity` → humidity (%)

**Why live weather instead of static values?**
Crop suitability changes with season. Sending real-time temperature and humidity means the model correctly distinguishes, for example, whether it's currently the hot dry season (favourable for cotton) or the wet cool season (favourable for paddy).

**District coordinate resolution:**
If the field has explicit GPS latitude/longitude, those are used directly. Otherwise, the controller looks up the district name in a table of 80+ major agricultural districts across 15 Indian states.

**Rainfall — Why NOT the live API value:**
OpenWeatherMap provides `rain["1h"]` — accumulated rain in the last hour. This is almost always `0` (it's only non-zero when it's actively raining at the moment of the API call). The ML model was trained on **monthly-average rainfall in mm/month** (ranging from 18 to 300 mm).

Sending `0` every time would make the model think every field is a desert, causing it to always recommend drought-tolerant crops (chickpea, mothbeans, muskmelon) regardless of location.

**Solution:** A lookup table of **average monthly rainfall** (from IMD — India Meteorological Department annual normals ÷ 12) for 80+ districts is used instead:

```javascript
const DISTRICT_AVG_MONTHLY_RAINFALL = {
    "east godavari": 130,   // mm/month
    "west godavari": 110,
    "krishna":        95,
    "kozhikode":     280,   // Kerala: very high
    "bikaner":        25,   // Rajasthan: arid
    ...
};
```

---

### 3.12 Confidence Threshold and Graceful Degradation

The ML model returns a probability between 0 and 1 for its top recommendation. A confidence of `1.0` means the model is certain; `1/22 ≈ 0.045` means it's randomly guessing.

**Threshold:** `MIN_ML_CONFIDENCE = 0.35`

- If `confidence ≥ 0.35` → Return ML result as the primary recommendation.
- If `confidence < 0.35` → Flag it as `mlSource: "ml_low_confidence"`. The frontend shows a warning that the ML result is uncertain and the rule-based result may be more reliable.

This prevents the system from confidently presenting a guess as a reliable recommendation.

**Additional degradation paths:**

| Situation | System Behaviour |
|-----------|-----------------|
| Field has no N/P/K/pH data | Skip ML entirely; return rule-based only with message to add soil test data |
| Weather API is unreachable | Skip ML entirely; return rule-based only |
| Flask ML service is offline | Return rule-based only; log the error |
| ML confidence < 35% | Return both, flag ML as low-confidence |

---

### 3.13 End-to-End Request Flow

```
1. User opens "Get ML Recommendation" for a field
        ↓
2. Frontend sends:
   POST /api/crop-planning/recommend
   Body: { "fieldId": "64f2a..." }
   Headers: Authorization: Bearer <JWT>
        ↓
3. Express backend:
   a. Validates JWT, extracts farmer ID
   b. Queries MongoDB: Field.findOne({ _id: fieldId, farmerId: req.user.id })
   c. Checks: does field have nitrogen, phosphorus, potassium, ph?
        ↓
4. (if NPK present) Fetch weather:
   GET https://api.openweathermap.org/data/2.5/weather?lat=16.50&lon=80.64&units=metric
   → { main: { temp: 28.4, humidity: 74 } }
        ↓
5. Look up district monthly rainfall:
   field.district = "krishna" → avgMonthlyRain = 95 mm/month
        ↓
6. Post to Flask ML sidecar:
   POST http://localhost:5401/predict-crop
   { N: 90, P: 42, K: 43, ph: 6.5, temperature: 28.4, humidity: 74, rainfall: 95 }
        ↓
7. Flask pipeline:
   a. StandardScaler normalises all 7 values
   b. RandomForestClassifier.predict_proba() → probability vector (22 values)
   c. Sort descending, take top-3 with confidence > 5%
   → { recommended_crop: "cotton", confidence: 0.73,
       top3: [cotton:0.73, maize:0.14, groundnut:0.09] }
        ↓
8. Back in Express:
   a. 0.73 ≥ 0.35 → mlSource = "ml"
   b. Run rule-based engine: scoreCrop() for all 16 crop profiles
      → [Cotton:92, Groundnut:78, Maize:71]
   c. Run buildRotationPlan() for rotation suggestions
        ↓
9. Return combined response to frontend:
   {
     fieldId: "64f2a...",
     fieldName: "North Field",
     mlRecommendation: {
       recommended_crop: "cotton", confidence: 0.73,
       top3: [...]
     },
     mlSource: "ml",
     ruleRecommendations: [
       { crop: "Cotton", score: 92, reasons: ["Matches black soil", "N=90 suits Cotton"] },
       { crop: "Groundnut", score: 78, ... },
       ...
     ],
     rotationPlan: {
       currentCrop: "Cotton",
       nextCropOptions: ["Pulses", "Groundnut", "Maize"],
       notes: ["Insert a pulse or legume crop to restore soil nitrogen."]
     }
   }
```

---

## 4. Crop Rotation Feature

### 4.1 What Is Crop Rotation and Why It Matters

**Crop rotation** is the practice of growing different types of crops in the same field across different seasons or years. This is one of the oldest and most effective agricultural practices, with documented benefits:

| Problem Solved | Explanation |
|---------------|-------------|
| **Soil nutrient depletion** | Every crop removes specific nutrients. Rice extracts nitrogen heavily. Planting rice every season depletes nitrogen until yields collapse. |
| **Soil nitrogen restoration** | Pulse and legume crops (chickpea, lentil, pigeonpea) have root bacteria (Rhizobium) that fix atmospheric nitrogen back into the soil — a free natural fertiliser. |
| **Pest and disease cycle breaking** | Many soil pests and pathogens are crop-specific. Changing crops breaks their life cycle. Continuous cotton grows boll weevil populations; rotating cotton → pulses crashes them. |
| **Soil structure improvement** | Deep-rooted crops (sugarcane, maize) break compaction. Shallow-rooted crops (pulses) improve topsoil. Alternating improves overall structure. |
| **Weed suppression** | Different crops shade the soil differently and suppress different weed species. |

The project implements crop rotation at two levels of sophistication.

---

### 4.2 Simple Rotation API (Flask)

**File:** `ml-model/crop_rotation.py`

A standalone Flask API that implements the simplest possible rotation rule — a fixed lookup table:

```python
rotation_map = {
    "rice":      "pulses",
    "pulses":    "maize",
    "maize":     "legumes",
    "wheat":     "vegetables",
    "cotton":    "wheat",
    "sugarcane": "pulses",
    "groundnut": "wheat",
    "soybean":   "maize",
}

next_crop = rotation_map.get(prev_crop, "pulses")
```

**API Usage:**
```
POST /predict
Body: { "previous_crop": "cotton" }
Response: { "next_crop": "wheat" }
```

**Rotation logic rationale:**
- After **rice** → **pulses**: Rice is a heavy nitrogen feeder; pulses fix nitrogen back.
- After **cotton** → **wheat**: Cotton exhausts potassium; wheat is less demanding and restores structure.
- After **sugarcane** → **pulses**: Sugarcane is a very long-duration crop that depletes multiple nutrients; pulses restore N.
- Default (unknown crop) → **pulses**: When in doubt, a pulse crop is almost always beneficial.

This simple API is the prototype layer. The production-grade rotation planner is in the Node.js backend.

---

### 4.3 Advanced Rotation Planner (Node.js Service)

**File:** `backend/services/cropPlanningService.js`  
**Function:** `buildRotationPlan(field, lastCropKey)`

The advanced planner uses the full crop profile system to generate crop-specific, context-aware rotation plans.

```javascript
function buildRotationPlan(field, lastCropKey) {
    const currentCrop = normalize(field.cropName);   // e.g., "paddy"
    const lastCrop    = lastCropKey || currentCrop;

    // Get the crop profile for the current/last crop
    const profile = cropProfiles[currentCrop] || cropProfiles[lastCrop];

    // Get preferred next crops, excluding the current and last crops
    const nextOptions = profile?.rotationPreferred || ["pulses", "millets", "groundnut"];
    const immediateNext = nextOptions
        .filter(cropKey => cropKey !== currentCrop && cropKey !== lastCrop)
        .slice(0, 3)
        .map(cropKey => cropProfiles[cropKey]?.label || cropKey);

    // Build warning notes
    const rotationNotes = [];
    if (profile?.rotationAvoid?.includes(lastCrop)) {
        rotationNotes.push(`Avoid planting ${profile.label} after ${lastCrop}`);
    }
    rotationNotes.push("Insert a pulse or legume crop to restore soil nitrogen.");

    return {
        currentCrop:     profile?.label || field.cropName,
        lastCrop:        cropProfiles[lastCrop]?.label || field.cropName,
        nextCropOptions: immediateNext.length ? immediateNext : ["Pulses", "Millets"],
        notes:           rotationNotes,
    };
}
```

**Example output for a paddy field:**
```json
{
    "currentCrop": "Paddy",
    "lastCrop": "Paddy",
    "nextCropOptions": ["Pulses", "Groundnut", "Millets"],
    "notes": [
        "Avoid planting Paddy after Paddy",
        "Insert a pulse or legume crop to restore soil nitrogen."
    ]
}
```

---

### 4.4 Crop Profiles and Rotation Rules

Each crop profile contains two rotation-specific fields:

- **`rotationAvoid`**: Crops that should not follow this crop (or precede it). Planting the same crop immediately scores **−25 points** in the recommendation engine.
- **`rotationPreferred`**: Crops that are agronomically ideal to plant next, based on complementary nutrient profiles and pest cycle benefits.

| Crop | Avoid After | Preferred Next |
|------|------------|----------------|
| Paddy | paddy (self) | pulses, groundnut, millets |
| Cotton | cotton, chilli | pulses, groundnut, maize |
| Groundnut | groundnut, cotton | paddy, millets, maize |
| Maize | maize (self) | pulses, groundnut, millets |
| Millets | millets (self) | pulses, groundnut, cotton |
| Pulses | pulses (self) | paddy, maize, cotton |
| Sugarcane | sugarcane (self) | pulses, groundnut |
| Vegetables | vegetables (self) | pulses, millets |
| Sunflower | sunflower (self) | pulses, maize, millets |
| Chilli | chilli, cotton | pulses, groundnut, maize |

**Key agronomic principles encoded:**
1. **Legume principle**: Pulses, groundnut, and cowpea always appear as "preferred next" for nitrogen-hungry crops (paddy, maize, cotton) because they fix atmospheric N₂.
2. **Same-family avoidance**: No crop should follow a crop in the same botanical family. Chilli and cotton are both from warm-season, nutrient-demanding categories — they share pest pressures.
3. **Diversity principle**: Alternating between root crops, legumes, and cereals maximises soil health across all nutrient dimensions.

---

### 4.5 Rotation Integration with Crop Recommendation

Crop rotation is not isolated — it is deeply integrated into the scoring algorithm:

```javascript
function scoreCrop(field, cropKey, recentCropKey) {
    const profile = cropProfiles[cropKey];
    let score = 50;
    ...
    // Rotation conflict check
    if (recentCropKey && profile.rotationAvoid.includes(recentCropKey)) {
        score -= 25;    // ← Heavy penalty for monoculture
        notes.push(`Avoid repeating ${recentCropKey} after the last season`);
    }
    ...
}
```

If the farmer grew paddy last season and the recommendation engine is scoring paddy again, paddy loses 25 points. This makes pulses, groundnut, or millets score higher — the system naturally promotes rotation without explicitly forcing it.

---

## 5. All Python Libraries and Models Used

### scikit-learn (sklearn) Components

| Class / Function | What it does in this project |
|----------------|------------------------------|
| `RandomForestClassifier` | Core ML model — ensemble of 300 decision trees for 22-class crop classification |
| `StandardScaler` | Normalises each feature to zero mean, unit variance |
| `Pipeline` | Chains StandardScaler → RandomForestClassifier into a single reusable object |
| `LabelEncoder` | Converts crop name strings ("rice", "maize"...) to integers 0–21 and back |
| `train_test_split` | Splits 6,600 samples into 80% training (5,280) and 20% test (1,320) |
| `RandomizedSearchCV` | Finds near-optimal hyperparameters by testing 30 random combinations |
| `StratifiedKFold` | 5-fold cross-validation that preserves class proportions in each fold |
| `cross_val_score` | Measures accuracy stability across 5 different train/validation splits |
| `accuracy_score` | Computes percentage of correct predictions on the held-out test set |
| `classification_report` | Per-class precision, recall, F1 score for all 22 crop classes |

### NumPy

Used in `generate_crop_dataset.py` for:
- `np.random.default_rng(seed=42)` — reproducible random number generation
- `rng.normal()` — Gaussian sampling for 70% of each crop's samples
- `rng.uniform()` — Uniform sampling for 30% of each crop's samples
- `np.clip()` — Clipping values to valid agronomic bounds
- `np.concatenate()` — Merging Gaussian and Uniform samples

### pandas

Used in training and inference for:
- `pd.read_csv()` — Loading the CSV dataset
- `pd.DataFrame([values], columns=FEATURES)` — Wrapping a single prediction input into the format `predict_proba()` expects
- `df["label"].value_counts()` — Verifying class balance in the dataset

### Flask + Flask-CORS

- `Flask` — Lightweight Python web server hosting the ML inference API on port 5401
- `flask_cors.CORS(app)` — Allows the Node.js backend (different port) to call the Flask API without CORS errors in development

### pickle

- `pickle.dump(pipeline, f)` — Serialises the trained Pipeline to `crop_pipeline.pkl`
- `pickle.dump(le, f)` — Serialises the LabelEncoder to `label_encoder.pkl`
- `pickle.load(f)` — Deserialises both at Flask startup for fast inference

### Python standard library

- `json` — Reading/writing `model_metrics.json`
- `logging` — Structured server-side logging (replaces `print()`)
- `os` — File path construction across operating systems

---

## 6. Design Decisions and Why

### Why Random Forest and not Neural Networks?

| Criterion | Random Forest | Neural Network |
|-----------|--------------|----------------|
| Dataset size | Excellent for 6,600 samples | Needs 50,000+ to train well |
| Interpretability | Built-in feature importance | Black box (requires SHAP/LIME) |
| Training time | Seconds on a laptop | Minutes/hours without GPU |
| Overfitting risk | Low (bagging reduces variance) | High without careful regularisation |
| Deployment | Single `.pkl` file (~5 MB) | Requires TensorFlow/PyTorch runtime |
| Inference speed | < 5 ms per prediction | 5–50 ms (CPU) |

For a tabular 7-feature 22-class classification problem with 6,600 samples, Random Forest is the standard first choice.

### Why a Synthetic Dataset?

Collecting real soil samples + crop yield data for 22 crops across all of India would require:
- Soil labs in multiple states
- Years of growing seasons
- Standardised measurement protocols
- Privacy and ownership agreements

Synthetic data generated from **peer-reviewed agronomic literature** (FAO + ICAR) is a valid and widely used approach when real data is unavailable or insufficient. The key requirement is that the synthetic ranges match real agronomic conditions — which they do, since they come from the same literature that guides real farmers.

### Why Two Layers (ML + Rule-Based)?

A pure ML system fails when:
- The field has no soil test data (common for subsistence farmers)
- The weather API is down (network issues, API key limits)
- The ML service crashes during deployment

A rule-based-only system is limited because:
- It cannot capture complex multi-factor interactions (temperature × humidity × rainfall)
- It cannot learn from data

The two-layer hybrid approach takes the best of both: reliable always-on recommendations from the rule engine, with ML precision when data is available.

### Why Flask and not a Node.js ML library?

JavaScript ML libraries (brain.js, TensorFlow.js) are designed primarily for neural networks, not ensemble classifiers. scikit-learn's Random Forest has years of testing, documentation, and community support. Running a separate Flask sidecar adds minimal operational complexity (one extra process) for significant gain in using the best tool for each job.

---

## 7. Complete Crop and Data Reference

### All 22 Crop Agronomic Profiles (Training Data Ranges)

| Crop | N (kg/ha) | P (kg/ha) | K (kg/ha) | Temp (°C) | Humidity (%) | pH | Rainfall (mm/mo) |
|------|----------|----------|----------|----------|-------------|-----|-----------------|
| rice | 60–120 | 30–60 | 30–60 | 20–27 | 80–90 | 5.5–6.5 | 150–300 |
| maize | 80–140 | 40–70 | 30–60 | 18–28 | 55–75 | 5.8–7.0 | 50–100 |
| jute | 60–120 | 30–60 | 30–60 | 24–37 | 70–90 | 6.0–7.0 | 150–250 |
| chickpea | 10–30 | 40–80 | 20–40 | 18–26 | 14–22 | 6.0–7.5 | 60–100 |
| kidneybeans | 10–30 | 40–80 | 20–40 | 15–23 | 18–24 | 5.5–7.0 | 100–150 |
| pigeonpeas | 15–40 | 30–60 | 20–40 | 25–35 | 40–60 | 6.0–7.5 | 60–100 |
| mothbeans | 15–35 | 30–60 | 20–40 | 28–40 | 45–65 | 6.0–7.5 | 40–75 |
| mungbean | 10–30 | 30–60 | 20–40 | 25–35 | 80–90 | 6.0–7.5 | 60–100 |
| blackgram | 10–30 | 30–60 | 20–40 | 25–35 | 65–75 | 6.0–7.5 | 65–100 |
| lentil | 10–30 | 40–80 | 20–40 | 13–23 | 55–70 | 6.0–7.5 | 35–60 |
| cotton | 80–160 | 40–80 | 40–80 | 21–30 | 50–70 | 6.0–7.5 | 60–110 |
| coffee | 60–120 | 30–60 | 30–60 | 15–28 | 78–92 | 5.5–6.5 | 150–250 |
| pomegranate | 60–120 | 30–60 | 40–80 | 25–38 | 40–70 | 5.5–7.0 | 50–90 |
| banana | 80–140 | 40–80 | 80–160 | 25–35 | 75–85 | 5.5–7.0 | 100–200 |
| mango | 60–120 | 30–60 | 30–60 | 24–35 | 48–68 | 5.5–7.5 | 90–200 |
| grapes | 60–120 | 30–60 | 40–80 | 15–25 | 62–78 | 5.5–7.5 | 55–95 |
| watermelon | 50–100 | 40–80 | 60–120 | 24–35 | 78–90 | 6.0–7.0 | 40–70 |
| muskmelon | 50–100 | 40–80 | 60–120 | 28–38 | 88–97 | 6.0–7.0 | 18–38 |
| apple | 40–80 | 40–80 | 40–80 | 0–20 | 88–97 | 5.5–6.5 | 100–200 |
| orange | 60–120 | 30–60 | 30–60 | 10–30 | 88–97 | 6.0–7.5 | 110–200 |
| papaya | 60–120 | 30–60 | 60–120 | 22–32 | 88–97 | 5.5–6.5 | 140–200 |
| coconut | 50–100 | 30–60 | 80–160 | 25–35 | 88–97 | 5.5–7.5 | 130–200 |

*Sources: FAO crop water requirements manuals, ICAR package-of-practices guides*

### Feature Importance Rankings (Final Model)

```
Rank  Feature        Importance  (sum = 1.0)
  1   humidity       0.2631     ████████████████████████████
  2   rainfall       0.2191     ████████████████████████
  3   temperature    0.1575     █████████████████
  4   N (Nitrogen)   0.1246     █████████████
  5   K (Potassium)  0.1240     █████████████
  6   ph             0.0565     ██████
  7   P (Phosphorus) 0.0552     ██████
```

### Model Configuration (Best Parameters)

```python
Pipeline([
    ("scaler", StandardScaler()),
    ("clf", RandomForestClassifier(
        n_estimators=300,       # 300 decision trees in the forest
        max_depth=None,         # trees grow until leaves are pure
        min_samples_split=4,    # a node needs ≥ 4 samples to be split further
        min_samples_leaf=1,     # a leaf can have as few as 1 sample
        max_features="sqrt",    # each split considers √7 ≈ 3 random features
        random_state=42,        # reproducible results
        n_jobs=-1               # use all CPU cores for parallel training
    ))
])
```

### Saved Model Artefacts

| File | Size (approx.) | Contents | Purpose |
|------|---------------|----------|---------|
| `crop_pipeline.pkl` | ~5–10 MB | Serialised Pipeline object (scaler + 300 trees × 22 classes) | Loaded by Flask at startup for inference |
| `label_encoder.pkl` | < 1 KB | List of 22 class names in sorted order | Converts integer predictions back to crop names |
| `model_metrics.json` | < 1 KB | Test accuracy, CV scores, feature importance, training date, best params | Exposed by `GET /metrics`; used for model monitoring |
| `Crop_recommendation.csv` | ~750 KB | 6,600 × 8 CSV (7 features + label) | Training/test data; regenerate with `generate_crop_dataset.py` |

### Reproducibility

All random seeds are fixed to `42`:
- `np.random.default_rng(seed=42)` in dataset generation
- `train_test_split(..., random_state=42)`
- `RandomForestClassifier(random_state=42)`
- `StratifiedKFold(..., random_state=42)`
- `RandomizedSearchCV(..., random_state=42)`

Re-running `generate_crop_dataset.py` then `train_crop_model.py` will always produce the same dataset and the same model.

---

*This documentation was generated from the source code of the Smart Agriculture Platform. All metrics are from the live model trained on 2026-04-27.*
