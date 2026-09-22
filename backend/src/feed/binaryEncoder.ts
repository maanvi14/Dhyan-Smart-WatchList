// ─────────────────────────────────────────────────────────────────────────────
// Groww 915 High-Performance Binary Frame Encoder
// ─────────────────────────────────────────────────────────────────────────────

export interface BinaryTickPayload {
  symbol: string;
  symbolId: number;
  ltp: number;
  changePct: number;
  volume: number;
  volumeRatio: number;
  sectorChangePct: number;
  isStale: boolean;
  tierByte: number; // 1: CONFIRMED, 2: UNEXPLAINED, 3: UNCERTAIN
  timestamp: number;
}

// Map canonical symbols to 2-byte compact integer IDs
export const SYMBOL_ID_MAP: Record<string, number> = {
  "NSE:RELIANCE": 101,
  "NSE:TCS": 102,
  "NSE:HDFCBANK": 103,
  "NSE:INFY": 104,
  "NSE:ICICIBANK": 105,
  "NSE:TATAMOTORS": 106,
  "NSE:WIPRO": 107,
  "NSE:SBIN": 108,
  "NSE:BHARTIARTL": 109,
  "NSE:ITC": 110,
  "NSE:KOTAKBANK": 111,
  "NSE:LT": 112,
  "NSE:AXISBANK": 113,
  "NSE:MARUTI": 114,
  "NSE:BAJFINANCE": 115
};

export const REVERSE_SYMBOL_ID_MAP: Record<number, string> = Object.entries(SYMBOL_ID_MAP).reduce(
  (acc, [sym, id]) => ({ ...acc, [id]: sym }),
  {}
);

/**
 * Packs a stock snapshot into a compact 20-byte binary Buffer:
 * - [0..1]  : Symbol ID (Uint16, 2 bytes)
 * - [2..5]  : LTP (Float32, 4 bytes)
 * - [6..9]  : Change Pct (Float32, 4 bytes)
 * - [10..13]: Volume Ratio (Float32, 4 bytes)
 * - [14..17]: Sector Change Pct (Float32, 4 bytes)
 * - [18]    : Flags: isStale (1 bit) + Tier (2 bits) (Uint8, 1 byte)
 * - [19]    : Checksum / Padding (Uint8, 1 byte)
 * Total: 20 bytes (compared to ~170-220 bytes JSON)
 */
export function encodeBinaryTick(snap: any): Buffer {
  const buf = Buffer.allocUnsafe(20);
  const symbolId = SYMBOL_ID_MAP[snap.symbol] || 999;
  
  const tierByte = snap.confidenceTier === "CONFIRMED" ? 1 : snap.confidenceTier === "UNEXPLAINED" ? 2 : 3;
  const isStaleBit = snap.isStale ? 1 : 0;
  const flagsByte = (isStaleBit << 4) | (tierByte & 0x0f);

  buf.writeUInt16BE(symbolId, 0);
  buf.writeFloatBE(snap.ltp || 0, 2);
  buf.writeFloatBE(snap.changePct || 0, 6);
  buf.writeFloatBE(snap.volumeRatio || 1.0, 10);
  buf.writeFloatBE(snap.sectorChangePct || 0, 14);
  buf.writeUInt8(flagsByte, 18);
  buf.writeUInt8(0xAA, 19); // magic marker

  return buf;
}

export function decodeBinaryTick(buf: Buffer): BinaryTickPayload {
  const symbolId = buf.readUInt16BE(0);
  const ltp = buf.readFloatBE(2);
  const changePct = buf.readFloatBE(6);
  const volumeRatio = buf.readFloatBE(10);
  const sectorChangePct = buf.readFloatBE(14);
  const flagsByte = buf.readUInt8(18);

  const isStale = (flagsByte >> 4) === 1;
  const tierByte = flagsByte & 0x0f;
  const symbol = REVERSE_SYMBOL_ID_MAP[symbolId] || `SYM:${symbolId}`;

  return {
    symbol,
    symbolId,
    ltp: Number(ltp.toFixed(2)),
    changePct: Number(changePct.toFixed(2)),
    volume: 0,
    volumeRatio: Number(volumeRatio.toFixed(2)),
    sectorChangePct: Number(sectorChangePct.toFixed(2)),
    isStale,
    tierByte,
    timestamp: Date.now()
  };
}

/**
 * Computes exact measured byte reduction from a real sample snapshot.
 */
export function measureBinaryCompressionRatio(sampleSnap: any) {
  const jsonStr = JSON.stringify(sampleSnap);
  const jsonBytes = Buffer.byteLength(jsonStr, "utf8");
  const binaryBytes = 20;
  const reductionPct = ((jsonBytes - binaryBytes) / jsonBytes) * 100;

  return {
    jsonBytes,
    binaryBytes,
    reductionPercentage: Number(reductionPct.toFixed(1))
  };
}
