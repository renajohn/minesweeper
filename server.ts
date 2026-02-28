import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || join(import.meta.dir, "data");
const SCORES_FILE = join(DATA_DIR, "scores.json");
const MAX_PER_DIFFICULTY = 50;
const VALID_DIFFICULTIES = ["easy", "medium", "hard"] as const;

type Difficulty = (typeof VALID_DIFFICULTIES)[number];

interface Score {
  name: string;
  difficulty: Difficulty;
  time: number;
  date: string;
}

type ScoresData = Record<Difficulty, Score[]>;

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadScores(): ScoresData {
  ensureDataDir();
  if (!existsSync(SCORES_FILE)) {
    return { easy: [], medium: [], hard: [] };
  }
  try {
    return JSON.parse(readFileSync(SCORES_FILE, "utf-8"));
  } catch {
    return { easy: [], medium: [], hard: [] };
  }
}

function saveScores(data: ScoresData) {
  ensureDataDir();
  writeFileSync(SCORES_FILE, JSON.stringify(data, null, 2));
}

function getTop10(data: ScoresData): ScoresData {
  return {
    easy: data.easy.slice(0, 10),
    medium: data.medium.slice(0, 10),
    hard: data.hard.slice(0, 10),
  };
}

const HTML_PATH = join(import.meta.dir, "index.html");
const htmlContent = readFileSync(HTML_PATH, "utf-8");
const FAVICON_PATH = join(import.meta.dir, "favicon.svg");
const faviconContent = readFileSync(FAVICON_PATH, "utf-8");

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Serve index.html
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(htmlContent, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Serve favicon
    if (url.pathname === "/favicon.svg" || url.pathname === "/favicon.ico") {
      return new Response(faviconContent, {
        headers: { "Content-Type": "image/svg+xml" },
      });
    }

    // GET scores
    if (url.pathname === "/api/scores" && req.method === "GET") {
      const scores = loadScores();
      return Response.json(getTop10(scores));
    }

    // POST score
    if (url.pathname === "/api/scores" && req.method === "POST") {
      let body: unknown;
      try {
        body = await req.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }

      const { name, difficulty, time } = body as Record<string, unknown>;

      // Validate name
      if (
        typeof name !== "string" ||
        name.trim().length < 3 ||
        name.trim().length > 20
      ) {
        return Response.json(
          { error: "Name must be 3-20 characters" },
          { status: 400 }
        );
      }

      // Validate difficulty
      if (!VALID_DIFFICULTIES.includes(difficulty as Difficulty)) {
        return Response.json(
          { error: "Difficulty must be easy, medium, or hard" },
          { status: 400 }
        );
      }

      // Validate time
      if (typeof time !== "number" || time <= 0 || !Number.isFinite(time)) {
        return Response.json(
          { error: "Time must be a positive number" },
          { status: 400 }
        );
      }

      const diff = difficulty as Difficulty;
      const scores = loadScores();

      scores[diff].push({
        name: name.trim(),
        difficulty: diff,
        time,
        date: new Date().toISOString(),
      });

      // Sort by time ascending, keep top N
      scores[diff].sort((a, b) => a.time - b.time);
      scores[diff] = scores[diff].slice(0, MAX_PER_DIFFICULTY);

      saveScores(scores);

      return Response.json({ ok: true, scores: getTop10(scores) });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Minesweeper server running on http://localhost:${server.port}`);
