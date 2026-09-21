from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import os

app = Flask(__name__)
CORS(app)

model = joblib.load("fraud_model.pkl")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        amount = data.get("amount")
        international = data.get("international", 0)
        new_device = data.get("new_device", 0)
        high_frequency = data.get("high_frequency", 0)

        if amount is None:
            return jsonify({
                "error": "Amount is required"
            }), 400

        amount = float(amount)
        international = int(international)
        new_device = int(new_device)
        high_frequency = int(high_frequency)

        input_data = pd.DataFrame({
            "amount": [amount],
            "international": [international],
            "new_device": [new_device],
            "high_frequency": [high_frequency]
        })

        prediction = model.predict(input_data)[0]

        fraud_probability = model.predict_proba(
            input_data
        )[0][1]

        status = (
            "FRAUD"
            if prediction == 1
            else "SAFE"
        )

        # Explain why the transaction is risky
        reasons = []

        if amount >= 50000:
            reasons.append(
                "Unusually high transaction amount"
            )

        if international == 1:
            reasons.append(
                "International transaction"
            )

        if new_device == 1:
            reasons.append(
                "New device detected"
            )

        if high_frequency == 1:
            reasons.append(
                "High transaction frequency"
            )

        if not reasons:
            reasons.append(
                "No major risk indicators detected"
            )

        return jsonify({
            "amount": amount,
            "fraud_probability": round(
                float(fraud_probability),
                4
            ),
            "risk_score": round(
                float(fraud_probability),
                4
            ),
            "status": status,
            "reasons": reasons
        })

    except Exception as error:
        print("Prediction error:", error)

        return jsonify({
            "error": "Prediction failed",
            "details": str(error)
        }), 500


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Fraud ML Service is running"
    })


if __name__ == "__main__":
    port = int(
        os.environ.get("PORT", 5001)
    )

    app.run(
        host="0.0.0.0",
        port=port
    )