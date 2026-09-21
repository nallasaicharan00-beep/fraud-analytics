import { useEffect, useState } from "react";
import "./App.css";
import Papa from "papaparse";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const API_URL = "http://127.0.0.1:5000";

function App() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("");
  const [prediction, setPrediction] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const [lastUpdated, setLastUpdated] = useState(null);

  // ==============================
  // LOAD TRANSACTIONS
  // ==============================

  async function loadTransactions() {
    try {
      const response = await fetch(
        `${API_URL}/api/transactions`
      );

      if (!response.ok) {
        throw new Error(
          `Backend returned ${response.status}`
        );
      }

      const data = await response.json();

      setTransactions(data);
      setLastUpdated(new Date());
      setLoading(false);

      console.log(
        "Transactions loaded:",
        data
      );
    } catch (error) {
      console.error(
        "Error loading transactions:",
        error
      );

      setLoading(false);
    }
  }

  // ==============================
  // AUTO REFRESH
  // ==============================

  useEffect(() => {
    loadTransactions();

    const interval = setInterval(() => {
      loadTransactions();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // ==============================
  // RISK SCORE
  // ==============================

  function getRiskScore(transaction) {
    return Number(
      transaction.riskScore ??
        transaction.risk_score ??
        0
    );
  }

  // ==============================
  // ANALYZE SINGLE TRANSACTION
  // ==============================

  async function analyzeTransaction() {
    if (!amount || Number(amount) <= 0) {
      alert(
        "Please enter a valid transaction amount"
      );
      return;
    }

    setAnalyzing(true);
    setPrediction(null);

    try {
      console.log(
        "Sending analyze request:",
        amount
      );

      const response = await fetch(
        `${API_URL}/api/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Number(amount),
          }),
        }
      );

      const result = await response.json();

      console.log(
        "Backend analyze response:",
        result
      );

      if (!response.ok) {
        throw new Error(
          result.details ||
            result.error ||
            `Server error: ${response.status}`
        );
      }

      setPrediction(result.prediction);

      await loadTransactions();

      console.log(
        "Transaction analyzed successfully"
      );
    } catch (error) {
      console.error(
        "Analysis error:",
        error
      );

      alert(
        `Transaction analysis failed:\n\n${error.message}`
      );
    } finally {
      setAnalyzing(false);
    }
  }

  // ==============================
  // CSV UPLOAD
  // ==============================

  function handleCSVUpload(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: async (results) => {
        console.log(
          "CSV Data:",
          results.data
        );

        const csvTransactions =
          results.data
            .map((row) => {
              const csvAmount = Number(
                row.amount
              );

              if (
                !csvAmount ||
                csvAmount <= 0
              ) {
                return null;
              }

              return {
                amount: csvAmount,
              };
            })
            .filter(Boolean);

        if (
          csvTransactions.length === 0
        ) {
          alert(
            "No valid transactions found in CSV"
          );
          return;
        }

        try {
          console.log(
            "Sending CSV to backend:",
            csvTransactions
          );

          const response = await fetch(
            `${API_URL}/api/transactions/bulk`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                transactions:
                  csvTransactions,
              }),
            }
          );

          const result =
            await response.json();

          console.log(
            "CSV backend response:",
            result
          );

          if (!response.ok) {
            throw new Error(
              result.details ||
                result.error ||
                "CSV processing failed"
            );
          }

          alert(
            `${result.count} transactions analyzed and saved successfully`
          );

          await loadTransactions();
        } catch (error) {
          console.error(
            "CSV processing error:",
            error
          );

          alert(
            `Failed to process CSV transactions:\n\n${error.message}`
          );
        }
      },

      error: (error) => {
        console.error(
          "CSV parsing error:",
          error
        );

        alert(
          "Failed to read CSV file"
        );
      },
    });

    // Reset file input so the same file
    // can be selected again
    event.target.value = "";
  }

  // ==============================
  // STATISTICS
  // ==============================

  const totalTransactions =
    transactions.length;

  const fraudTransactions =
    transactions.filter(
      (transaction) =>
        transaction.status === "FRAUD"
    ).length;

  const safeTransactions =
    transactions.filter(
      (transaction) =>
        transaction.status === "SAFE"
    ).length;

  const reviewTransactions =
    transactions.filter(
      (transaction) =>
        transaction.status === "REVIEW"
    ).length;

  const totalValue =
    transactions.reduce(
      (total, transaction) =>
        total +
        Number(
          transaction.amount || 0
        ),
      0
    );

  const fraudRate =
    totalTransactions > 0
      ? (fraudTransactions /
          totalTransactions) *
        100
      : 0;

  const averageRisk =
    totalTransactions > 0
      ? transactions.reduce(
          (total, transaction) =>
            total +
            getRiskScore(transaction),
          0
        ) / totalTransactions
      : 0;

  // ==============================
  // PIE CHART DATA
  // ==============================

  const statusChartData = [
    {
      name: "Fraud",
      value: fraudTransactions,
    },
    {
      name: "Safe",
      value: safeTransactions,
    },
    {
      name: "Review",
      value: reviewTransactions,
    },
  ];

  // ==============================
  // BAR CHART DATA
  // ==============================

  const valueChartData = [
    {
      name: "Fraud",

      value: transactions
        .filter(
          (transaction) =>
            transaction.status === "FRAUD"
        )
        .reduce(
          (total, transaction) =>
            total +
            Number(
              transaction.amount || 0
            ),
          0
        ),
    },

    {
      name: "Safe",

      value: transactions
        .filter(
          (transaction) =>
            transaction.status === "SAFE"
        )
        .reduce(
          (total, transaction) =>
            total +
            Number(
              transaction.amount || 0
            ),
          0
        ),
    },

    {
      name: "Review",

      value: transactions
        .filter(
          (transaction) =>
            transaction.status === "REVIEW"
        )
        .reduce(
          (total, transaction) =>
            total +
            Number(
              transaction.amount || 0
            ),
          0
        ),
    },
  ];

  // ==============================
  // MONEY FORMAT
  // ==============================

  function formatMoney(value) {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }
    ).format(value);
  }

  // ==============================
  // LAST UPDATED
  // ==============================

  function formatLastUpdated() {
    if (!lastUpdated) {
      return "Waiting for data...";
    }

    return lastUpdated.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  }

  // ==============================
  // STATUS CLASS
  // ==============================

  function getStatusClass(status) {
    if (status === "FRAUD") {
      return "status-fraud";
    }

    if (status === "REVIEW") {
      return "status-review";
    }

    if (status === "SAFE") {
      return "status-safe";
    }

    return "status-pending";
  }

  // ==============================
  // LOADING SCREEN
  // ==============================

  if (loading) {
    return (
      <div className="dashboard">
        <h1>
          Loading Fraud Analytics...
        </h1>
      </div>
    );
  }

  // ==============================
  // MAIN DASHBOARD
  // ==============================

  return (
    <div className="dashboard">

      {/* ================= HEADER ================= */}

      <header className="dashboard-header">

        <div>
          <h1>
            Fraud Analytics
          </h1>

          <p>
            Real-Time Fraud Detection Platform
          </p>
        </div>

        <div>

          <div className="system-status">

            <span className="status-dot"></span>

            System Online

          </div>

          <p
            style={{
              textAlign: "right",
              marginTop: "8px",
              fontSize: "12px",
              color: "#7a8495",
            }}
          >
            Last updated:{" "}
            {formatLastUpdated()}
          </p>

        </div>

      </header>

      {/* ================= STATISTICS ================= */}

      <section className="stats-grid">

        <div className="stat-card">

          <h3>
            Total Transactions
          </h3>

          <h2>
            {totalTransactions}
          </h2>

          <p>
            Processed transactions
          </p>

        </div>

        <div className="stat-card fraud-card">

          <h3>
            Fraud Detected
          </h3>

          <h2>
            {fraudTransactions}
          </h2>

          <p>
            High-risk transactions
          </p>

        </div>

        <div className="stat-card safe-card">

          <h3>
            Safe Transactions
          </h3>

          <h2>
            {safeTransactions}
          </h2>

          <p>
            Low-risk transactions
          </p>

        </div>

        <div className="stat-card review-card">

          <h3>
            Under Review
          </h3>

          <h2>
            {reviewTransactions}
          </h2>

          <p>
            Medium-risk transactions
          </p>

        </div>

      </section>

      {/* ================= SECOND STATISTICS ================= */}

      <section className="stats-grid">

        <div className="stat-card">

          <h3>
            Fraud Rate
          </h3>

          <h2>
            {fraudRate.toFixed(1)}%
          </h2>

          <p>
            Percentage of fraud transactions
          </p>

        </div>

        <div className="stat-card">

          <h3>
            Average Risk Score
          </h3>

          <h2>
            {averageRisk.toFixed(2)}
          </h2>

          <p>
            Average ML risk score
          </p>

        </div>

        <div className="stat-card">

          <h3>
            Total Value
          </h3>

          <h2>
            {formatMoney(totalValue)}
          </h2>

          <p>
            All processed transactions
          </p>

        </div>

        <div className="stat-card">

          <h3>
            Monitoring
          </h3>

          <h2>
            LIVE
          </h2>

          <p>
            Automatic refresh every 10 seconds
          </p>

        </div>

      </section>

      {/* ================= TOTAL VALUE ================= */}

      <section className="value-card">

        <div>

          <p>
            Total Transaction Value
          </p>

          <h2>
            {formatMoney(totalValue)}
          </h2>

        </div>

        <div className="rupee-icon">
          ₹
        </div>

      </section>

      {/* ================= CHARTS ================= */}

      <section className="charts-grid">

        {/* PIE CHART */}

        <div className="chart-card">

          <h2>
            Transaction Status
          </h2>

          <p>
            Distribution of detected transactions
          </p>

          <ResponsiveContainer
            width="100%"
            height={300}
          >

            <PieChart>

              <Pie
                data={statusChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >

                {statusChartData.map(
                  (entry) => {

                    let fill;

                    if (
                      entry.name ===
                      "Fraud"
                    ) {
                      fill = "#ef4444";
                    }

                    else if (
                      entry.name ===
                      "Safe"
                    ) {
                      fill = "#22c55e";
                    }

                    else {
                      fill = "#f59e0b";
                    }

                    return (
                      <Cell
                        key={
                          entry.name
                        }
                        fill={fill}
                      />
                    );
                  }
                )}

              </Pie>

              <Tooltip />

              <Legend />

            </PieChart>

          </ResponsiveContainer>

        </div>

        {/* BAR CHART */}

        <div className="chart-card">

          <h2>
            Transaction Value
          </h2>

          <p>
            Total value by transaction status
          </p>

          <ResponsiveContainer
            width="100%"
            height={300}
          >

            <BarChart
              data={valueChartData}
            >

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="name"
              />

              <YAxis />

              <Tooltip />

              <Legend />

              <Bar
                dataKey="value"
                name="Transaction Value"
                fill="#4f46e5"
              />

            </BarChart>

          </ResponsiveContainer>

        </div>

      </section>

      {/* ================= ANALYZE TRANSACTION ================= */}

      <section className="analyze-card">

        <div className="analyze-text">

          <h2>
            Analyze Transaction
          </h2>

          <p>
            Enter a transaction amount to run
            fraud detection.
          </p>

        </div>

        <div className="analyze-controls">

          <input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(event) =>
              setAmount(
                event.target.value
              )
            }
          />

          <button
            onClick={
              analyzeTransaction
            }
            disabled={analyzing}
          >

            {analyzing
              ? "Analyzing..."
              : "Analyze Transaction"}

          </button>

        </div>

      </section>

      {/* ================= ML PREDICTION ================= */}

      {prediction && (

        <section className="prediction-card">

          <h2>
            ML Prediction
          </h2>

          <div className="prediction-result">

            <p>

              <strong>
                Amount:
              </strong>{" "}

              {formatMoney(
                Number(
                  prediction.amount ??
                    amount
                )
              )}

            </p>

            <p>

              <strong>
                Status:
              </strong>{" "}

              {prediction.status ||
                "Unknown"}

            </p>

            <p>

              <strong>
                Risk Score:
              </strong>{" "}

              {prediction.risk_score ??
                "N/A"}

            </p>

            <p>

              <strong>
                Fraud Probability:
              </strong>{" "}

              {prediction.fraud_probability !==
              undefined
                ? `${(
                    Number(
                      prediction.fraud_probability
                    ) * 100
                  ).toFixed(2)}%`
                : "N/A"}

            </p>

          </div>

        </section>

      )}

      {/* ================= CSV UPLOAD ================= */}

      <section className="analyze-card">

        <div className="analyze-text">

          <h2>
            Upload Transactions
          </h2>

          <p>
            Upload a CSV file for ML analysis.
          </p>

        </div>

        <input
          type="file"
          accept=".csv"
          onChange={
            handleCSVUpload
          }
        />

      </section>

      {/* ================= TRANSACTION TABLE ================= */}

      <section className="transactions-card">

        <div className="transactions-header">

          <div>

            <h2>
              Recent Transactions
            </h2>

            <p>
              Live transaction monitoring
            </p>

          </div>

          <button
            onClick={
              loadTransactions
            }
          >
            Refresh
          </button>

        </div>

        <div className="table-container">

          <table>

            <thead>

              <tr>

                <th>
                  Transaction ID
                </th>

                <th>
                  Amount
                </th>

                <th>
                  Risk Score
                </th>

                <th>
                  Status
                </th>

              </tr>

            </thead>

            <tbody>

              {transactions.map(
                (transaction) => {

                  const riskScore =
                    getRiskScore(
                      transaction
                    );

                  return (

                    <tr
                      key={
                        transaction.id
                      }
                    >

                      <td>
                        {transaction.id}
                      </td>

                      <td>
                        {formatMoney(
                          Number(
                            transaction.amount
                          )
                        )}
                      </td>

                      <td>

                        <div className="risk-score">

                          <span>
                            {riskScore.toFixed(
                              2
                            )}
                          </span>

                          <div className="risk-bar">

                            <div
                              className="risk-fill"
                              style={{
                                width:
                                  `${Math.min(
                                    riskScore *
                                      100,
                                    100
                                  )}%`,
                              }}
                            ></div>

                          </div>

                        </div>

                      </td>

                      <td>

                        <span
                          className={
                            `status-badge ${
                              getStatusClass(
                                transaction.status
                              )
                            }`
                          }
                        >

                          {
                            transaction.status
                          }

                        </span>

                      </td>

                    </tr>

                  );
                }
              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}

export default App;