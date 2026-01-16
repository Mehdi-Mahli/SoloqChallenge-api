const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

const RIOT_API_KEY = process.env.RIOT_API_KEY;
/* ========================= */
/* 🧠 CACHE SERVEUR */
/* ========================= */
let cache = {
  data: null,
  lastUpdate: 0
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/* ========================= */
/* VALEUR DES RANKS */
/* ========================= */

/* ========================= */
/* JOUEURS */
/* ========================= */
const players = [
  { name: "Slarix", riotId: "perfect disaster#SoloQ", team: "Green", role: "TOP", minRank:"EMERALD II" },
  { name: "Erwan", riotId: "Kaminari#SoloQ", team: "Red", role: "MID", minRank:"EMERALD II"  },
  { name: "Maxa", riotId: "ABSOLUTE CINEMA#SoloQ", team: "Blue", role: "TOP", minRank:"EMERALD II" },
  { name: "Wisper", riotId: "Taloned#SoloQ", team: "Green", role: "JUNGLE", minRank:"EMERALD II" },
  { name: "Dax", riotId: "Tristana#SoloQ", team: "Green", role: "ADC", minRank:"EMERALD IV" },
  { name: "Mehdi", riotId: "King Is Back#SoloQ", team: "Red", role: "JUNGLE", minRank:"PLATINUM II" },
  { name: "Badr", riotId: "la toupie cassée#SoloQ", team: "Red", role: "TOP", minRank:"PLATINUM IV" },
  { name: "Willy", riotId: "little monster#SoloQ", team: "Red", role: "MID", minRank:"PLATINUM IV" },
  { name: "Alexis", riotId: "First Time Enjoy#SoloQ", team: "Blue", role: "ADC", minRank:"PLATINUM II" },
  { name: "Phi", riotId: "2ndBestADC#SoloQ", team: "Green", role: "ADC", minRank:"PLATINUM IV" },
  { name: "Achraf", riotId: "ExcedrynAbuser#212", team: "Blue", role: "TOP", minRank:"GOLD II" },
  { name: "Bilel", riotId: "Gol D Booster#SoloQ", team: "Green", role: "JUNGLE", minRank:"GOLD IV" },
  { name: "Micka", riotId: "Very big bad mid#SoloQ", team: "Red", role: "MID", minRank:"GOLD IV" },
  { name: "Nishen", riotId: "ALFORD KADEEM#SoloQ", team: "Blue", role: "JUNGLE", minRank:"GOLD IV" },
  { name: "Sevko", riotId: "SheLovesSevko#SoloQ", team: "Blue", role: "JUNGLE", minRank:"GOLD IV" },
  { name: "Zak", riotId: "Rkaz Primal#SoloQ", team: "Green", role: "JUNGLE", minRank:"GOLD II" },
  { name: "Tam", riotId: "Kanawin#SoloQ", team: "Red", role: "ADC", minRank:"EMERALD IV" },
  { name: "Thousand", riotId: "Tamestgros#SoloQ", team: "Blue", role: "TOP", minRank:"EMERALD IV" },
  { name: "Marmotte", riotId: "Tamestgros#SoloQ", team: "Blue", role: "ADC", minRank:"EMERALD IV" },
];



const TIER_ORDER = {
  IRON: 0,
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  PLATINUM: 4,
  EMERALD: 5,
  DIAMOND: 6,
  MASTER: 7,
  GRANDMASTER: 8,
  CHALLENGER: 9
};

const DIVISION_ORDER = {
  IV: 0,
  III: 1,
  II: 2,
  I: 3
};

function getTotalLP(tier, division, lp) {
  return (
    TIER_ORDER[tier] * 400 +
    DIVISION_ORDER[division] * 100 +
    lp
  );
}
function parseMinRank(minRank) {
  if (!minRank) return null;

  const [tier, division] = minRank.split(" ");
  return getTotalLP(tier, division, 0);
}
const UNRANKED_TOTAL_LP = 0;

/* ========================= */
/* API REFRESH */
/* ========================= */
app.get("/api/refresh", async (req, res) => {
  try {
    const now = Date.now();

    // ✅ Si cache valide → on renvoie direct
    if (cache.data && now - cache.lastUpdate < CACHE_DURATION) {
      return res.json(cache.data);
    }

    const results = [];
    for (const p of players) {
  const [gameName, tagLine] = p.riotId.split("#");

  // Account
  const account = await axios.get(
    `https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`,
    { headers: { "X-Riot-Token": RIOT_API_KEY } }
  );

  const puuid = account.data.puuid;

  // Ranked
  const league = await axios.get(
    `https://euw1.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
    { headers: { "X-Riot-Token": RIOT_API_KEY } }
  );

  const soloQ = league.data.find(
    q => q.queueType === "RANKED_SOLO_5x5"
  );

  let rank = "Unranked";
  let lp = 0;
  let score = 0;
  let wins = 0;
  let losses = 0;
  let games = 0;
  let winrate = 0;

  let playerTotalLP = UNRANKED_TOTAL_LP;

  if (soloQ) {
    playerTotalLP = getTotalLP(
      soloQ.tier,
      soloQ.rank,
      soloQ.leaguePoints
    );

    lp = soloQ.leaguePoints;
    wins = soloQ.wins;
    losses = soloQ.losses;
    games = wins + losses;
    winrate = Math.round((wins / games) * 100);
    rank = `${soloQ.tier} ${soloQ.rank}`;
  }

  // 🎯 score (positif OU négatif)
  const minTotalLP = parseMinRank(p.minRank);
  score = playerTotalLP - minTotalLP;

  results.push({
  name: p.name,
  riotId: p.riotId,
  team: p.team,
  role: p.role,
  rank,
  lp,
  score,
  games,
  wins,
  losses,
  winrate,
  minRank: p.minRank, // 👈 AJOUT ICI
});

}
    results.sort((a, b) => b.score - a.score);
    cache = {
      data: results,
      lastUpdate: Date.now()
    };
    res.json(results);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Erreur API Riot" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur le port ${PORT}`);
});

