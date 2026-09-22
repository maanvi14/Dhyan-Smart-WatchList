import os
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import classification_report, confusion_matrix, brier_score_loss
from generate_training_data import generate_synthetic_dataset
from features import FEATURE_NAMES

def train_and_evaluate(num_samples: int = 5000, model_out: str = "classifier.joblib"):
    print(f"=== [Quant Model Training Pipeline] ===")
    t0 = time.time()
    
    # 1. Generate Dataset
    df = generate_synthetic_dataset(num_samples=num_samples, seed=42)
    X = df[FEATURE_NAMES]
    y = df["target"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    print(f"Train samples: {len(X_train)} | Test samples: {len(X_test)}")

    # 2. Train Calibrated Multinomial Model
    base_model = LogisticRegression(
        max_iter=1000,
        C=1.5,
        class_weight="balanced",
        solver="lbfgs"
    )
    
    # Platt scaling / Isotonic calibration to guarantee well-behaved probabilities for gating
    calibrated_clf = CalibratedClassifierCV(estimator=base_model, method="sigmoid", cv=5)
    calibrated_clf.fit(X_train, y_train)

    # 3. Evaluate on Out-of-Sample Test Set
    y_pred = calibrated_clf.predict(X_test)
    y_proba = calibrated_clf.predict_proba(X_test)
    classes = calibrated_clf.classes_

    report_str = classification_report(y_test, y_pred, digits=4)
    conf_mat = confusion_matrix(y_test, y_pred, labels=classes)
    
    # Latency benchmark
    sample_feat = X_test.iloc[[0]].to_numpy()
    latencies = []
    for _ in range(1000):
        t_start = time.perf_counter()
        calibrated_clf.predict_proba(sample_feat)
        latencies.append((time.perf_counter() - t_start) * 1000)
    p50_latency = np.percentile(latencies, 50)
    p99_latency = np.percentile(latencies, 99)

    print("\n--- Out-of-Sample Performance Report ---")
    print(report_str)
    print("Confusion Matrix (Classes:", classes, "):")
    print(conf_mat)
    print(f"Inference Latency: p50={p50_latency:.3f}ms | p99={p99_latency:.3f}ms")

    # 4. Save Model Artifact
    out_file = os.path.join(os.path.dirname(__file__), model_out)
    joblib.dump({"model": calibrated_clf, "classes": classes, "features": FEATURE_NAMES}, out_file)
    print(f"Model saved to {out_file} (Train time: {time.time()-t0:.2f}s)")

    # 5. Write Quant EVAL.md
    eval_md_path = os.path.join(os.path.dirname(__file__), "EVAL.md")
    with open(eval_md_path, "w", encoding="utf-8") as f:
        f.write(f"""# Quant Tier Classifier: Model Evaluation & Calibration Report

> **Architecture:** Calibrated Platt-Scaling Multinomial Classifier  
> **Inference Budget:** $<10\\text{{ms}}$ (Achieved: **p50 = {p50_latency:.3f}ms**, **p99 = {p99_latency:.3f}ms**)  
> **Training Samples:** {num_samples} synthetic microstructure events  

---

## 1. Classification Metrics (Out-of-Sample Test Set)

```text
{report_str}
```

---

## 2. Confusion Matrix

Classes: `{list(classes)}`

| Actual \\ Predicted | {classes[0]} | {classes[1]} | {classes[2]} |
|---|---|---|---|
| **{classes[0]}** | {conf_mat[0][0]} | {conf_mat[0][1]} | {conf_mat[0][2]} |
| **{classes[1]}** | {conf_mat[1][0]} | {conf_mat[1][1]} | {conf_mat[1][2]} |
| **{classes[2]}** | {conf_mat[2][0]} | {conf_mat[2][1]} | {conf_mat[2][2]} |

---

## 3. Quant Calibration & Confidence Gating Architecture

- **Confidence Gate Threshold:** $\\tau = 0.75$
- **High-Confidence Regime ($P \\ge 0.75$):** Directly adopts machine-learned tier.
- **Ambiguous Regime ($P < 0.75$):** Deferral fallback to deterministic compliance rules.
- **Self-Calibration Monitoring:** Agreement tracking logs rolling concordance between model outputs and rule engine baselines.
""")
    print(f"Evaluation report written to {eval_md_path}")

if __name__ == "__main__":
    train_and_evaluate()
