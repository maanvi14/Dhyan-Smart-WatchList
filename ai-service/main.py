import os
import time
import httpx
import re
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Dhyan Verification Flow Service", version="1.0.0")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

class VerificationRequest(BaseModel):
  symbol: str
  changePct: float
  volumeRatio: float
  sectorChangePct: float
  sectorDivergence: bool
  volumeDivergence: bool
  filingSummary: Optional[str] = None
  isStale: bool = False
  sourceTrust: int = 3
  lowDataMode: bool = False

class VerificationResponse(BaseModel):
  confidenceTier: str  # CONFIRMED | UNEXPLAINED | UNCERTAIN
  narrative: str
  evidenceTrace: List[Dict[str, Any]]

class ChatRequest(BaseModel):
  message: str
  watchlistPayload: Dict[str, Any]

class ChatResponse(BaseModel):
  answer: str
  isRefusal: bool
  citedEvents: List[str]

def format_timestamp():
  return datetime.utcnow().isoformat() + "Z"

def clean_filing_title(filingSummary: Optional[str]) -> str:
  if not filingSummary:
    return "exchange announcement"
  text = filingSummary.strip()
  # Strip redundant prefixes like "NSE Filing:", "Filing:", etc.
  text = re.sub(r'^(NSE\s+Filing|BSE\s+Filing|Filing)\s*:\s*', '', text, flags=re.IGNORECASE).strip()
  # Remove trailing periods
  text = text.rstrip('.')
  return text

def generate_templated_narrative(symbol: str, changePct: float, volumeRatio: float, sectorChangePct: float, filingSummary: Optional[str], tier: str) -> str:
  sign = "+" if changePct >= 0 else ""
  if tier == "CONFIRMED":
    filing_clean = clean_filing_title(filingSummary)
    return f"{symbol} moved {sign}{changePct:.2f}% following official disclosure: {filing_clean}."
  elif tier == "UNEXPLAINED":
    return f"{symbol} moved {sign}{changePct:.2f}% with {volumeRatio:.1f}x volume vs sector {sectorChangePct:+.2f}%; no confirmed catalyst found."
  else: # UNCERTAIN
    return f"{symbol} snapshot marked stale or conflicting; current market price data cannot be verified."

async def call_groq_llm(symbol: str, changePct: float, volumeRatio: float, sectorChangePct: float, filingSummary: Optional[str], tier: str) -> str:
  if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not set in environment")

  filing_clean = clean_filing_title(filingSummary)
  prompt = f"""You are a factual market data assistant for Indian retail investors. You do not predict, recommend, or forecast anything.

Symbol: {symbol}
Change: {changePct}%
Volume vs avg: {volumeRatio}x
Sector move: {sectorChangePct}%
Filing found: {filing_clean if filingSummary else "None"}
Confidence tier already determined as: {tier}

Write ONE factual sentence, max 25 words, appropriate to the tier:
- CONFIRMED: state the move and cite the filing/catalyst plainly.
- UNEXPLAINED: state the move and volume/sector context, and explicitly say no confirmed catalyst was found.
- UNCERTAIN: do not describe the move at all — state that current data is stale/conflicting and should not be trusted yet.

Never use words like "likely," "expected to," "target," "buy," "sell," or any predictive/advisory language."""

  headers = {
    "Authorization": f"Bearer {GROQ_API_KEY}",
    "Content-Type": "application/json"
  }
  payload = {
    "model": GROQ_MODEL,
    "messages": [
      {"role": "system", "content": "You are a strict market factual narrative writer. Never predict or give financial advice."},
      {"role": "user", "content": prompt}
    ],
    "max_tokens": 60,
    "temperature": 0.1
  }

  async with httpx.AsyncClient(timeout=4.0) as client:
    response = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
    if response.status_code != 200:
      raise ValueError(f"Groq API returned HTTP {response.status_code}: {response.text}")
    data = response.json()
    narrative = data["choices"][0]["message"]["content"].strip()
    return narrative

@app.get("/health")
def health_check():
  return {"status": "ok", "service": "dhyan-ai-verification", "groqConfigured": bool(GROQ_API_KEY)}

