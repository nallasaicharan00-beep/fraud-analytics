from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd

app = Flask(__name__)
CORS(app)

# Load the trained ML model
model = joblib.load("fraud_model.pkl")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.get_json()

        amount = data.get("amount")

        if amount is None:
            return jsonify({
                "error": "Amount is required"
            }), 400

        amount = float(amount)

        # Convert input into the same format used during training
        input_data = pd.DataFrame({
            "amount": [amount]
        })

        # ML prediction
        prediction = model.predict(input_data)[0]

        # Probability of fraud
        fraud_probability = model.predict_proba(input_data)[0][1]

        if prediction == 1:
            status = "FRAUD"
        else:
            status = "SAFE"

        return jsonify({
            "amount": amount,
            "fraud_probability": round(float(fraud_probability), 4),
            "risk_score": round(float(fraud_probability), 4),
            "status": status
        })

    except Exception as error:
        print("Prediction error:", error)

        return jsonify({
            "error": "Prediction failed"
        }), 500


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Fraud ML Service is running"
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001)
    