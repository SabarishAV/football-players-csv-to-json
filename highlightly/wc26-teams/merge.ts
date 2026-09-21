import { writeFileSync } from "fs";
import highlightlyWcTeam from "./data/national-teams.json";
import existingTeams from "./data/teams-fifa-wc-2026.json";
import path from "path";

async function main(): Promise<void> {
  const highlightlyTeamNameByStringId = new Map(
    highlightlyWcTeam.map((t) => [t.name, String(t.id)]),
  );

  const teams = [];
  for (const team of existingTeams) {
    teams.push({
      ...team,
      highlightlyId: highlightlyTeamNameByStringId.get(team.name),
    });
  }

//   const filePath = path.join(__dirname, "data", "wc_2026_teams.json");
//   writeFileSync(filePath, JSON.stringify(teams, null, 2), "utf-8");
for(const team of teams){
    if(!team.highlightlyId){
        console.log(team.name)
    }
}
}
main();
