async function fetchPlayers() {
  const PLAYERS_URL =
    "https://raw.githubusercontent.com/SabarishAV/football-players-csv-to-json/master/players.json";

  const response = await fetch(PLAYERS_URL);
  const players = await response.json();

  console.log(players);
}

fetchPlayers();
