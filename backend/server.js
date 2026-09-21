const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

const PORT = 5000;
const HOST = "127.0.0.1";

app.use(cors());
app.use(express.json());


// ==========================================
// POSTGRESQL
// ==========================================

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});


// ==========================================
// DATABASE TEST
// ==========================================

pool.query("SELECT NOW()")
  .then(() => {
    console.log("PostgreSQL connected successfully");
  })
  .catch((error) => {
    console.error(
      "PostgreSQL connection failed:",
      error.message
    );
  });


// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Fraud Analytics Backend is running",
  });
});


// ==========================================
// GET TRANSACTIONS
// ==========================================

app.get("/api/transactions", async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM transactions ORDER BY id"
    );

    res.json(result.rows);

  } catch (error) {

    console.error(
      "GET transactions error:",
      error.message
    );

    res.status(500).json({
      error: "Failed to fetch transactions",
    });

  }

});


// ==========================================
// VALIDATE AMOUNT
// ==========================================

function validateAmount(amount) {

  const value = Number(amount);

  if (
    amount === undefined ||
    amount === null ||
    amount === ""
  ) {
    return {
      valid: false,
      message: "Amount is required",
    };
  }

  if (!Number.isFinite(value)) {
    return {
      valid: false,
      message: "Amount must be a number",
    };
  }

  if (value <= 0) {
    return {
      valid: false,
      message: "Amount must be greater than zero",
    };
  }

  if (value > 1000000000) {
    return {
      valid: false,
      message: "Amount is too large",
    };
  }

  return {
    valid: true,
    amount: value,
  };

}


// ==========================================
// CALL PYTHON ML
// ==========================================

async function getPrediction(amount) {

  console.log(
    `Calling ML service with amount: ${amount}`
  );

  const response = await fetch(
    "http://127.0.0.1:5001/predict",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        amount: amount,
      }),
    }
  );

  const data = await response.json();

  console.log(
    "ML response:",
    data
  );

  if (!response.ok) {

    throw new Error(
      data.error ||
      "ML service returned an error"
    );

  }

  return data;

}


// ==========================================
// PREDICT ONLY
// ==========================================

app.post("/api/predict", async (req, res) => {

  try {

    const validation =
      validateAmount(req.body?.amount);

    if (!validation.valid) {

      return res.status(400).json({
        error: validation.message,
      });

    }

    const prediction =
      await getPrediction(
        validation.amount
      );

    res.json(prediction);

  } catch (error) {

    console.error(
      "Prediction error:",
      error.message
    );

    res.status(500).json({
      error:
        "ML service unavailable",
      details:
        error.message,
    });

  }

});


// ==========================================
// ANALYZE + SAVE
// ==========================================

app.post("/api/analyze", async (req, res) => {

  console.log(
    "ANALYZE REQUEST RECEIVED"
  );

  console.log(
    "Body:",
    req.body
  );


  try {

    // Validate amount

    const validation =
      validateAmount(req.body?.amount);


    if (!validation.valid) {

      return res.status(400).json({
        error: validation.message,
      });

    }


    const amount =
      validation.amount;


    // Get ML prediction

    const prediction =
      await getPrediction(amount);


    // Validate ML result

    const riskScore =
      Number(prediction.risk_score);

    const status =
      prediction.status;


    if (!Number.isFinite(riskScore)) {

      throw new Error(
        "Invalid risk score received from ML service"
      );

    }


    if (!status) {

      throw new Error(
        "Invalid status received from ML service"
      );

    }


    // Create ID

    const transactionId =
      `TX${Date.now()}`;


    // Save to PostgreSQL

    console.log(
      "Saving transaction:",
      transactionId
    );


    const result =
      await pool.query(
        `INSERT INTO transactions
         (id, amount, risk_score, status)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,

        [
          transactionId,
          amount,
          riskScore,
          status,
        ]
      );


    console.log(
      "Transaction saved successfully"
    );


    // Return result

    res.status(201).json({

      transaction:
        result.rows[0],

      prediction: {

        amount:
          amount,

        risk_score:
          riskScore,

        status:
          status,

        fraud_probability:
          prediction.fraud_probability ??
          null,

      },

    });


  } catch (error) {

    console.error(
      "ANALYZE ERROR:",
      error.message
    );


    res.status(500).json({

      error:
        "Transaction analysis failed",

      details:
        error.message,

    });

  }

});


// ==========================================
// BULK CSV
// ==========================================

app.post(
  "/api/transactions/bulk",
  async (req, res) => {

    try {

      const transactions =
        req.body?.transactions;


      if (!Array.isArray(transactions)) {

        return res.status(400).json({
          error:
            "Transactions must be an array",
        });

      }


      if (transactions.length === 0) {

        return res.status(400).json({
          error:
            "No transactions provided",
        });

      }


      if (transactions.length > 500) {

        return res.status(400).json({
          error:
            "Maximum 500 transactions allowed",
        });

      }


      const processed = [];


      for (
        const transaction
        of transactions
      ) {

        const validation =
          validateAmount(
            transaction?.amount
          );


        if (!validation.valid) {
          continue;
        }


        const prediction =
          await getPrediction(
            validation.amount
          );


        const transactionId =
          `CSV${Date.now()}${processed.length}`;


        const result =
          await pool.query(
            `INSERT INTO transactions
             (id, amount, risk_score, status)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,

            [
              transactionId,

              validation.amount,

              Number(
                prediction.risk_score
              ),

              prediction.status,
            ]
          );


        processed.push(
          result.rows[0]
        );

      }


      res.status(201).json({

        message:
          "CSV processed successfully",

        count:
          processed.length,

        transactions:
          processed,

      });


    } catch (error) {

      console.error(
        "BULK ERROR:",
        error.message
      );

      res.status(500).json({

        error:
          "Failed to process CSV",

        details:
          error.message,

      });

    }

  }
);


// ==========================================
// START SERVER
// ==========================================

app.listen(
  PORT,
  HOST,
  () => {

    console.log(
      "================================"
    );

    console.log(
      `Backend running at http://${HOST}:${PORT}`
    );

    console.log(
      "================================"
    );

  }
);