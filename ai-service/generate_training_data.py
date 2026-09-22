import os
import random
import numpy as np
import pandas as pd
from features import FEATURE_NAMES

def generate_synthetic_dataset(num_samples: int = 4000, seed: int = 42) -> pd.DataFrame:
    """
    Generates synthetic labeled market microstructure events matching the anomaly
    distributions from backend/src/feed/priceFeed.ts.
    
    Classes:
      0: UNEXPLAINED (uninformed flow / statistical anomaly without news)
      1: CONFIRMED   (catalyst confirmed by official filing or insider conviction)
      2: UNCERTAIN   (stale quote / low trust data / heartbeat lag)
    """
    random.seed(seed)
    np.random.seed(seed)
    
    rows = []
    
    for _ in range(num_samples):
        tier_choice = random.choices(["UNEXPLAINED", "CONFIRMED", "UNCERTAIN"], weights=[0.45, 0.40, 0.15])[0]
        
        if tier_choice == "UNCERTAIN":
            # Stale feed, broken socket, low trust, or delayed snapshot
            is_stale = random.choice([1.0, 1.0, 0.0])
            source_trust = random.choice([0.0, 1.0]) if is_stale == 0.0 else random.choice([1.0, 2.0, 3.0])
            abs_change = max(0.0, float(np.random.exponential(1.2)))
            vol_ratio = float(np.random.uniform(0.4, 2.5))
            sec_spread = float(np.random.uniform(0.0, 2.5))
            sec_div = 1.0 if sec_spread >= 1.5 else 0.0
            z_score = float(np.random.normal(0, 1.5))
            rsi = float(np.random.uniform(20.0, 80.0))
            filing_present = 0.0
            filing_age = 999.0
            insider_buy = 0.0
            insider_sell = 0.0
            insider_val_cr = 0.0
            hist_res = float(np.random.uniform(0.1, 0.8))
            target_class = "UNCERTAIN"
            
        elif tier_choice == "CONFIRMED":
            # Real news catalyst or massive promoter accumulation
            is_stale = 0.0
            source_trust = random.choice([2.0, 3.0, 3.0])
            abs_change = float(np.random.uniform(1.8, 7.5))
            vol_ratio = float(np.random.uniform(1.4, 5.0))
            sec_spread = float(np.random.uniform(1.2, 5.5))
            sec_div = 1.0 if sec_spread >= 1.5 else 0.0
            z_score = float(np.random.normal(2.5, 0.8)) if random.random() > 0.3 else float(np.random.normal(-2.5, 0.8))
            rsi = float(np.random.uniform(65.0, 92.0)) if z_score > 0 else float(np.random.uniform(10.0, 35.0))
            
            # Either official exchange announcement or promoter buying
            has_filing = random.random() < 0.85
            filing_present = 1.0 if has_filing else 0.0
            filing_age = float(np.random.uniform(2.0, 180.0)) if has_filing else 999.0
            
            has_insider_buy = (not has_filing) or (random.random() < 0.25)
            insider_buy = 1.0 if has_insider_buy else 0.0
            insider_sell = 0.0
            insider_val_cr = float(np.random.uniform(50.0, 600.0)) if has_insider_buy else 0.0
            
            hist_res = float(np.random.uniform(0.4, 0.95))
            target_class = "CONFIRMED"
            
        else: # UNEXPLAINED (Uninformed flow)
            # Price/volume spike, divergence, but NO filing and NO insider buying
            is_stale = 0.0
            source_trust = random.choice([2.0, 3.0, 3.0])
            abs_change = float(np.random.uniform(1.5, 6.0))
            vol_ratio = float(np.random.uniform(1.3, 4.5))
            sec_spread = float(np.random.uniform(0.8, 4.0))
            sec_div = 1.0 if sec_spread >= 1.5 else 0.0
            z_score = float(np.random.normal(2.0, 1.0)) if random.random() > 0.4 else float(np.random.normal(-2.0, 1.0))
            rsi = float(np.random.uniform(55.0, 85.0)) if z_score > 0 else float(np.random.uniform(15.0, 45.0))
            filing_present = 0.0
            filing_age = 999.0
            insider_buy = 0.0
            insider_sell = 1.0 if random.random() < 0.2 else 0.0
            insider_val_cr = float(np.random.uniform(10.0, 150.0)) if insider_sell == 1.0 else 0.0
            hist_res = float(np.random.uniform(0.1, 0.6))
            target_class = "UNEXPLAINED"

        row = [
            abs_change,
            vol_ratio,
            sec_div,
            sec_spread,
            z_score,
            rsi,
            filing_present,
            filing_age,
            insider_buy,
            insider_sell,
            insider_val_cr,
            source_trust,
            is_stale,
            hist_res,
            target_class
        ]
        rows.append(row)

    df = pd.DataFrame(rows, columns=FEATURE_NAMES + ["target"])
    return df

if __name__ == "__main__":
    df = generate_synthetic_dataset(num_samples=5000)
    out_path = os.path.join(os.path.dirname(__file__), "training_data.csv")
    df.to_csv(out_path, index=False)
    print(f"Generated {len(df)} synthetic microstructure samples -> {out_path}")
    print("Class distribution:\n", df["target"].value_counts())
