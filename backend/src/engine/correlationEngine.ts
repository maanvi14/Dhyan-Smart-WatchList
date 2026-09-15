import { getStockReturns, getSectorReturns } from "../feed/seedCorrelationHistory";

/**
 * Calculates simple percentage returns (Δp / p) from an ordered series of prices.
 * Finance concept: Converts absolute rupee values into percentage changes so stocks of different price tiers can be compared.
 */
export function computeReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    if (prev === 0) {
      returns.push(0);
    } else {
      returns.push(Number(((prices[i] - prev) / prev).toFixed(5)));
    }
  }
  return returns;
}

/**
 * Computes the Pearson correlation coefficient (ρ) between two return series.
 * Finance concept: Measures how synchronously two assets move together on a scale from -1.0 (opposite) to +1.0 (lockstep).
 */
export function computeCorrelation(returnsX: number[], returnsY: number[]): number {
  const n = Math.min(returnsX.length, returnsY.length);
  if (n < 5) return 0;

  // Align the most recent n points
  const x = returnsX.slice(returnsX.length - n);
  const y = returnsY.slice(returnsY.length - n);

  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const denominator = Math.sqrt(varX * varY);
  if (denominator === 0) return 0;

  const r = cov / denominator;
  const clamped = Math.max(-1, Math.min(1, r));
  return Number(clamped.toFixed(4));
}

/**
 * Computes beta (β = Cov(stock, sector) / Var(sector)) against the sector benchmark return.
 * Finance concept: Gauges sensitivity — a beta of 1.3 means the stock historically magnifies sector swings by 30%.
 */
export function computeBeta(stockReturns: number[], sectorReturns: number[]): number {
  const n = Math.min(stockReturns.length, sectorReturns.length);
  if (n < 5) return 0;

  const s = stockReturns.slice(stockReturns.length - n);
  const m = sectorReturns.slice(sectorReturns.length - n);

  const meanS = s.reduce((sum, val) => sum + val, 0) / n;
  const meanM = m.reduce((sum, val) => sum + val, 0) / n;

  let cov = 0;
  let varM = 0;

  for (let i = 0; i < n; i++) {
    const ds = s[i] - meanS;
    const dm = m[i] - meanM;
    cov += ds * dm;
    varM += dm * dm;
  }

  if (varM === 0) return 0;

  const beta = cov / varM;
  return Number(beta.toFixed(4));
}

/**
 * Computes the standardized Z-score of prediction error (residual = actualMove - predictedMove).
 * Finance concept: Identifies whether the peer stock is moving far more (or less) than its historical model would expect.
 */
export function computeResidualZScore(
  actualMove: number,
  predictedMove: number,
  residualHistory: number[]
): number {
  if (residualHistory.length < 5) return 0;

  const n = residualHistory.length;
  const mean = residualHistory.reduce((sum, val) => sum + val, 0) / n;
  const variance = residualHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const currentResidual = actualMove - predictedMove;
  const z = (currentResidual - mean) / stdDev;
  return Number(z.toFixed(2));
}

/**
 * Applies exponential decay to event magnitude across propagation hops using half-life attenuation.
 * Finance concept: Shocks dissipate geometrically as they ripple through secondary and tertiary counterparties.
 */
export function exponentialDecay(
  baseMagnitude: number,
  hopCount: number,
  halfLifeHops: number = 1.5
): number {
  if (hopCount <= 0) return baseMagnitude;
  const decayFactor = Math.exp((-Math.LN2 / halfLifeHops) * hopCount);
  return Number((baseMagnitude * decayFactor).toFixed(2));
}

/**
 * Helper to compute pairwise correlation between two symbols from seeded history buffers.
 */
export function getPairwiseCorrelation(symbolA: string, symbolB: string): number {
  const returnsA = getStockReturns(symbolA);
  const returnsB = getStockReturns(symbolB);
  return computeCorrelation(returnsA, returnsB);
}

/**
 * Helper to compute symbol beta against its sector series from seeded history buffers.
 */
export function getSymbolSectorBeta(symbol: string, sector: string): number {
  const stockReturns = getStockReturns(symbol);
  const sectorReturns = getSectorReturns(sector);
  return computeBeta(stockReturns, sectorReturns);
}
