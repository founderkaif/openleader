import express from "express";
import cors from "cors";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const app = express();
const PORT = 8787;
const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "leads_output");

app.use(cors());
app.use(express.json());

let activeProcess = null;

async function readNewestJson() {
  const files = await fs.readdir(OUTPUT_DIR);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));
  if (!jsonFiles.length) {
    throw new Error("No JSON output found.");
  }

  const withStats = await Promise.all(
    jsonFiles.map(async (file) => ({
      file,
      stat: await fs.stat(path.join(OUTPUT_DIR, file)),
    }))
  );
  withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  const newest = withStats[0].file;
  const filePath = path.join(OUTPUT_DIR, newest);
  const raw = await fs.readFile(filePath, "utf8");
  return { filePath, leads: JSON.parse(raw) };
}

app.post("/api/scrape", async (req, res) => {
  if (activeProcess) {
    res.status(409).json({ error: "A scrape is already running." });
    return;
  }

  const {
    query = "",
    count = 50,
    keepGoing = false,
    fetchEmails = true,
  } = req.body || {};

  if (!query.trim()) {
    res.status(400).json({ error: "Query is required." });
    return;
  }

  const args = [
    "gmaps_scraper.py",
    query,
    "--format",
    "json",
    "--output",
    "./leads_output",
  ];

  if (keepGoing) args.push("--keep-going");
  else args.push("--count", String(count));
  if (!fetchEmails) args.push("--no-email");

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const child = spawn("python", args, {
    cwd: ROOT,
    windowsHide: true,
  });
  activeProcess = child;

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("error", () => {
    if (activeProcess === child) {
      activeProcess = null;
    }
  });

  child.on("close", async (code) => {
    if (activeProcess === child) {
      activeProcess = null;
    }

    if (code !== 0) {
      res.status(500).json({
        error: "Scraper failed.",
        logs: `${stdout}\n${stderr}`.trim(),
      });
      return;
    }

    try {
      const { leads, filePath } = await readNewestJson();
      res.json({
        leads,
        outputFile: filePath,
        logs: stdout.trim(),
      });
    } catch (err) {
      res.status(500).json({
        error: "Scrape finished but output file could not be read.",
        details: String(err),
        logs: stdout.trim(),
      });
    }
  });
});

app.post("/api/stop", (_req, res) => {
  if (!activeProcess) {
    res.json({ stopped: false, message: "No running scrape process." });
    return;
  }

  activeProcess.kill("SIGTERM");
  activeProcess = null;
  res.json({ stopped: true });
});

app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`);
});
