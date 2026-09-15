import { prisma } from "./db";
import { SYMBOL_UNIVERSE } from "./feed/symbols";

export async function populateUniverseWatchlist(): Promise<number> {
  const watchlists = await prisma.watchlist.findMany();
  let addedCount = 0;
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000);

  for (const wl of watchlists) {
    const existingItems = await prisma.watchlistItem.findMany({
      where: { watchlistId: wl.id }
    });
    const existingSymbols = new Set(existingItems.map(i => i.symbol));

    for (const sym of SYMBOL_UNIVERSE) {
      if (!existingSymbols.has(sym.symbol)) {
        await prisma.watchlistItem.create({
          data: {
            watchlistId: wl.id,
            symbol: sym.symbol,
            sector: sym.sector,
            notes: `${sym.name} - ${sym.sector} core tracking`,
            addedAt: fiveHoursAgo,
            lastViewedAt: threeHoursAgo
          }
        });
        addedCount++;
      }
    }
  }

  console.log(`[Universe] Populated ${addedCount} missing symbols across ${watchlists.length} watchlist(s).`);
  return addedCount;
}

if (require.main === module) {
  populateUniverseWatchlist()
    .then(() => prisma.$disconnect())
    .catch(err => {
      console.error(err);
      prisma.$disconnect();
      process.exit(1);
    });
}
