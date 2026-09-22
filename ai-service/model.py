import os
import joblib
import numpy as np
from typing import Tuple, Dict, Any, Optional

MODEL_PATH = os.path.join(os.path.dirname(__file__), "classifier.joblib")

class QuantTierClassifier:
    """
    Wrapper for calibrated quant tier classification model with sub-2ms inference.
    """
    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self.classes_ = None
        self.load()

    def load(self) -> bool:
        if os.path.exists(self.model_path):
            try:
                bundle = joblib.load(self.model_path)
                self.model = bundle["model"]
                self.classes_ = bundle["classes"]
                return True
            except Exception as e:
                print(f"[QuantTierClassifier] Failed to load model from {self.model_path}: {e}")
        return False

    def is_ready(self) -> bool:
        return self.model is not None

    def predict(self, feature_vector: np.ndarray) -> Tuple[Optional[str], float, Dict[str, float]]:
        """
        Predicts confidence tier and calibrated probability scores.
        Returns: (predicted_tier, max_confidence, proba_dict)
        """
        if not self.is_ready():
            return None, 0.0, {}

        import pandas as pd
        from features import FEATURE_NAMES
        df_feat = pd.DataFrame(feature_vector, columns=FEATURE_NAMES)
        probas = self.model.predict_proba(df_feat)[0]
        proba_dict = {cls_name: float(p) for cls_name, p in zip(self.classes_, probas)}
        
        max_idx = int(np.argmax(probas))
        predicted_tier = str(self.classes_[max_idx])
        max_confidence = float(probas[max_idx])

        return predicted_tier, max_confidence, proba_dict

classifier = QuantTierClassifier()
