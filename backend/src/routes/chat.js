const express = require("express");
const router = express.Router();

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = process.env.GROQ_MODEL || "mixtral-8x7b-32768";

// POST /api/chat
router.post("/", async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  const { message, dealerName, inventory, selectedCar, chatHistory, language } = req.body;

  if (!message) {
    return res.status(400).json({ error: "message required" });
  }

  // Build system prompt with dealer context
  const systemPrompt = `You are a friendly, professional car sales assistant for "${dealerName || "AutoHouse"}". 
You help customers find the right vehicle from the dealership's inventory.

RULES:
- Be helpful, concise, and enthusiastic about cars
- Always reference actual vehicles from the inventory when possible
- If asked about price, filter inventory by budget
- If asked about a specific make/model, find matches in inventory
- Suggest test drives when appropriate
- Respond in the same language the customer uses (Serbian, English, or German)
- Keep responses short (2-4 sentences max) unless listing vehicles
- Use € for prices
- Format car listings as: **Make Model** (Year) — €Price, Mileage km
${language ? `- Preferred language: ${language}` : ""}

CURRENT INVENTORY (available vehicles):
${inventory || "No inventory data available"}

${selectedCar ? `CURRENTLY SELECTED VEHICLE: ${selectedCar.make} ${selectedCar.model} — €${selectedCar.price}` : ""}`;

  // Build messages array
  const messages = [
    { role: "system", content: systemPrompt }
  ];

  // Add chat history (last 10 messages)
  if (chatHistory && Array.isArray(chatHistory)) {
    for (const msg of chatHistory.slice(-10)) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.text
      });
    }
  }

  // Add current message
  messages.push({ role: "user", content: message });

  try {
    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 500,
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Groq API error:", response.status, err);
      return res.status(502).json({ error: "AI service error", details: response.status });
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    res.json({ text: aiText });
  } catch (e) {
    console.error("Groq request failed:", e.message);
    res.status(502).json({ error: "Failed to reach AI service" });
  }
});

module.exports = router;
