import { Router } from "express";
import { priceFeed } from "../feed/priceFeed";

const router = Router();

// Kill Feed Switch
router.post("/feed/kill", (req, res) => {
  priceFeed.killFeed();
  res.json({
    success: true,
    feedStatus: priceFeed.getFeedStatus()
  });
});

// Revive Feed Switch
router.post("/feed/revive", (req, res) => {
  priceFeed.reviveFeed();
  res.json({
    success: true,
    feedStatus: priceFeed.getFeedStatus()
  });
});

// Get Feed Status
router.get("/feed/status", (req, res) => {
  res.json(priceFeed.getFeedStatus());
});

export default router;
