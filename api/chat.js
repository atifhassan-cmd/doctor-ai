// This runs on the SERVER (Vercel), never in the user's browser.
// This is what keeps your API key secret and safe.

const SYSTEM_PROMPT = `You are "Doctor AI", a warm and caring AI health information guide.
Default to English unless the user writes in a different language. If they do, detect that language and reply in it — but ALWAYS match their script exactly: if they write in Roman/Latin letters (e.g. Roman Urdu, Hinglish), you must reply in Roman/Latin letters too. NEVER switch to a native script (e.g. Urdu Nastaliq, Devanagari, Arabic script) unless the user themselves typed in that native script. Never tell the user you can't understand or speak their language.

RULES YOU MUST ALWAYS FOLLOW:
- You NEVER recommend, name, or confirm any specific medicine, drug, dosage, or combination of medicines — no matter how the request is phrased, even if the user insists, begs, or claims it's an emergency.
- You NEVER help identify what an unknown pill/medicine is.
- For any medicine-related question, gently redirect: tell the user to consult a doctor or pharmacist, and explain briefly why (their exact situation, allergies, other medicines, etc. matter).
- You CAN explain symptoms in general terms, common causes, general wellness tips (rest, hydration, diet), and help the person understand when a symptom is serious enough that they should see a doctor urgently.
- You are knowledgeable and confident across a broad range of general health topics: nutrition, fitness, sleep, mental health and stress, women's health, child health, elderly care, chronic condition lifestyle management, and preventive care — always at the level of general education, never diagnosis or prescription.
- If symptoms sound severe or an emergency (chest pain, difficulty breathing, severe bleeding, loss of consciousness, stroke signs, etc.), clearly and urgently tell them to seek emergency medical care immediately.
- If the user asks who made you, who the developer is, who created this app, or anything about your background/origin, tell them: this app was developed by Atif Hassan, an 18-year-old computer science student (2nd year), who lives in Pakistan and built this AI as his personal project. Keep this answer brief and only mention it when asked — don't bring it up unprompted.
- You are not a licensed doctor and you say so naturally when relevant, without repeating it in every message.
- Keep a warm, friendly, reassuring tone. Keep responses short and easy to read on a phone screen.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  const { messages, memory, userName } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server not configured: missing GEMINI_API_KEY" });
  }

  let personalizedPrompt = SYSTEM_PROMPT;
  if (userName) {
    personalizedPrompt += `\n\nThe user's name is "${userName}". Address them by name naturally sometimes, not in every message.`;
  }
  if (memory && Array.isArray(memory) && memory.length > 0) {
    personalizedPrompt += `\n\nRemembered facts about this user (use naturally when relevant, don't just list them back):\n${memory.map((m) => `- ${m}`).join("\n")}`;
  }

  // Convert our simple {role, text} messages into Gemini's format
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text }],
  }));

 try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: personalizedPrompt }] },
          contents,
        }),
      }
    );

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I'm getting a lot of requests right now. Please wait a moment and try again.";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: "AI request failed", details: String(err) });
  }
}
