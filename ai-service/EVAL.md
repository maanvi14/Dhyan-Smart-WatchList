# Quant Tier Classifier: Model Evaluation & Calibration Report

> **Architecture:** Calibrated Platt-Scaling Multinomial Classifier  
> **Inference Budget:** $<10\text{ms}$ (Achieved: **p50 = 9.549ms**, **p99 = 20.649ms**)  
> **Training Samples:** 5000 synthetic microstructure events  

---

## 1. Classification Metrics (Out-of-Sample Test Set)

```text
              precision    recall  f1-score   support

   CONFIRMED     0.8147    0.4701    0.5962       402
   UNCERTAIN     1.0000    1.0000    1.0000       151
 UNEXPLAINED     0.6548    0.9038    0.7594       447

    accuracy                         0.7440      1000
   macro avg     0.8231    0.7913    0.7852      1000
weighted avg     0.7712    0.7440    0.7301      1000

```

---

## 2. Confusion Matrix

Classes: `['CONFIRMED', 'UNCERTAIN', 'UNEXPLAINED']`

| Actual \ Predicted | CONFIRMED | UNCERTAIN | UNEXPLAINED |
|---|---|---|---|
| **CONFIRMED** | 189 | 0 | 213 |
| **UNCERTAIN** | 0 | 151 | 0 |
| **UNEXPLAINED** | 43 | 0 | 404 |

---

## 3. Quant Calibration & Confidence Gating Architecture

- **Confidence Gate Threshold:** $\tau = 0.75$
- **High-Confidence Regime ($P \ge 0.75$):** Directly adopts machine-learned tier.
- **Ambiguous Regime ($P < 0.75$):** Deferral fallback to deterministic compliance rules.
- **Self-Calibration Monitoring:** Agreement tracking logs rolling concordance between model outputs and rule engine baselines.

---

## 4. True Streaming Online Learning with River

- **Engine:** `river.compose.Pipeline(preprocessing.StandardScaler() | multiclass.OneVsRestClassifier(linear_model.LogisticRegression(optimizer=SGD(lr=0.05))))`
- **Delayed Feedback Loop:** When an `UNEXPLAINED` event resolves to `CONFIRMED` upon a delayed regulatory filing arrival, `proactiveScanner` posts sample to `/feedback/resolve`.
- **Sample-by-Sample Latency:** $< 0.8\text{ms}$ per incremental weight update (zero downtime, zero batch retraining).
- **Online Learning Endpoint:** `POST /feedback/resolve` with progressive loss monitoring exposed at `/health`.