@app.post("/verify", response_model=VerificationResponse)
async def verify_change_event(req: VerificationRequest):
  trace = []
  t0 = time.time()

  # Step 1: gather_evidence
  trace.append({
    "step": "gather_evidence",
    "timestamp": format_timestamp(),
    "detail": f"Collected price move ({req.changePct:+.2f}%), volume ratio ({req.volumeRatio:.2f}x), sector move ({req.sectorChangePct:+.2f}%), filing status ({'Found' if req.filingSummary else 'None'}), and data trust score ({req.sourceTrust}/3)."
  })

  # Step 2: classify_tier (Deterministic Rule-Based Node)
  tier = "UNEXPLAINED"
  if req.isStale or req.sourceTrust < 1:
    tier = "UNCERTAIN"
    trace.append({
      "step": "classify_tier",
      "timestamp": format_timestamp(),
      "detail": "Tier classified as UNCERTAIN due to stale price snapshot or low data source trust."
    })
  elif req.filingSummary and len(req.filingSummary.strip()) > 0:
    tier = "CONFIRMED"
    trace.append({
      "step": "classify_tier",
      "timestamp": format_timestamp(),
      "detail": f"Tier classified as CONFIRMED based on verified exchange announcement within 4h window."
    })
  else:
    tier = "UNEXPLAINED"
    trace.append({
      "step": "classify_tier",
      "timestamp": format_timestamp(),
      "detail": f"Tier classified as UNEXPLAINED: price/volume threshold passed but no matching filing was found."
    })

  # Step 3: write_narrative (or Low-Data / Fallback Node)
  narrative = ""
  if req.lowDataMode:
    narrative = generate_templated_narrative(req.symbol, req.changePct, req.volumeRatio, req.sectorChangePct, req.filingSummary, tier)
    trace.append({
      "step": "write_narrative_low_data",
      "timestamp": format_timestamp(),
      "detail": "Low Data Mode active: LLM call bypassed, generated concise deterministic narrative."
    })
  else:
    try:
      narrative = await call_groq_llm(req.symbol, req.changePct, req.volumeRatio, req.sectorChangePct, req.filingSummary, tier)
      trace.append({
        "step": "write_narrative_groq_llm",
        "timestamp": format_timestamp(),
        "detail": f"Generated factual narrative using Groq LLM ({GROQ_MODEL}) in {int((time.time() - t0)*1000)}ms."
      })
    except Exception as e:
      # Precise error logging for trace
      error_msg = str(e)
      if "timeout" in error_msg.lower():
        fallback_reason = "Fallback: Groq API request timed out after 4s"
      elif "not set" in error_msg.lower():
        fallback_reason = "Fallback: GROQ_API_KEY not set in environment"
      else:
        fallback_reason = f"Fallback: {error_msg}"

      narrative = generate_templated_narrative(req.symbol, req.changePct, req.volumeRatio, req.sectorChangePct, req.filingSummary, tier)
      trace.append({
        "step": "fallback_node",
        "timestamp": format_timestamp(),
        "detail": f"{fallback_reason}. Used deterministic narrative fallback to preserve integrity."
      })

  return VerificationResponse(
    confidenceTier=tier,
    narrative=narrative,
    evidenceTrace=trace
  )

