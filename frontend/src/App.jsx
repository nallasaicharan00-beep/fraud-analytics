import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import "./App.css";

// ========================================
// API CONFIGURATION
// ========================================

const API_URL =
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:5000";

// ========================================
// APP
// ========================================

function App() {
  const [transactions, setTransactions] = useState([]);

  const [amount, setAmount] = useState("");

  const [prediction, setPrediction] = useState(null);

  const [loading, setLoading] = useState(false);

  const [csvLoading, setCsvLoading] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [lastUpdated, setLastUpdated] = useState(null);

  // ========================================
  // FETCH TRANSACTIONS
  // ========================================

  const fetchTransactions = async () => {
    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/transactions`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to fetch transactions"
        );
      }

      setTransactions(data);
      setLastUpdated(new Date());

    } catch (err) {
      console.error(
        "Fetch transactions error:",
        err
      );

      setError(
        `Unable to load transactions: ${err.message}`
      );
    }
  };

  // ========================================
  // INITIAL LOAD + AUTO REFRESH
  // ========================================

  useEffect(() => {
    fetchTransactions();

    const interval = setInterval(() => {
      fetchTransactions();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // ========================================
  // ANALYZE TRANSACTION
  // ========================================

  const analyzeTransaction = async () => {
    setError("");
    setSuccess("");
    setPrediction(null);

    if (
      amount === "" ||
      amount === null
    ) {
      setError(
        "Please enter a transaction amount."
      );
      return;
    }

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(
        numericAmount
      ) ||
      numericAmount <= 0
    ) {
      setError(
        "Please enter a valid amount greater than zero."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/analyze`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            amount:
              numericAmount,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.details ||
            data.error ||
            "Transaction analysis failed"
        );
      }

      setPrediction(
        data.prediction
      );

      setSuccess(
        "Transaction analyzed and saved successfully."
      );

      setAmount("");

      await fetchTransactions();

    } catch (err) {
      console.error(
        "Analyze error:",
        err
      );

      setError(
        err.message ||
          "Transaction analysis failed."
      );

    } finally {
      setLoading(false);
    }
  };

  // ========================================
  // CSV UPLOAD
  // ========================================

  const handleCSVUpload = (
    event
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,

      complete: async (
        results
      ) => {
        try {
          const rows =
            results.data || [];

          if (rows.length === 0) {
            throw new Error(
              "CSV file is empty."
            );
          }

          const formattedTransactions =
            rows
              .map((row) => ({
                amount:
                  row.amount ??
                  row.Amount ??
                  row.AMOUNT,
              }))
              .filter(
                (row) =>
                  row.amount !==
                    undefined &&
                  row.amount !== null &&
                  row.amount !== ""
              );

          if (
            formattedTransactions.length ===
            0
          ) {
            throw new Error(
              "No valid 'amount' column found in the CSV file."
            );
          }

          if (
            formattedTransactions.length >
            500
          ) {
            throw new Error(
              "Maximum 500 transactions can be uploaded at once."
            );
          }

          setCsvLoading(true);

          const response =
            await fetch(
              `${API_URL}/api/transactions/bulk`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  transactions:
                    formattedTransactions,
                }),
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.details ||
                data.error ||
                "CSV processing failed"
            );
          }

          setSuccess(
            `CSV processed successfully. ${data.count} transaction(s) analyzed.`
          );

          await fetchTransactions();

        } catch (err) {
          console.error(
            "CSV error:",
            err
          );

          setError(
            err.message ||
              "CSV processing failed."
          );

        } finally {
          setCsvLoading(false);

          event.target.value =
            "";
        }
      },

      error: (parseError) => {
        console.error(
          "CSV parse error:",
          parseError
        );

        setError(
          "Unable to read the CSV file."
        );

        event.target.value =
          "";
      },
    });
  };

  // ========================================
  // STATISTICS
  // ========================================

  const statistics = useMemo(() => {
    const total =
      transactions.length;

    const fraudCount =
      transactions.filter(
        (transaction) =>
          String(
            transaction.status
          ).toUpperCase() ===
          "FRAUD"
      ).length;

    const safeCount =
      transactions.filter(
        (transaction) =>
          String(
            transaction.status
          ).toUpperCase() ===
          "SAFE"
      ).length;

    const totalAmount =
      transactions.reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount
          ),
        0
      );

    const averageRisk =
      total > 0
        ? transactions.reduce(
            (sum, transaction) =>
              sum +
              Number(
                transaction.risk_score ||
                  0
              ),
            0
          ) / total
        : 0;

    return {
      total,
      fraudCount,
      safeCount,
      totalAmount,
      averageRisk,
    };
  }, [transactions]);

  // ========================================
  // PIE CHART DATA
  // ========================================

  const pieData = [
    {
      name: "Safe",
      value:
        statistics.safeCount,
    },
    {
      name: "Fraud",
      value:
        statistics.fraudCount,
    },
  ];

  // ========================================
  // BAR CHART DATA
  // ========================================

  const barData =
    transactions
      .slice(-10)
      .map((transaction) => ({
        id: transaction.id,

        amount:
          Number(
            transaction.amount
          ),

        risk:
          Number(
            transaction.risk_score ||
              0
          ) * 100,
      }));

  // ========================================
  // FORMAT CURRENCY
  // ========================================

  const formatCurrency = (
    value
  ) => {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }
    ).format(value);
  };

  // ========================================
  // FORMAT RISK
  // ========================================

  const formatRisk = (
    value
  ) => {
    return (
      Number(value || 0) *
      100
    ).toFixed(2);
  };

  // ========================================
  // RENDER
  // ========================================

  return (
    <div className="app">

      {/* ================================== */}
      {/* HEADER */}
      {/* ================================== */}

      <header className="dashboard-header">

        <div>
          <h1>
            Fraud Analytics
            Dashboard
          </h1>

          <p>
            Real-time transaction
            monitoring and ML-powered
            fraud detection
          </p>
        </div>

        <div className="header-status">
          <span className="status-dot"></span>

          System Online
        </div>

      </header>

      {/* ================================== */}
      {/* ERROR / SUCCESS */}
      {/* ================================== */}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert success">
          {success}
        </div>
      )}

      {/* ================================== */}
      {/* STATISTICS */}
      {/* ================================== */}

      <section className="stats-grid">

        <div className="stat-card">
          <span>
            Total Transactions
          </span>

          <strong>
            {statistics.total}
          </strong>
        </div>

        <div className="stat-card">
          <span>
            Safe Transactions
          </span>

          <strong>
            {statistics.safeCount}
          </strong>
        </div>

        <div className="stat-card">
          <span>
            Fraud Transactions
          </span>

          <strong>
            {statistics.fraudCount}
          </strong>
        </div>

        <div className="stat-card">
          <span>
            Total Amount
          </span>

          <strong>
            {formatCurrency(
              statistics.totalAmount
            )}
          </strong>
        </div>

        <div className="stat-card">
          <span>
            Average Risk
          </span>

          <strong>
            {formatRisk(
              statistics.averageRisk /
                1
            )}
            %
          </strong>
        </div>

      </section>

      {/* ================================== */}
      {/* ANALYZE + CSV */}
      {/* ================================== */}

      <section className="control-grid">

        {/* Analyze Transaction */}

        <div className="panel">

          <h2>
            Analyze Transaction
          </h2>

          <p>
            Enter a transaction amount
            and let the ML model assess
            the fraud risk.
          </p>

          <div className="input-row">

            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Enter amount"
              value={amount}
              onChange={(event) =>
                setAmount(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  analyzeTransaction();
                }
              }}
            />

            <button
              onClick={
                analyzeTransaction
              }
              disabled={loading}
            >
              {loading
                ? "Analyzing..."
                : "Analyze"}
            </button>

          </div>

          {/* Prediction */}

          {prediction && (
            <div
              className={`prediction-card ${
                prediction.status ===
                "FRAUD"
                  ? "fraud"
                  : "safe"
              }`}
            >

              <h3>
                Prediction
              </h3>

              <div className="prediction-status">
                {prediction.status}
              </div>

              <div className="prediction-details">

                <div>
                  <span>
                    Amount
                  </span>

                  <strong>
                    {formatCurrency(
                      prediction.amount
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Risk Score
                  </span>

                  <strong>
                    {formatRisk(
                      prediction.risk_score
                    )}
                    %
                  </strong>
                </div>

                <div>
                  <span>
                    Fraud Probability
                  </span>

                  <strong>
                    {formatRisk(
                      prediction.fraud_probability
                    )}
                    %
                  </strong>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* CSV Upload */}

        <div className="panel">

          <h2>
            Bulk CSV Analysis
          </h2>

          <p>
            Upload a CSV file containing
            an <strong>amount</strong>{" "}
            column.
          </p>

          <label className="upload-box">

            <input
              type="file"
              accept=".csv"
              onChange={
                handleCSVUpload
              }
              disabled={csvLoading}
            />

            <span>
              {csvLoading
                ? "Processing CSV..."
                : "Choose CSV File"}
            </span>

          </label>

          <small>
            Maximum 500 transactions
          </small>

        </div>

      </section>

      {/* ================================== */}
      {/* CHARTS */}
      {/* ================================== */}

      <section className="charts-grid">

        {/* Pie Chart */}

        <div className="panel chart-panel">

          <h2>
            Transaction Distribution
          </h2>

          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height={300}
            >

              <PieChart>

                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >

                  <Cell />

                  <Cell />

                </Pie>

                <Tooltip />

                <Legend />

              </PieChart>

            </ResponsiveContainer>

          </div>

        </div>

        {/* Bar Chart */}

        <div className="panel chart-panel">

          <h2>
            Recent Transaction Risk
          </h2>

          <div className="chart-container">

            <ResponsiveContainer
              width="100%"
              height={300}
            >

              <BarChart
                data={barData}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="id"
                  tick={{
                    fontSize: 10,
                  }}
                />

                <YAxis />

                <Tooltip />

                <Legend />

                <Bar
                  dataKey="risk"
                  name="Risk %"
                />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </div>

      </section>

      {/* ================================== */}
      {/* TRANSACTION TABLE */}
      {/* ================================== */}

      <section className="panel table-panel">

        <div className="table-header">

          <div>
            <h2>
              Recent Transactions
            </h2>

            {lastUpdated && (
              <small>
                Last updated:{" "}
                {lastUpdated.toLocaleTimeString()}
              </small>
            )}
          </div>

          <button
            className="refresh-button"
            onClick={
              fetchTransactions
            }
          >
            Refresh
          </button>

        </div>

        {transactions.length ===
        0 ? (
          <div className="empty-state">
            No transactions found.
          </div>
        ) : (
          <div className="table-wrapper">

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

                {[
                  ...transactions,
                ]
                  .reverse()
                  .map(
                    (
                      transaction
                    ) => (
                      <tr
                        key={
                          transaction.id
                        }
                      >

                        <td>
                          {
                            transaction.id
                          }
                        </td>

                        <td>
                          {formatCurrency(
                            transaction.amount
                          )}
                        </td>

                        <td>
                          {formatRisk(
                            transaction.risk_score
                          )}
                          %
                        </td>

                        <td>

                          <span
                            className={`status-badge ${
                              String(
                                transaction.status
                              ).toUpperCase() ===
                              "FRAUD"
                                ? "fraud"
                                : "safe"
                            }`}
                          >
                            {
                              transaction.status
                            }
                          </span>

                        </td>

                      </tr>
                    )
                  )}

              </tbody>

            </table>

          </div>
        )}

      </section>

      {/* ================================== */}
      {/* FOOTER */}
      {/* ================================== */}

      <footer className="dashboard-footer">

        <span>
          Fraud Analytics Platform
        </span>

        <span>
          React • Node.js • PostgreSQL
          • Machine Learning
        </span>

      </footer>

    </div>
  );
}

export default App;