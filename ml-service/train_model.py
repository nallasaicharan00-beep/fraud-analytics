import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score
import joblib

# Sample transaction data
data = {
    "amount": [
        500, 1200, 3000, 5000, 8000,
        15000, 20000, 30000, 50000, 80000,
        1000, 2500, 7000, 18000, 45000
    ],
    "is_fraud": [
        0, 0, 0, 0, 0,
        0, 0, 0, 1, 1,
        0, 0, 0, 0, 1
    ]
}

# Convert data into a DataFrame
df = pd.DataFrame(data)

# Input feature
X = df[["amount"]]

# Target
y = df["is_fraud"]

# Split data into training and testing sets
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

# Create ML model
model = LogisticRegression()

# Train model
model.fit(X_train, y_train)

# Test model
predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("Model trained successfully!")
print("Accuracy:", accuracy)

# Save trained model
joblib.dump(model, "fraud_model.pkl")

print("Model saved as fraud_model.pkl")