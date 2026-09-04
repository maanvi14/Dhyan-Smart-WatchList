import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dhyan-secret-key-2026";

// ── Zero-Click Cross-Device Handoff helper ─────────────────────────────────
function parseDeviceLabel(userAgent: string | undefined): string {
  if (!userAgent) return "Unknown Device";
  const ua = userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipad/.test(ua);
  const platform = isMobile ? "Mobile" : "Desktop";
  if (ua.includes("chrome") && !ua.includes("edg")) return `${platform} Chrome`;
  if (ua.includes("safari") && !ua.includes("chrome")) return `${platform} Safari`;
  if (ua.includes("firefox")) return `${platform} Firefox`;
  if (ua.includes("edg")) return `${platform} Edge`;
  return `${platform} Browser`;
}

async function upsertSessionAndDetectHandoff(
  userId: string,
  currentDeviceLabel: string
): Promise<{ previousDevice: string | null }> {
  // Find or create the session record for this user
  const existing = await prisma.userSession.findFirst({ where: { userId } });
  const previousDevice = existing?.lastDevice || null;

  if (existing) {
    await prisma.userSession.update({
      where: { id: existing.id },
      data: { lastDevice: currentDeviceLabel, deviceInfo: currentDeviceLabel }
    });
  } else {
    await prisma.userSession.create({
      data: { userId, lastDevice: currentDeviceLabel, deviceInfo: currentDeviceLabel }
    });
  }

  // Only flag as handoff if the device actually changed
  const isHandoff = previousDevice && previousDevice !== currentDeviceLabel;
  return { previousDevice: isHandoff ? previousDevice : null };
}

// GET Demo Info (Dynamic seed stock count)
router.get("/demo-info", async (req, res) => {
  try {
    const demoEmail = "demo@dhyan.in";
    const user = await prisma.user.findUnique({
      where: { email: demoEmail },
      include: { watchlists: { include: { items: true } } }
    });

    const count = user?.watchlists[0]?.items?.length || 9;
    res.json({ seedStockCount: count });
  } catch (err) {
    res.json({ seedStockCount: 9 });
  }
});

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, investmentStyle, lowDataMode } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        investmentStyle: investmentStyle || "MEDIUM_TERM",
        lowDataMode: Boolean(lowDataMode),
        watchlists: {
          create: {
            name: "My Watchlist"
          }
        }
      },
      include: { watchlists: true }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        investmentStyle: user.investmentStyle,
        lowDataMode: user.lowDataMode,
        watchlistId: user.watchlists[0]?.id
      }
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { watchlists: true }
    });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    // Zero-Click Cross-Device Handoff detection
    const deviceLabel = parseDeviceLabel(req.headers["user-agent"]);
    const { previousDevice } = await upsertSessionAndDetectHandoff(user.id, deviceLabel).catch(() => ({ previousDevice: null }));

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        investmentStyle: user.investmentStyle,
        lowDataMode: user.lowDataMode,
        watchlistId: user.watchlists[0]?.id
      },
      // Handoff data: null if same device, device name string if different
      handoff: previousDevice ? { previousDevice, currentDevice: deviceLabel } : null
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Demo Login (Instant single tap access for judges)
router.post("/demo", async (req, res) => {
  try {
    const demoEmail = "demo@dhyan.in";
    let user = await prisma.user.findUnique({
      where: { email: demoEmail },
      include: { watchlists: true }
    });

    if (!user) {
      const passwordHash = await bcrypt.hash("demo1234", 10);
      user = await prisma.user.create({
        data: {
          email: demoEmail,
          passwordHash,
          name: "Demo Investor",
          investmentStyle: "MEDIUM_TERM",
          lowDataMode: false,
          watchlists: {
            create: {
              name: "Flagship Watchlist"
            }
          }
        },
        include: { watchlists: true }
      });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

    // Zero-Click Cross-Device Handoff detection
    const deviceLabel = parseDeviceLabel(req.headers["user-agent"]);
    const { previousDevice } = await upsertSessionAndDetectHandoff(user.id, deviceLabel).catch(() => ({ previousDevice: null }));

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        investmentStyle: user.investmentStyle,
        lowDataMode: user.lowDataMode,
        watchlistId: user.watchlists[0]?.id
      },
      handoff: previousDevice ? { previousDevice, currentDevice: deviceLabel } : null
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
