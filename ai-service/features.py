from typing import Optional, Dict, Any, List
import numpy as np

# Canonical feature ordering used by model
FEATURE_NAMES = [
    "abs_change_pct",
    "volume_ratio",
    "sector_divergence",
    "sector_spread",
    "z_score",
    "rsi",
    "filing_present",
    "filing_age_minutes",
    "insider_buy",
    "insider_sell",
    "insider_value_cr",
    "source_trust",
    "is_stale",
    "historical_resolution_rate"
]

def extract_features_from_request(
    changePct: float,
    volumeRatio: float,
    sectorChangePct: float,
    sectorDivergence: bool,
    filingSummary: Optional[str] = None,
    isStale: bool = False,
    sourceTrust: int = 3,
    zScore: Optional[float] = None,
    rsi: Optional[float] = None,
    filingAgeMinutes: Optional[float] = None,
    insiderBuy: Optional[bool] = None,
    insiderSell: Optional[bool] = None,
    insiderValueCr: Optional[float] = None,
    historicalResolutionRate: Optional[float] = None
) -> np.ndarray:
    """
    Transforms market event parameters into a 14-dimensional feature vector for ML inference.
    """
    abs_change_pct = abs(float(changePct))
    vol_ratio = float(volumeRatio)
    sec_divergence = 1.0 if sectorDivergence else 0.0
    sec_spread = abs(float(changePct) - float(sectorChangePct))
    
    # Defaults if not directly provided in minimal request
    z_score_val = float(zScore) if zScore is not None else (abs_change_pct / 1.2 if abs_change_pct > 1.5 else 0.0)
    rsi_val = float(rsi) if rsi is not None else (70.0 if changePct > 0 else 30.0 if abs_change_pct > 2.0 else 50.0)
    
    filing_present_val = 1.0 if filingSummary and len(str(filingSummary).strip()) > 0 else 0.0
    filing_age_val = float(filingAgeMinutes) if filingAgeMinutes is not None else (15.0 if filing_present_val > 0 else 999.0)
    
    insider_buy_val = 1.0 if insiderBuy else 0.0
    insider_sell_val = 1.0 if insiderSell else 0.0
    insider_val_cr = float(insiderValueCr) if insiderValueCr is not None else 0.0
    
    source_trust_val = float(sourceTrust)
    is_stale_val = 1.0 if isStale else 0.0
    hist_res_rate = float(historicalResolutionRate) if historicalResolutionRate is not None else 0.5

    features = [
        abs_change_pct,
        vol_ratio,
        sec_divergence,
        sec_spread,
        z_score_val,
        rsi_val,
        filing_present_val,
        filing_age_val,
        insider_buy_val,
        insider_sell_val,
        insider_val_cr,
        source_trust_val,
        is_stale_val,
        hist_res_rate
    ]
    
    return np.array(features, dtype=np.float32).reshape(1, -1)

def extract_features_dict(
    changePct: float,
    volumeRatio: float,
    sectorChangePct: float,
    sectorDivergence: bool,
    filingSummary: Optional[str] = None,
    isStale: bool = False,
    sourceTrust: int = 3,
    zScore: Optional[float] = None,
    rsi: Optional[float] = None,
    filingAgeMinutes: Optional[float] = None,
    insiderBuy: Optional[bool] = None,
    insiderSell: Optional[bool] = None,
    insiderValueCr: Optional[float] = None,
    historicalResolutionRate: Optional[float] = None
) -> Dict[str, float]:
    """
    Returns a dict mapping feature_name -> float for River streaming online inference/learning.
    """
    vec = extract_features_from_request(
        changePct=changePct,
        volumeRatio=volumeRatio,
        sectorChangePct=sectorChangePct,
        sectorDivergence=sectorDivergence,
        filingSummary=filingSummary,
        isStale=isStale,
        sourceTrust=sourceTrust,
        zScore=zScore,
        rsi=rsi,
        filingAgeMinutes=filingAgeMinutes,
        insiderBuy=insiderBuy,
        insiderSell=insiderSell,
        insiderValueCr=insiderValueCr,
        historicalResolutionRate=historicalResolutionRate
    )[0]
    return {name: float(val) for name, val in zip(FEATURE_NAMES, vec)}

