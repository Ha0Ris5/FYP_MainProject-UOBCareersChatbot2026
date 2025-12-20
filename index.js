import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import { Firestore } from "@google-cloud/firestore";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;

/* -----------------------------
   OpenAI
------------------------------ */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* -----------------------------
   Firestore
------------------------------ */
const serviceAccount = JSON.parse(
  fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8")
);

const db = new Firestore({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
});

/* -----------------------------
   Session Memory
------------------------------ */
const sessions = new Map();

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, {
      stage: "INTRO",
      context: {},
      lastPrompt: null,
      conversationHistory: [],
    });
  }
  return sessions.get(id);
}

/* -----------------------------
   Utilities
------------------------------ */
const normalize = (s = "") => s.toLowerCase().trim();

function matchesAny(input, keywords) {
  const t = normalize(input);
  return keywords.some(k => t.includes(k));
}

function isInvalidInput(input) {
  const t = normalize(input);
  return t.length < 2 || /^[a-z]$/.test(t);
}

function extractSubjectFromQuery(query) {
  const subjects = [
    "computer science", "comp sci", "computing", "cs",
    "engineering", "mechanical", "civil", "electrical",
    "business", "accounting", "finance", "economics",
    "law", "legal",
    "medicine", "nursing", "health", "medical",
    "mathematics", "maths", "math", "physics",
    "psychology", "sociology", "social work",
    "chemistry", "biology", "biomedical"
  ];
  
  const normalized = normalize(query);
  for (const subject of subjects) {
    if (normalized.includes(subject)) {
      return subject;
    }
  }
  return null;
}

const CAREERS_ONLY_REFUSAL = `I can't help with that — I'm the **University of Bradford Careers Advisor Bot**.

I can help with:
• careers and job pathways
• degree programmes
• placements & internships
• scholarships & funding
• CV and LinkedIn support`;

