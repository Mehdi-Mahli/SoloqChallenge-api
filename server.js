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
  { name: "Slarix", riotId: "perfect disaster#SoloQ", team: "Blue", role: "TOP", minRank:"EMERALD II" },
  { name: "Erwan", riotId: "Kaminari#SoloQ", team: "Yellow", role: "MID", minRank:"EMERALD II",_removeGames: 19,_removeWins: 15,_removeLosses: 4  },
  { name: "Maxa", riotId: "ABSOLUTE CINEMA#SoloQ", team: "Red", role: "TOP", minRank:"EMERALD II",_removeGames: 30,_removeWins: 28,_removeLosses: 2 },
  { name: "Wisper", riotId: "Taloned#SoloQ", team: "Blue", role: "JUNGLE", minRank:"DIAMOND IV" },
  { name: "Dax", riotId: "Tristana#SoloQ", team: "Blue", role: "ADC", minRank:"EMERALD IV" },
  { name: "Mehdi", riotId: "King Is Back#SoloQ", team: "Yellow", role: "JUNGLE", minRank:"EMERALD IV",_removeGames: 2,_removeWins: 2,_removeLosses: 0 },
  { name: "Tam", riotId: "Kanawin#SoloQ", team: "Red", role: "ADC", minRank:"EMERALD IV",_removeGames: 22,_removeWins: 16,_removeLosses: 6 },
  { name: "Thousand", riotId: "Tamestgros#SoloQ", team: "Yellow", role: "TOP", minRank:"EMERALD IV" },
  { name: "Marmotte", riotId: "Number 1 Agent#SoloQ", team: "Blue", role: "ADC", minRank:"EMERALD IV" },
  { name: "Alexis", riotId: "First Time Enjoy#SoloQ", team: "Yellow", role: "JUNGLE", minRank:"EMERALD IV",_removeGames: 2,_removeWins: 2,_removeLosses: 0 },
  { name: "Badr", riotId: "la toupie cassée#SoloQ", team: "Blue", role: "TOP", minRank:"PLATINUM II" },
  { name: "Willy", riotId: "little monster#SoloQ", team: "Red", role: "MID", minRank:"PLATINUM II" },
  { name: "Phi", riotId: "2ndBestADC#SoloQ", team: "Yellow", role: "ADC", minRank:"PLATINUM II",_removeGames: 18,_removeWins: 15,_removeLosses: 3 },
  { name: "Zak", riotId: "Rkaz Primal#SoloQ", team: "Blue", role: "JUNGLE", minRank:"GOLD II" },
  { name: "Achraf", riotId: "ExcedrynAbuser#212", team: "Red", role: "TOP", minRank:"GOLD II" },
  { name: "Bilel", riotId: "Gol D Booster#SoloQ", team: "Yellow", role: "JUNGLE", minRank:"GOLD IV" },
  { name: "Micka", riotId: "Very big bad mid#SoloQ", team: "Red", role: "MID", minRank:"GOLD IV",_removeGames: 5,_removeWins: 3,_removeLosses: 2 },
  { name: "Nishen", riotId: "ALFORD KADEEM#SoloQ", team: "Red", role: "JUNGLE", minRank:"GOLD IV" },
  { name: "Sevko", riotId: "SheLovesSevko#SoloQ", team: "Blue", role: "JUNGLE", minRank:"GOLD IV",_removeGames: 17,_removeWins: 10,_removeLosses: 5 },

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
  return res.json({
    data: cache.data,
    lastUpdate: cache.lastUpdate
  });
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
// 🔒 AJUSTEMENT INVISIBLE DES STATS (serveur only)
const removeGames = p._removeGames || 0;
const removeWins = p._removeWins || 0;
const removeLosses = p._removeLosses || 0;

games = Math.max(0, games - removeGames);
wins = Math.max(0, wins - removeWins);
losses = Math.max(0, losses - removeLosses);

winrate = games > 0 ? Math.round((wins / games) * 100) : 0;


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

res.json({
  data: cache.data,
  lastUpdate: cache.lastUpdate
});


  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Erreur API Riot" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur le port ${PORT}`);
});