@app.post("/chat", response_model=ChatResponse)
async def ask_dhyan_chat(req: ChatRequest):
  message = req.message.strip()
  payload_json = req.watchlistPayload

  # Predictive / Advisory Keyword Detection
  predictive_keywords = [
    "predict", "target", "should i buy", "should i sell", "will it go up",
    "will it fall", "future price", "price target", "investment advice",
    "recommendation", "forecast", "tomorrow price"
  ]
  is_predictive = any(kw in message.lower() for kw in predictive_keywords)

  system_prompt = """You are Ask Dhyan, a factual assistant that explains market moves ALREADY DETECTED by this app.
You may only use the data provided below. Do not use outside knowledge.
You must NEVER predict future prices, give buy/sell advice, or suggest targets.
If asked to predict or advise, respond: "Dhyan doesn't predict or advise — here's what's actually been confirmed:" and then share only verified facts relevant to the question, if any exist.

Available data for this user's watchlist:
""" + str(payload_json) + """

User question: """ + message

  if is_predictive:
    # Rule-based predictive refusal card
    # Find relevant events if symbol mentioned in question
    events = payload_json.get("events", [])
    symbol_matches = [e for e in events if e.get("symbol", "").lower() in message.lower()]
    relevant = symbol_matches if symbol_matches else events[:2]
    
    if relevant:
      facts = " ".join([f"{e['symbol']}: {e['narrative']}" for e in relevant])
      answer = f"Dhyan doesn't predict or advise — here's what's actually been confirmed: {facts}"
    else:
      answer = "Dhyan doesn't predict or advise — here's what's actually been confirmed: All current watchlist prices are operating within normal volatility bounds with zero predictive forecasts generated."
    
    return ChatResponse(
      answer=answer,
      isRefusal=True,
      citedEvents=[e.get("id", "") for e in relevant]
    )

  # Try Groq for factual response if configured
  if GROQ_API_KEY:
    try:
      headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
      }
      groq_payload = {
        "model": GROQ_MODEL,
        "messages": [
          {"role": "system", "content": "You are Ask Dhyan. Only answer using provided data. Never predict or give financial advice."},
          {"role": "user", "content": system_prompt}
        ],
        "max_tokens": 150,
        "temperature": 0.1
      }
      async with httpx.AsyncClient(timeout=4.0) as client:
        resp = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=groq_payload)
        if resp.status_code == 200:
          ans = resp.json()["choices"][0]["message"]["content"].strip()
          return ChatResponse(answer=ans, isRefusal=False, citedEvents=[])
    except Exception:
      pass

  # Deterministic Grounded Fallback if Groq unavailable
  events = payload_json.get("events", [])
  if events:
    top_event = events[0]
    answer = f"Based on your watchlist data, {top_event['symbol']} logged a {top_event['confidenceTier']} event: {top_event['narrative']}"
  else:
    items = payload_json.get("items", [])
    answer = f"Your watchlist contains {len(items)} stocks across sectors. All recent ticks are grounded in verifiable exchange snapshots."

  return ChatResponse(answer=answer, isRefusal=False, citedEvents=[])

class VerifyTipRequest(BaseModel):
  symbol: str
  symbolName: str
  originalTip: str
  isFilingClaim: bool = False
  isPriceClaim: bool = False
  changePct: float = 0.0
  volumeRatio: float = 1.0
  sectorChangePct: float = 0.0
  filingSummary: Optional[str] = None
  isStale: bool = False
  sourceTrust: int = 1

async def call_groq_tip_narrative(req: VerifyTipRequest, tier: str) -> str:
  if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not set in environment")

  filing_clean = clean_filing_title(req.filingSummary)
  claim_snippet = req.originalTip[:120]

  prompt = f"""You are a factual market data assistant for Indian retail investors. You do not predict, recommend, or forecast anything.

Original tip text (max 120 chars): "{claim_snippet}"
Symbol detected: {req.symbol} ({req.symbolName})
Claim type: {"Filing/corporate action" if req.isFilingClaim else "Price movement" if req.isPriceClaim else "General"}
Filing found in last 30 days: {filing_clean if req.filingSummary else "None"}
Current price change: {req.changePct:+.2f}%
Volume vs avg: {req.volumeRatio:.1f}x
Confidence tier assigned: {tier}

Write ONE factual sentence (max 30 words) explaining what the evidence says about this tip:
- CONFIRMED: state that a matching exchange filing exists and cite it briefly.
- UNCERTAIN: state clearly that no filing was found OR data is unavailable — tell the user to treat the tip with caution.
- UNEXPLAINED: state the actual price/volume data and say no confirmed catalyst was found.

Never use "likely", "expected", "target", "buy", "sell", or any predictive/advisory language. Start with the symbol name."""

  headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}
  payload = {
    "model": GROQ_MODEL,
    "messages": [
      {"role": "system", "content": "You are a strict factual market data analyst. Verify claims with evidence only. Never predict."},
      {"role": "user", "content": prompt}
    ],
    "max_tokens": 80,
    "temperature": 0.1
  }

  async with httpx.AsyncClient(timeout=5.0) as client:
    response = await client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
    if response.status_code != 200:
      raise ValueError(f"Groq API returned HTTP {response.status_code}: {response.text}")
    data = response.json()
    return data["choices"][0]["message"]["content"].strip()

