import fs from "node:fs";
import path from "node:path";

const workflowDir = path.join(process.cwd(), ".tmp", "n8n-ephemeral", "workflows");

const required = [
  {
    fileIncludes: "AfiliadosML.json",
    nodes: [
      "Build Final JSON",
      "Build Review Candidates",
      "Find Completed Candidate",
      "Mark Completed Candidate",
    ],
  },
  {
    fileIncludes: "Freshness",
    nodes: [
      "Check Freshness",
      "Build Stale Alert",
      "Notify Stale Alert",
      "Reprioritize Candidates",
      "Update Candidate Priority",
    ],
  },
  {
    fileIncludes: "Scheduler 7am",
    nodes: ["Armar Mensaje Candidates", "Build Candidate Snapshot Updates", "Persist Candidate Snapshot", "Needs Waiting Link"],
  },
  {
    fileIncludes: "Telegram Poll",
    nodes: ["Find Candidate Affiliate", "Mark Candidate Ready", "Filter Candidate Queue Adds", "Add Candidate to Queue"],
  },
];

if (!fs.existsSync(workflowDir)) {
  console.error("Missing prepared workflow directory. Run npm run n8n:prepare first.");
  process.exit(1);
}

let errors = 0;
const files = fs.readdirSync(workflowDir).filter((file) => file.endsWith(".json"));

for (const check of required) {
  const file = files.find((entry) => entry.includes(check.fileIncludes));
  if (!file) {
    errors += 1;
    console.error(`ERROR missing workflow file containing: ${check.fileIncludes}`);
    continue;
  }

  const workflow = JSON.parse(fs.readFileSync(path.join(workflowDir, file), "utf8"));
  const nodeNames = new Set(workflow.nodes.map((node) => node.name));
  for (const node of check.nodes) {
    if (!nodeNames.has(node)) {
      errors += 1;
      console.error(`ERROR ${workflow.name}: missing node "${node}"`);
    }
  }
}

if (errors > 0) {
  console.error(`Workflow verification failed: ${errors} error(s).`);
  process.exit(1);
}

console.log(`Workflow verification passed: ${required.length} workflow checks.`);
