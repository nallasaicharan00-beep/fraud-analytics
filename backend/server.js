const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

// ========================================
// SERVER CONFIGURATION
// ========================================

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

app.use(cors());
app.use(express.json());

// ========================================
// DATABASE CONFIGURATION
// ========================================

// Render will use DATABASE_URL.
// Local development will use the individual DB variables.

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT),
      }
);

// Test PostgreSQL connection
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

// ========================================
// HOME ROUTE
// ========================================

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "Fraud Analytics Backend is running",
  });
});

// ========================================
// GET ALL TRANSACTIONS
// ========================================

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

// ========================================
// AMOUNT VALIDATION
// ========================================

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

// ========================================
// CALL ML SERVICE
// ========================================

async function getPrediction(amount) {
  const mlServiceUrl =
    process.env.ML_SERVICE_URL ||
    "http://127.0.0.1:5001";

  console.log(
    `Calling ML service: ${mlServiceUrl}/predict`
  );

  console.log(
    `Amount sent to ML service: ${amount}`
  );

  const response = await fetch(
    `${mlServiceUrl}/predict`,
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

// ========================================
// PREDICT TRANSACTION
// ========================================

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
      error: "ML service unavailable",
      details: error.message,
    });
  }
});

// ========================================
// ANALYZE TRANSACTION
// ========================================

app.post("/api/analyze", async (req, res) => {
  console.log(
    "================================"
  );

  console.log(
    "ANALYZE REQUEST RECEIVED"
  );

  console.log(
    "Request body:",
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

    // Call ML service
    const prediction =
      await getPrediction(amount);

    const riskScore =
      Number(prediction.risk_score);

    const status =
      prediction.status;

    // Validate ML response
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

    // Generate transaction ID
    const transactionId =
      `TX${Date.now()}`;

    console.log(
      "Transaction ID:",
      transactionId
    );

    console.log(
      "Saving transaction to PostgreSQL..."
    );

    // Save transaction
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

    console.log(
      "================================"
    );

    // Send response
    res.status(201).json({
      transaction:
        result.rows[0],

      prediction: {
        amount: amount,

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

    console.log(
      "================================"
    );

    res.status(500).json({
      error:
        "Transaction analysis failed",

      details:
        error.message,
    });
  }
});

// ========================================
// BULK / CSV TRANSACTIONS
// ========================================

app.post(
  "/api/transactions/bulk",
  async (req, res) => {
    try {
      const transactions =
        req.body?.transactions;

      // Check array
      if (!Array.isArray(transactions)) {
        return res.status(400).json({
          error:
            "Transactions must be an array",
        });
      }

      // Check empty array
      if (transactions.length === 0) {
        return res.status(400).json({
          error:
            "No transactions provided",
        });
      }

      // Limit CSV size
      if (transactions.length > 500) {
        return res.status(400).json({
          error:
            "Maximum 500 transactions allowed",
        });
      }

      const processed = [];

      // Process each transaction
      for (
        const transaction
        of transactions
      ) {
        const validation =
          validateAmount(
            transaction?.amount
          );

        // Skip invalid transactions
        if (!validation.valid) {
          continue;
        }

        const amount =
          validation.amount;

        // Get ML prediction
        const prediction =
          await getPrediction(
            amount
          );

        const riskScore =
          Number(
            prediction.risk_score
          );

        const status =
          prediction.status;

        if (
          !Number.isFinite(
            riskScore
          )
        ) {
          continue;
        }

        if (!status) {
          continue;
        }

        // Generate unique ID
        const transactionId =
          `CSV${Date.now()}${processed.length}`;

        // Save to database
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

// ========================================
// START SERVER
// ========================================

app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      "================================"
    );

    console.log(
      `Backend running on port ${PORT}`
    );

    console.log(
      `Host: ${HOST}`
    );

    console.log(
      "================================"
    );
  }
);