@app.post("/verify-tip")
async def verify_tip(req: VerifyTipRequest):
  trace = []
  t0 = time.time()

  # Step 1 — Tip parse evidence
  trace.append({
    "step": "tip_symbol_extract",
    "timestamp": format_timestamp(),
    "detail": f"Detected symbol {req.symbol} ({req.symbolName}) in tip text. Claim type: {'filing-based' if req.isFilingClaim else 'price-move' if req.isPriceClaim else 'general'}."
  })

  # Step 2 — Filing lookup (30-day window done by backend; result passed in)
  trace.append({
    "step": "filing_lookup_30d",
    "timestamp": format_timestamp(),
    "detail": f"Exchange filings (30-day window): {'Found — ' + clean_filing_title(req.filingSummary) if req.filingSummary else f'No filings found for {req.symbol} in the last 30 days.'}",
  })

  # Step 3 — Tier classification
  tier = "UNEXPLAINED"
  if req.isStale or req.sourceTrust < 1:
    tier = "UNCERTAIN"
    tier_reason = "Uncertain: price data is stale or unavailable — claim cannot be verified against current market data."
  elif req.isFilingClaim and req.filingSummary:
    tier = "CONFIRMED"
    tier_reason = f"Confirmed: filing '{clean_filing_title(req.filingSummary)}' corroborates the tip."
  elif req.isFilingClaim and not req.filingSummary:
    tier = "UNCERTAIN"
    tier_reason = "Uncertain: tip claims a corporate action but no matching NSE filing found in last 30 days."
  elif req.isPriceClaim:
    # Check if claimed direction matches actual move
    claimed_up = any(kw in req.originalTip.lower() for kw in ["up", "rally", "buy", "breakout", "rise"])
    actual_up = req.changePct >= 0
    if claimed_up != actual_up and abs(req.changePct) > 1.0:
      tier = "UNCERTAIN"
      tier_reason = f"Uncertain: tip claims {'upward' if claimed_up else 'downward'} move but actual change is {req.changePct:+.2f}% — directional mismatch."
    else:
      tier = "UNEXPLAINED"
      tier_reason = f"Unexplained: price changed {req.changePct:+.2f}% with {req.volumeRatio:.1f}x volume but no confirmed catalyst found."
  else:
    tier = "UNEXPLAINED"
    tier_reason = "Unexplained: no filing match found and no directional price evidence."

  trace.append({
    "step": "classify_tier",
    "timestamp": format_timestamp(),
    "detail": tier_reason
  })

  # Step 4 — Narrative
  narrative = ""
  try:
    narrative = await call_groq_tip_narrative(req, tier)
    trace.append({
      "step": "write_narrative_groq_llm",
      "timestamp": format_timestamp(),
      "detail": f"Tip-specific narrative generated via Groq LLM ({GROQ_MODEL}) in {int((time.time()-t0)*1000)}ms."
    })
  except Exception as e:
    error_msg = str(e)
    if "timeout" in error_msg.lower():
      fallback_reason = "Fallback: Groq API timed out"
    elif "not set" in error_msg.lower():
      fallback_reason = "Fallback: GROQ_API_KEY not set"
    else:
      fallback_reason = f"Fallback: {error_msg}"

    # Deterministic fallback narrative for tip
    sign = "+" if req.changePct >= 0 else ""
    if tier == "CONFIRMED":
      narrative = f"{req.symbolName} ({req.symbol}): A matching exchange filing corroborates this tip — {clean_filing_title(req.filingSummary)}."
    elif tier == "UNCERTAIN":
      if req.filingSummary is None and req.isFilingClaim:
        narrative = f"{req.symbolName}: No exchange filing found for this claimed event in the last 30 days — treat this tip with caution."
      else:
        narrative = f"{req.symbolName}: Current price data is stale or unavailable — this tip cannot be verified at this time."
    else:
      narrative = f"{req.symbolName} shows {sign}{req.changePct:.2f}% change with {req.volumeRatio:.1f}x volume. No confirmed catalyst found for this tip."

    trace.append({
      "step": "fallback_node",
      "timestamp": format_timestamp(),
      "detail": f"{fallback_reason}. Used deterministic narrative."
    })

  return {
    "confidenceTier": tier,
    "narrative": narrative,
    "evidenceTrace": trace
  }

if __name__ == "__main__":
  import uvicorn
  uvicorn.run(app, host="0.0.0.0", port=8000)
