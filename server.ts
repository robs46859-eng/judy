/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ---------------------------------------------------------------------------
// File-based persistence — survives server restarts
// ---------------------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), "data");
try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}

function loadJson<T>(filename: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson(filename: string, data: unknown): void {
  try {
    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error(`[data] Failed to save ${filename}:`, e);
  }
}

// ---------------------------------------------------------------------------
// Email notifications
// ---------------------------------------------------------------------------
function getMailer(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth: { user, pass },
  });
}

async function sendAdminEmail(subject: string, html: string): Promise<void> {
  const mailer = getMailer();
  if (!mailer) {
    console.log(`[email] SMTP not configured — skipping: ${subject}`);
    return;
  }
  try {
    await mailer.sendMail({
      from: `"Judy's App" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL || "robcofamily@gmail.com",
      subject,
      html,
    });
    console.log(`[email] Sent: ${subject}`);
  } catch (e) {
    console.error("[email] Failed to send:", e);
  }
}

// ---------------------------------------------------------------------------
// Gemini client
// ---------------------------------------------------------------------------
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "dummy_key") return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiClient;
}

// ---------------------------------------------------------------------------
// Persistent in-memory collections — loaded from disk on start
// ---------------------------------------------------------------------------
let flightsData: any[]       = loadJson("flights.json",        []);
let safetyZones: any[]       = loadJson("safety-zones.json",   []);
let localGuides: any[]       = loadJson("guides.json",         []);
let chatMessages: any[]      = loadJson("chats.json",          []);
let memberPosts: any[]       = loadJson("social-feed.json",    []);
let itemsDatabase: any[]     = loadJson("marketplace.json",    []);
let userBookings: any[]      = loadJson("bookings.json",       []);
let userBucketList: any[]    = loadJson("bucket-list.json",    []);
let photoAlbumExports: any[] = loadJson("album-exports.json",  []);
let photoAlbumOrders: any[]  = loadJson("album-orders.json",   []);
let contactMessages: any[]   = loadJson("contacts.json",       []);

// ---------------------------------------------------------------------------
// Admin dashboard
// ---------------------------------------------------------------------------
function requireAdmin(req: express.Request, res: express.Response): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    res.status(503).send("Admin access not configured. Set the ADMIN_KEY environment variable.");
    return false;
  }
  const provided = (req.query.key as string) || req.headers["x-admin-key"];
  if (provided !== adminKey) {
    res.status(401).send(`
      <html><body style="font-family:monospace;padding:2rem;background:#0a0715;color:#c4b5fd">
        <h2>Judy Admin — Unauthorized</h2>
        <p>Append <code>?key=YOUR_ADMIN_KEY</code> to the URL.</p>
      </body></html>
    `);
    return false;
  }
  return true;
}

const esc = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

app.get("/admin/orders", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const ordersHtml = photoAlbumOrders.length === 0
    ? `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:2rem">No orders yet</td></tr>`
    : photoAlbumOrders.map((o: any) => `
        <tr>
          <td>${esc(o.id)}</td>
          <td>${esc(o.title)}</td>
          <td>${esc(o.recipient)}</td>
          <td style="max-width:200px;word-break:break-word">${esc(o.address)}</td>
          <td>${o.photoCount}</td>
          <td>$${Number(o.totalPrice).toFixed(2)}</td>
          <td>${esc(new Date(o.submittedAt).toLocaleString())}</td>
        </tr>`).join("");

  const contactsHtml = contactMessages.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:2rem">No messages yet</td></tr>`
    : contactMessages.map((m: any) => `
        <tr>
          <td>${esc(m.name)}</td>
          <td>${esc(m.email)}</td>
          <td>${esc(m.topic)}</td>
          <td style="max-width:300px;word-break:break-word">${esc(m.message)}</td>
          <td>${esc(new Date(m.receivedAt).toLocaleString())}</td>
        </tr>`).join("");

  const bookingsHtml = userBookings.length === 0
    ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:2rem">No bookings yet</td></tr>`
    : userBookings.map((b: any) => `
        <tr>
          <td>${esc(b.id)}</td>
          <td>${esc(b.itemTitle)}</td>
          <td>$${Number(b.totalPrice).toFixed(2)}</td>
          <td>${esc(b.bookingDate)}</td>
        </tr>`).join("");

  res.type("html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Judy Admin — Orders</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:system-ui,sans-serif;background:#06040c;color:#e2e8f0;padding:2rem}
    h1{font-size:1.6rem;color:#c084fc;margin-bottom:.25rem}
    .sub{color:#94a3b8;font-size:.8rem;margin-bottom:2rem}
    h2{font-size:1rem;color:#a78bfa;margin:2rem 0 .75rem;text-transform:uppercase;letter-spacing:.1em}
    table{width:100%;border-collapse:collapse;font-size:.8rem;background:#0f0b1f;border-radius:.75rem;overflow:hidden}
    th{background:#1e1635;color:#c4b5fd;padding:.6rem .85rem;text-align:left;font-weight:700;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase}
    td{padding:.6rem .85rem;border-top:1px solid #1e1635;vertical-align:top}
    tr:hover td{background:#140e28}
    .badge{display:inline-block;padding:.15rem .5rem;border-radius:.3rem;font-size:.65rem;font-weight:700;background:#312e81;color:#c7d2fe}
    .stat{display:inline-block;background:#1e1635;border:1px solid #312e81;border-radius:.5rem;padding:.6rem 1.2rem;margin-right:.75rem;margin-bottom:.75rem}
    .stat-n{font-size:1.5rem;font-weight:800;color:#c084fc}
    .stat-l{font-size:.65rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.1em}
    a{color:#a78bfa}
  </style>
</head>
<body>
  <h1>Judy's Admin Dashboard</h1>
  <p class="sub">Loaded at ${new Date().toLocaleString()} · <a href="?key=${esc(req.query.key)}">Refresh</a></p>

  <div>
    <div class="stat"><div class="stat-n">${photoAlbumOrders.length}</div><div class="stat-l">Print Orders</div></div>
    <div class="stat"><div class="stat-n">${contactMessages.length}</div><div class="stat-l">Contact Messages</div></div>
    <div class="stat"><div class="stat-n">${userBookings.length}</div><div class="stat-l">Marketplace Bookings</div></div>
    <div class="stat"><div class="stat-n">${safetyZones.length}</div><div class="stat-l">Safety Zones</div></div>
    <div class="stat"><div class="stat-n">${memberPosts.length}</div><div class="stat-l">Social Posts</div></div>
  </div>

  <h2>📦 Photo Album Print Orders</h2>
  <table>
    <thead><tr><th>Order ID</th><th>Album Title</th><th>Recipient</th><th>Address</th><th>Photos</th><th>Total</th><th>Date</th></tr></thead>
    <tbody>${ordersHtml}</tbody>
  </table>

  <h2>📬 Contact Form Messages</h2>
  <table>
    <thead><tr><th>Name</th><th>Email</th><th>Topic</th><th>Message</th><th>Received</th></tr></thead>
    <tbody>${contactsHtml}</tbody>
  </table>

  <h2>🛍️ Marketplace Bookings</h2>
  <table>
    <thead><tr><th>Booking ID</th><th>Item</th><th>Total</th><th>Date</th></tr></thead>
    <tbody>${bookingsHtml}</tbody>
  </table>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// API ENDPOINTS
// ---------------------------------------------------------------------------

app.get("/api/flights", (req, res) => {
  res.json(flightsData);
});

app.post("/api/gemini/translate", async (req, res) => {
  const { text, targetLanguage } = req.body;
  if (!text || !targetLanguage) return res.status(400).json({ error: "Missing text or targetLanguage" });

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      translatedText: `[Fallback Translation to ${targetLanguage}] "${text}" (Add your real Gemini API Key in Settings > Secrets to enable instant translation)`,
    });
  }

  try {
    const prompt = `Translate the following travel text exactly into target language '${targetLanguage}'. Provide only the translated text, preserving the tone. Ensure any gay-friendly subtext is translated beautifully and respectfully.\n\nText: "${text}"`;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert bilingual hotel, hospitality, and pride travel translator fluent in translating gay travel guidebooks, safety materials, and menus.",
      },
    });
    res.json({ translatedText: response.text?.trim() });
  } catch (error: any) {
    console.error("Gemini Translation Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/suggest-itinerary", async (req, res) => {
  const { destination, vibe, travelStyle, interests } = req.body;
  if (!destination) return res.status(400).json({ error: "Destination is required" });

  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      id: "it_fallback",
      destination,
      tagline: `Vibrant & Safe Curated Pride Escape to ${destination}`,
      summary: `Enjoy a classic 3-day itinerary centered on your choice of ${vibe} vibes and boutique interests like ${interests?.join(", ") || "culture, sights, and food"}. Please configure your real Gemini API Key in the UI Secrets panel to experience personalized, intelligent AI itineraries generated on the fly!`,
      days: [
        { id: "it_fb_1", day: 1, timeOfDay: "Morning", activity: "Wander through the historic Old Town & local queer landmarks", description: "Discover stunning iconic architecture and a friendly greeting of safety on local streets.", location: `${destination} Central Plaza`, costEstimate: "Free", gayFriendlyRating: 5, category: "sightseeing" },
        { id: "it_fb_2", day: 1, timeOfDay: "Afternoon", activity: "Welcome Brunch & Local Gallery Tour", description: "Stop by an inclusive, local LGBTQ+-owned artistic coffee bar that features unique installations.", location: "Balmes Street art district", costEstimate: "$15 - $25", gayFriendlyRating: 5, category: "restaurant" },
        { id: "it_fb_3", day: 1, timeOfDay: "Evening", activity: "Taste local organic wines and signature bites during Sunset", description: "Perfect sunset viewing deck recommended heavily by members on the social feed.", location: "Sunset Harbor Overlook", costEstimate: "$30", gayFriendlyRating: 4, category: "experience" },
        { id: "it_fb_4", day: 1, timeOfDay: "Night", activity: "Dynamic Cocktails & Cultural Dance hub", description: "Dive into a lively local club rated highly in our community safety map. Secure entry and bilingual staff.", location: "The Neon Oasis Club", costEstimate: "$20", gayFriendlyRating: 5, category: "nightlife" },
      ],
    });
  }

  try {
    const prompt = `Create an incredible, safe, and highly personalized travel itinerary for gay men visiting "${destination}". Take into account:
- Vibe: "${vibe}" (focus heavily on this)
- travelStyle: "${travelStyle}"
- Interests: "${interests ? interests.join(", ") : "culture, dining, historic milestones"}"

Make sure it contains highly specific places, gay-friendly hotspots, safe neighborhoods, and is structured for 2 days with 3 actions per day.
Return exclusively a VALID JSON object adhering strictly to the structured response schema. No commentary outside the JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are Judy's elite AI Travel Butler. You customize gorgeous travel itineraries for gay/queer men, detailing rich, real locations, rating gay-friendliness from 1 to 5, listing cost estimates, and giving comprehensive descriptions for reassurance and extreme safety.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["id", "destination", "tagline", "summary", "days"],
          properties: {
            id: { type: Type.STRING },
            destination: { type: Type.STRING },
            tagline: { type: Type.STRING },
            summary: { type: Type.STRING },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["id", "day", "timeOfDay", "activity", "description", "location", "costEstimate", "gayFriendlyRating", "category"],
                properties: {
                  id: { type: Type.STRING },
                  day: { type: Type.INTEGER },
                  timeOfDay: { type: Type.STRING },
                  activity: { type: Type.STRING },
                  description: { type: Type.STRING },
                  location: { type: Type.STRING },
                  costEstimate: { type: Type.STRING },
                  gayFriendlyRating: { type: Type.INTEGER },
                  category: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini Itinerary Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/safety-map", (req, res) => res.json(safetyZones));

app.post("/api/safety-map", (req, res) => {
  const { title, address, category, coords, tags } = req.body;
  if (!title || !address || !category) return res.status(400).json({ error: "Missing parameters" });

  const newZone = {
    id: `z${Date.now()}`,
    title, address,
    coords: coords || { x: Math.floor(Math.random() * 80) + 10, y: Math.floor(Math.random() * 80) + 10 },
    category,
    safetyScore: 9.0,
    crowdLevel: "Moderate" as const,
    verificationCount: 1,
    tags: tags || ["Verified Safe", "Community Recommended"],
    reviews: [{
      id: `r_new_${Date.now()}`,
      user: "Community Member",
      avatar: "",
      text: "Community-verified safe spot.",
      date: new Date().toISOString().split("T")[0],
      isVerified: true,
      rating: 5,
    }],
  };

  safetyZones.unshift(newZone);
  saveJson("safety-zones.json", safetyZones);
  res.json(newZone);
});

app.post("/api/safety-map/:id/verify", (req, res) => {
  const zone = safetyZones.find((z) => z.id === req.params.id);
  if (zone) {
    zone.verificationCount += 1;
    zone.safetyScore = parseFloat(Math.min(10, zone.safetyScore + 0.1).toFixed(1));
    saveJson("safety-zones.json", safetyZones);
    return res.json(zone);
  }
  res.status(404).json({ error: "Zone not found" });
});

app.post("/api/safety-map/:id/review", (req, res) => {
  const { user, text, rating } = req.body;
  const zone = safetyZones.find((z) => z.id === req.params.id);
  if (zone && text) {
    const newRev = {
      id: `r_user_${Date.now()}`,
      user: user || "Anonymous",
      avatar: "",
      text,
      date: new Date().toISOString().split("T")[0],
      isVerified: true,
      rating: rating || 5,
    };
    zone.reviews.push(newRev);
    zone.safetyScore = parseFloat(((zone.safetyScore * 4 + rating) / 5).toFixed(1));
    saveJson("safety-zones.json", safetyZones);
    return res.json(zone);
  }
  res.status(404).json({ error: "Zone not found or missing text" });
});

app.get("/api/guides", (req, res) => res.json(localGuides));

app.get("/api/chats", (req, res) => res.json(chatMessages));

app.post("/api/chats", (req, res) => {
  const { text, receiverId } = req.body;
  if (!text || !receiverId) return res.status(400).json({ error: "Missing text or receiverId" });

  const newMsg = {
    id: `m${Date.now()}`,
    senderId: "user",
    receiverId,
    text,
    timestamp: new Date().toISOString(),
  };

  chatMessages.push(newMsg);
  saveJson("chats.json", chatMessages);
  res.json(newMsg);
});

app.get("/api/social-feed", (req, res) => res.json(memberPosts));

app.post("/api/social-feed", (req, res) => {
  const { caption, imageUrl, locationsRecommended, authorName } = req.body;
  if (!caption || !imageUrl) return res.status(400).json({ error: "Caption and dynamic image required" });

  const newPost = {
    id: `p${Date.now()}`,
    author: { name: authorName || "Anonymous", avatar: "", location: "Verified Member Route", verified: true },
    imageUrl, caption,
    likesCount: 1,
    commentsCount: 0,
    hasLiked: true,
    locationsRecommended: locationsRecommended || [],
    date: "Today",
  };

  memberPosts.unshift(newPost);
  saveJson("social-feed.json", memberPosts);
  res.json(newPost);
});

app.post("/api/social-feed/:id/like", (req, res) => {
  const post = memberPosts.find((p) => p.id === req.params.id);
  if (post) {
    if (post.hasLiked) { post.likesCount -= 1; post.hasLiked = false; }
    else { post.likesCount += 1; post.hasLiked = true; }
    saveJson("social-feed.json", memberPosts);
    return res.json(post);
  }
  res.status(404).json({ error: "Post not found" });
});

app.get("/api/marketplace/items", (req, res) => res.json(itemsDatabase));

app.get("/api/marketplace/bookings", (req, res) => res.json(userBookings));

app.post("/api/marketplace/bookings", (req, res) => {
  const { itemId, photoUploaded, isPhysicalPostcard, postalRecipient, postalStreet, postalCityZip, postalCountry, postalMessage } = req.body;
  const item = itemsDatabase.find((dbItem) => dbItem.id === itemId);
  if (!item) return res.status(404).json({ error: "Item not found" });

  const finalPrice = isPhysicalPostcard ? (item.price + 4.99) : item.price;
  const dispatchSuffix = isPhysicalPostcard ? ` (Physical Postcard to ${postalRecipient || "Recipient"})` : "";

  const newBooking = {
    id: `book_${Date.now()}`,
    itemTitle: `${item.title}${dispatchSuffix}`,
    totalPrice: finalPrice,
    bookingDate: new Date().toISOString().split("T")[0],
    status: "Confirmed" as const,
    photoUploaded: photoUploaded || undefined,
    isPhysical: isPhysicalPostcard || false,
    addressDetails: isPhysicalPostcard ? { recipient: postalRecipient, street: postalStreet, cityZip: postalCityZip, country: postalCountry, message: postalMessage } : undefined,
  };

  userBookings.unshift(newBooking);
  saveJson("bookings.json", userBookings);
  res.json(newBooking);
});

app.get("/api/bucket-list", (req, res) => res.json(userBucketList));

app.post("/api/bucket-list", (req, res) => {
  const { title, destination } = req.body;
  if (!title) return res.status(400).json({ error: "Missing bucket list title" });

  const newItem = { id: `bl${Date.now()}`, title, destination: destination || "Global", completed: false };
  userBucketList.unshift(newItem);
  saveJson("bucket-list.json", userBucketList);
  res.json(newItem);
});

app.post("/api/bucket-list/:id/toggle", (req, res) => {
  const item = userBucketList.find((bl) => bl.id === req.params.id);
  if (item) {
    item.completed = !item.completed;
    saveJson("bucket-list.json", userBucketList);
    return res.json(item);
  }
  res.status(404).json({ error: "Item not found" });
});

app.delete("/api/bucket-list/:id", (req, res) => {
  const index = userBucketList.findIndex((bl) => bl.id === req.params.id);
  if (index !== -1) {
    userBucketList.splice(index, 1);
    saveJson("bucket-list.json", userBucketList);
    return res.json({ success: true });
  }
  res.status(404).json({ error: "Item not found" });
});

app.post("/api/contact", (req, res) => {
  const { name, email, topic, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "Name, email, and message are required" });

  const entry = { id: `cm_${Date.now()}`, name, email, topic: topic || "General", message, receivedAt: new Date().toISOString() };
  contactMessages.unshift(entry);
  saveJson("contacts.json", contactMessages);
  console.log(`[contact] New message from ${name} <${email}> — ${topic}`);

  sendAdminEmail(
    `📬 New Contact Message — ${topic || "General"}`,
    `<h2>New Contact Form Submission</h2>
     <p><strong>Name:</strong> ${esc(name)}</p>
     <p><strong>Email:</strong> ${esc(email)}</p>
     <p><strong>Topic:</strong> ${esc(topic)}</p>
     <p><strong>Message:</strong></p>
     <blockquote style="border-left:3px solid #7c3aed;padding-left:1rem;color:#374151">${esc(message)}</blockquote>
     <p style="color:#6b7280;font-size:.85rem">Received: ${entry.receivedAt}</p>`
  );

  res.json({ success: true, id: entry.id });
});

app.get("/api/contact", (req, res) => res.json(contactMessages));

app.post("/api/photo-albums/digital", (req, res) => {
  const { title, subtitle, creatorName, themeName, photos } = req.body;
  if (!title || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: "Album title and at least one uploaded photo are required" });
  }

  const entry = {
    id: `album_${Date.now()}`,
    title, subtitle: subtitle || "", creatorName: creatorName || "",
    themeName: themeName || "Custom", photos,
    createdAt: new Date().toISOString(),
  };

  photoAlbumExports.unshift(entry);
  saveJson("album-exports.json", photoAlbumExports);
  res.json({ success: true, id: entry.id, downloadUrl: `/api/photo-albums/${entry.id}/export.html`, message: "Digital album compiled." });
});

app.get("/api/photo-albums/:id/export.html", (req, res) => {
  const album = photoAlbumExports.find((entry) => entry.id === req.params.id);
  if (!album) return res.status(404).send("Album not found");

  const pages = album.photos.map((photo: any, index: number) => `
    <section class="page">
      <p class="kicker">Page ${index + 1}${photo.location ? ` · ${esc(photo.location)}` : ""}</p>
      <img src="${photo.url}" alt="${esc(photo.title || `Album photo ${index + 1}`)}" />
      <h2>${esc(photo.title || `Photo ${index + 1}`)}</h2>
      <p>${esc(photo.caption || "")}</p>
    </section>`).join("");

  res.type("html").send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${esc(album.title)}</title>
    <style>
      body { margin: 0; font-family: Georgia, serif; color: #241231; background: #faf7f2; }
      .cover, .page { min-height: 100vh; box-sizing: border-box; padding: 8vh 9vw; break-after: page; }
      .cover { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      h1 { font-size: clamp(42px, 8vw, 96px); margin: 0; }
      h2 { font-size: 32px; margin: 28px 0 8px; }
      .kicker { text-transform: uppercase; letter-spacing: .18em; font: 700 11px system-ui, sans-serif; color: #6d28d9; }
      img { width: 100%; max-height: 68vh; object-fit: contain; border: 1px solid #dfd7ca; background: #fff; }
      p { font-size: 18px; line-height: 1.55; }
      @media print { .cover, .page { min-height: 100vh; } }
    </style>
  </head>
  <body>
    <section class="cover">
      <p class="kicker">${esc(album.themeName)} Album</p>
      <h1>${esc(album.title)}</h1>
      <p>${esc(album.subtitle)}</p>
      <p class="kicker">${album.creatorName ? `Curated by ${esc(album.creatorName)}` : ""}</p>
    </section>
    ${pages}
  </body>
</html>`);
});

app.post("/api/photo-albums/physical-orders", async (req, res) => {
  const { title, recipient, address, photos } = req.body;
  if (!title || !recipient || !address || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: "Album title, recipient, address, and at least one uploaded photo are required" });
  }

  const order = {
    id: `album_order_${Date.now()}`,
    title, recipient, address,
    photoCount: photos.length,
    totalPrice: 34.95,
    status: "Print Queue Received",
    submittedAt: new Date().toISOString(),
  };

  photoAlbumOrders.unshift(order);
  saveJson("album-orders.json", photoAlbumOrders);

  // Notify admin
  sendAdminEmail(
    `📦 New Print Order — "${esc(title)}"`,
    `<h2>New Photo Album Print Order</h2>
     <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:.9rem">
       <tr><th style="text-align:left;padding:.4rem .8rem;background:#f3f4f6">Order ID</th><td style="padding:.4rem .8rem">${esc(order.id)}</td></tr>
       <tr><th style="text-align:left;padding:.4rem .8rem;background:#f3f4f6">Album Title</th><td style="padding:.4rem .8rem">${esc(title)}</td></tr>
       <tr><th style="text-align:left;padding:.4rem .8rem;background:#f3f4f6">Recipient</th><td style="padding:.4rem .8rem">${esc(recipient)}</td></tr>
       <tr><th style="text-align:left;padding:.4rem .8rem;background:#f3f4f6">Address</th><td style="padding:.4rem .8rem">${esc(address)}</td></tr>
       <tr><th style="text-align:left;padding:.4rem .8rem;background:#f3f4f6">Photos</th><td style="padding:.4rem .8rem">${photos.length}</td></tr>
       <tr><th style="text-align:left;padding:.4rem .8rem;background:#f3f4f6">Total</th><td style="padding:.4rem .8rem">$${order.totalPrice.toFixed(2)}</td></tr>
       <tr><th style="text-align:left;padding:.4rem .8rem;background:#f3f4f6">Submitted</th><td style="padding:.4rem .8rem">${order.submittedAt}</td></tr>
     </table>
     <p style="margin-top:1rem;color:#6b7280;font-size:.85rem">View all orders at <strong>/admin/orders?key=YOUR_ADMIN_KEY</strong></p>`
  );

  res.json({ success: true, order });
});

app.get("/api/photo-albums/physical-orders", (req, res) => res.json(photoAlbumOrders));

// Queer-friendly local recommendations via Gemini
app.get("/api/recommendations", async (req, res) => {
  const destination = String(req.query.destination || "").trim();
  if (!destination) return res.status(400).json({ error: "Missing destination" });

  const ai = getGeminiClient();
  if (!ai) return res.json({ spots: [] });

  try {
    const prompt = `You are a queer travel expert. Return a JSON array of exactly 4 real, currently operating queer-friendly spots in "${destination}": 2 food spots (restaurants/cafés) and 2 drink spots (bars/cocktail lounges). Each object must have these exact fields:
- id: short unique string
- name: real place name (no generic placeholders)
- category: "food" or "drinks"
- x: integer 10–90 (map position)
- y: integer 10–90 (map position, different for each)
- desc: one sentence about why it is welcoming to LGBTQ+ travelers
- neighborhood: real neighborhood name in that city
- safetyVibe: short inclusive phrase (e.g. "Safe Haven", "Rainbow Certified")
- rating: 4 or 5

Return only the raw JSON array, no markdown, no explanation.`;

    const response = await ai.models.generateContent({ model: "gemini-2.0-flash", contents: prompt });
    const text = response.text ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return res.json({ spots: [] });
    res.json({ spots: JSON.parse(match[0]) });
  } catch {
    res.json({ spots: [] });
  }
});

// ---------------------------------------------------------------------------
// Static / SPA
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV !== "production") {
  (async () => {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  })();
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Judy's Express Server running on http://0.0.0.0:${PORT}`);
});
