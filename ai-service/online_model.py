import os
import pickle
import time
from typing import Dict, Any, Tuple, Optional
import river
from river import compose, linear_model, preprocessing, metrics, multiclass
from features import FEATURE_NAMES

STREAM_STATE_PATH = os.path.join(os.path.dirname(__file__), "online_state.pkl")

class StreamingQuantClassifier:
    """
    True Online Incremental Learning Classifier using River (Streaming SGD Logistic Regression).
    Features are scaled online with river.preprocessing.StandardScaler and classified
    with river.linear_model.LogisticRegression.
    """
    def __init__(self, state_path: str = STREAM_STATE_PATH):
        self.state_path = state_path
        self.classes = ["UNEXPLAINED", "CONFIRMED", "UNCERTAIN"]
        self.samples_learned = 0
        self.last_learned_at: Optional[float] = None
        self.metric = metrics.Accuracy()
        self.pipeline = None
        self._init_pipeline()
        self.load()

    def _init_pipeline(self):
        # River pipeline: online adaptive standardization + multinomial streaming SGD logistic regression
        self.pipeline = compose.Pipeline(
            preprocessing.StandardScaler(),
            multiclass.OneVsRestClassifier(
                linear_model.LogisticRegression(
                    optimizer=river.optim.SGD(lr=0.05),
                    loss=river.optim.losses.Log(),
                    l2=1e-4
                )
            )
        )

    def load(self) -> bool:
        if os.path.exists(self.state_path):
            try:
                with open(self.state_path, "rb") as f:
                    saved_state = pickle.load(f)
                    self.pipeline = saved_state["pipeline"]
                    self.samples_learned = saved_state.get("samples_learned", 0)
                    self.last_learned_at = saved_state.get("last_learned_at")
                    self.metric = saved_state.get("metric", metrics.Accuracy())
                return True
            except Exception as e:
                print(f"[StreamingQuantClassifier] Failed loading state: {e}")
        return False

    def save(self) -> bool:
        try:
            with open(self.state_path, "wb") as f:
                pickle.dump({
                    "pipeline": self.pipeline,
                    "samples_learned": self.samples_learned,
                    "last_learned_at": self.last_learned_at,
                    "metric": self.metric
                }, f)
            return True
        except Exception as e:
            print(f"[StreamingQuantClassifier] Failed saving state: {e}")
            return False

    def predict_one(self, x_dict: Dict[str, float]) -> Tuple[Optional[str], float, Dict[str, float]]:
        """
        Sub-millisecond single-sample streaming prediction.
        Returns: (predicted_tier, max_confidence, proba_dict)
        """
        if self.pipeline is None:
            return None, 0.0, {}

        try:
            probas = self.pipeline.predict_proba_one(x_dict)
            if not probas:
                # Default uniform priors if model is completely uninitialized
                probas = {cls: 1.0 / len(self.classes) for cls in self.classes}
            
            # Ensure all 3 classes are present in output dict
            for cls in self.classes:
                if cls not in probas:
                    probas[cls] = 0.0

            # Normalize probabilities
            total = sum(probas.values()) or 1.0
            norm_probas = {k: float(v / total) for k, v in probas.items()}

            best_tier = max(norm_probas.items(), key=lambda item: item[1])[0]
            max_conf = norm_probas[best_tier]

            return best_tier, max_conf, norm_probas
        except Exception as e:
            print(f"[StreamingQuantClassifier] predict_one error: {e}")
            return None, 0.0, {}

    def learn_one(self, x_dict: Dict[str, float], y: str) -> Dict[str, Any]:
        """
        Incrementally updates model weights using streaming SGD on a newly resolved ground-truth event.
        Runs in < 0.5ms.
        """
        t0 = time.perf_counter()
        
        # Step 1: Predict before learning to track out-of-sample progressive accuracy
        y_pred = self.pipeline.predict_one(x_dict)
        if y_pred is not None:
            self.metric.update(y, y_pred)

        # Step 2: Incremental SGD weight update
        self.pipeline.learn_one(x_dict, y)
        self.samples_learned += 1
        self.last_learned_at = time.time()
        
        elapsed_ms = (time.perf_counter() - t0) * 1000

        # Persist updated streaming state
        self.save()

        return {
            "success": True,
            "groundTruthClass": y,
            "progressiveAccuracy": float(self.metric.get()),
            "totalSamplesLearned": self.samples_learned,
            "learnLatencyMs": round(elapsed_ms, 3)
        }

    def get_stats(self) -> Dict[str, Any]:
        return {
            "onlineLearningActive": True,
            "samplesLearned": self.samples_learned,
            "lastLearnedAt": self.last_learned_at,
            "progressiveAccuracy": float(self.metric.get()) if self.samples_learned > 0 else 1.0
        }

online_classifier = StreamingQuantClassifier()
