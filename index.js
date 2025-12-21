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


const CAREERS_ONLY_REFUSAL = `I can't help with that — I'm the **University of Bradford Careers Advisor Bot**.

I can help with:
• careers and job pathways
• degree programmes
• placements & internships
• scholarships & funding
• CV and LinkedIn support`;

/* -----------------------------
   Multi-Source Web Search
------------------------------ */
async function searchBradfordInfo(topic) {
  try {
    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    
    if (!apiKey || !cx) {
      console.error("Missing Google CSE credentials");
      return null;
    }

    const q = `site:bradford.ac.uk ${topic}`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&num=3`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("Google CSE API error:", res.status);
      return null;
    }

    const data = await res.json();
    const items = data.items || [];
    
    if (!items.length) return null;

    return items.slice(0, 3).map(item => `• ${item.title}\n  ${item.link}`).join("\n");
  } catch (error) {
    console.error("Bradford search error:", error.message);
    return null;
  }
}

async function searchCareerInfo(topic) {
  try {
    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    
    if (!apiKey || !cx) return null;

    const q = `site:prospects.ac.uk OR site:nationalcareers.service.gov.uk ${topic} careers salary jobs`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&num=3`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const items = data.items || [];
    
    if (!items.length) return null;

    return items.slice(0, 3).map(item => `• ${item.title}\n  ${item.link}`).join("\n");
  } catch (error) {
    console.error("Career search error:", error.message);
    return null;
  }
}

async function searchGovStatistics(topic) {
  try {
    const apiKey = process.env.GOOGLE_CSE_API_KEY;
    const cx = process.env.GOOGLE_CSE_CX;
    
    if (!apiKey || !cx) return null;

    const q = `site:gov.uk ${topic} statistics employment graduate outcomes`;
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&num=2`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    const items = data.items || [];
    
    if (!items.length) return null;

    return items.slice(0, 2).map(item => `• ${item.title}\n  ${item.link}`).join("\n");
  } catch (error) {
    console.error("Gov search error:", error.message);
    return null;
  }
}

/* -----------------------------
   Firestore queries
------------------------------ */
async function searchProgrammes(query) {
  try {
    const snapshot = await db.collection("programmes").get();
    const programmes = snapshot.docs.map(d => d.data());
    
    const results = programmes.filter(p => 
      p.name?.toLowerCase().includes(query.toLowerCase()) ||
      p.category?.toLowerCase().includes(query.toLowerCase())
    );
    
    return results.slice(0, 5);
  } catch (err) {
    console.error("Firestore error:", err);
    return [];
  }
}

async function getLinksForUserGroup(userGroup, category = null) {
  try {
    const snap = await db.collection("useful_links").get();
    let links = snap.docs.map(d => d.data());

    links = links.filter(l =>
      l.audience?.includes(userGroup) || l.audience?.includes("all")
    );

    if (category) {
      links = links.filter(l => l.category === category);
    }

    return links.slice(0, 5);
  } catch (err) {
    console.error("Firestore error:", err);
    return [];
  }
}

/* -----------------------------
   AI-Powered Responses
------------------------------ */
async function getContextualResponse(session, userQuery) {
  try {
    const context = session.context;
    const systemPrompt = `You are the University of Bradford Careers Advisor Bot. 
    
User profile:
- User type: ${context.userGroup || "unknown"}
- Programme: ${context.programme || context.subject || "not specified"}
- Current focus: ${context.focus || context.support || context.goal || "general careers help"}

Provide a helpful, specific response about: ${userQuery}

Keep responses concise (2-3 paragraphs), actionable, and focused on practical career advice.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery }
      ],
      max_tokens: 350,
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.error("OpenAI error:", err);
    return null;
  }
}

/* -----------------------------
   Options Menu
------------------------------ */
function getOptionsMenu(session) {
  const baseOptions = `

**💡 What else would you like to know?**

**Quick options:**
• "Career prospects for [any subject]"
• "What jobs can I get with [degree]?"
• "Salary for [career/subject]"
• "Entry requirements for [course]"
• "Help me find placements"
• "Review my CV"
• "What scholarships are available?"

**Or ask me anything about careers, courses, or employment!**`;

  return baseOptions;
}

/* -----------------------------
   Intro message
------------------------------ */
function introMessage() {
  return `Hello — I'm the **University of Bradford Careers Advisor Bot**.

I can help with careers, placements, CV & LinkedIn support, scholarships, and course-to-career guidance.

To personalise this for you, please tell me which best describes you:

• Prospective student  
• Current student  
• Graduate / Alumni`;
}

/* -----------------------------
   Structured Flow Logic
------------------------------ */
async function handleStructuredFlow(session, message) {
  const t = normalize(message);
