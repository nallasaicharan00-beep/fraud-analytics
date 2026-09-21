import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, classification_report
import joblib

# -----------------------------------------
# TRAINING DATA
# -----------------------------------------

data = {
    "amount": [
        500, 1200, 3000, 5000, 8000,
        15000, 20000, 30000, 50000, 80000,
        1000, 2500, 7000, 18000, 45000,
        600, 1500, 4000, 9000, 12000,
        25000, 35000, 60000, 90000, 120000
    ],

    "international": [
        0, 0, 0, 0, 0,
        0, 0, 0, 1, 1,
        0, 0, 0, 1, 1,
        0, 0, 0, 0, 1,
        0, 1, 1, 1, 1
    ],

    "new_device": [
        0, 0, 0, 0, 0,
        0, 0, 1, 1, 1,
        0, 0, 0, 1, 1,
        0, 0, 0, 1, 1,
        1, 1, 1, 1, 1
    ],

    "high_frequency": [
        0, 0, 0, 0, 0,
        0, 0, 1, 1, 1,
        0, 0, 0, 1, 1,
        0, 0, 0, 0, 1,
        1, 1, 1, 1, 1
    ],

    "is_fraud": [
        0, 0, 0, 0, 0,
        0, 0, 0, 1, 1,
        0, 0, 0, 1, 1,
        0, 0, 0, 0, 1,
        0, 1, 1, 1, 1
    ]
}

df = pd.DataFrame(data)

# -----------------------------------------
# FEATURES AND TARGET
# -----------------------------------------

X = df[
    [
        "amount",
        "international",
        "new_device",
        "high_frequency"
    ]
]

y = df["is_fraud"]

# -----------------------------------------
# TRAIN / TEST SPLIT
# -----------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# -----------------------------------------
# MACHINE LEARNING PIPELINE
# -----------------------------------------

model = Pipeline(
    [
        ("scaler", StandardScaler()),
        ("classifier", LogisticRegression())
    ]
)

model.fit(X_train, y_train)

# -----------------------------------------
# EVALUATION
# -----------------------------------------

predictions = model.predict(X_test)

accuracy = accuracy_score(
    y_test,
    predictions
)

print("================================")
print("FRAUD MODEL TRAINING")
print("================================")

print("Model trained successfully!")
print("Features:", list(X.columns))
print("Accuracy:", round(accuracy, 4))

print("\nClassification Report:")
print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)

# -----------------------------------------
# SAVE MODEL
# -----------------------------------------

joblib.dump(
    model,
    "fraud_model.pkl"
)

print("================================")
print("Model saved as fraud_model.pkl")
print("================================")