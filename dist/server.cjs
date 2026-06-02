var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = parseInt(process.env.PORT || "3000", 10);
app.use(import_express.default.json({ limit: "15mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "15mb" }));
var aiClient = null;
function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "dummy_key") {
    return null;
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var flightsData = [];
var safetyZones = [];
var localGuides = [];
var chatMessages = [];
var memberPosts = [];
var itemsDatabase = [];
var userBookings = [];
var userBucketList = [];
var photoAlbumExports = [];
var photoAlbumOrders = [];
app.get("/api/flights", (req, res) => {
  res.json(flightsData);
});
app.post("/api/gemini/translate", async (req, res) => {
  const { text, targetLanguage } = req.body;
  if (!text || !targetLanguage) {
    return res.status(400).json({ error: "Missing text or targetLanguage" });
  }
  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      translatedText: `[Fallback Translation to ${targetLanguage}] "${text}" (Add your real Gemini API Key in Settings > Secrets to enable instant translation)`
    });
  }
  try {
    const prompt = `Translate the following travel text exactly into target language '${targetLanguage}'. Provide only the translated text, preserving the tone. Ensure any gay-friendly subtext is translated beautifully and respectfully.

Text: "${text}"`;
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert bilingual hotel, hospitality, and pride travel translator fluent in translating gay travel guidebooks, safety materials, and menus."
      }
    });
    res.json({ translatedText: response.text?.trim() });
  } catch (error) {
    console.error("Gemini Translation Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.post("/api/gemini/suggest-itinerary", async (req, res) => {
  const { destination, vibe, travelStyle, interests } = req.body;
  if (!destination) {
    return res.status(400).json({ error: "Destination is required" });
  }
  const ai = getGeminiClient();
  if (!ai) {
    return res.json({
      id: "it_fallback",
      destination,
      tagline: `Vibrant & Safe Curated Pride Escape to ${destination}`,
      summary: `Enjoy a classic 3-day itinerary centered on your choice of ${vibe} vibes and boutique interests like ${interests?.join(", ") || "culture, sights, and food"}. Please configure your real Gemini API Key in the UI Secrets panel to experience personalized, intelligent AI itineraries generated on the fly!`,
      days: [
        {
          id: "it_fb_1",
          day: 1,
          timeOfDay: "Morning",
          activity: "Wander through the historic Old Town & local queer landmarks",
          description: "Discover stunning iconic architecture and a friendly greeting of safety on local streets. Check out local welcoming guideposts.",
          location: `${destination} Central Plaza`,
          costEstimate: "Free",
          gayFriendlyRating: 5,
          category: "sightseeing"
        },
        {
          id: "it_fb_2",
          day: 1,
          timeOfDay: "Afternoon",
          activity: "Welcome Brunch & Local Gallery Tour",
          description: "Stop by an inclusive, local LGBTQ+-owned artistic coffee bar that features unique installations.",
          location: "Balmes Street art district",
          costEstimate: "$15 - $25",
          gayFriendlyRating: 5,
          category: "restaurant"
        },
        {
          id: "it_fb_3",
          day: 1,
          timeOfDay: "Evening",
          activity: "Taste local organic wines and signature bites duringSunset",
          description: "Perfect sunset viewing deck recommended heavily by members on the social feed.",
          location: "Sunset Harbor Overlook",
          costEstimate: "$30",
          gayFriendlyRating: 4,
          category: "experience"
        },
        {
          id: "it_fb_4",
          day: 1,
          timeOfDay: "Night",
          activity: "Dynamic Cocktails & Cultural Dance hub",
          description: "Dive into a lively local club rated highly in our community safety map. Secure entry and bilingual staff.",
          location: "The Neon Oasis Club",
          costEstimate: "$20",
          gayFriendlyRating: 5,
          category: "nightlife"
        }
      ]
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
          type: import_genai.Type.OBJECT,
          required: ["id", "destination", "tagline", "summary", "days"],
          properties: {
            id: { type: import_genai.Type.STRING },
            destination: { type: import_genai.Type.STRING },
            tagline: { type: import_genai.Type.STRING },
            summary: { type: import_genai.Type.STRING },
            days: {
              type: import_genai.Type.ARRAY,
              items: {
                type: import_genai.Type.OBJECT,
                required: ["id", "day", "timeOfDay", "activity", "description", "location", "costEstimate", "gayFriendlyRating", "category"],
                properties: {
                  id: { type: import_genai.Type.STRING },
                  day: { type: import_genai.Type.INTEGER },
                  timeOfDay: { type: import_genai.Type.STRING },
                  // 'Morning' | 'Afternoon' | 'Evening' | 'Night'
                  activity: { type: import_genai.Type.STRING },
                  description: { type: import_genai.Type.STRING },
                  location: { type: import_genai.Type.STRING },
                  costEstimate: { type: import_genai.Type.STRING },
                  gayFriendlyRating: { type: import_genai.Type.INTEGER },
                  category: { type: import_genai.Type.STRING }
                  // 'restaurant' | 'nightlife' | 'sightseeing' | 'experience' | 'relaxation'
                }
              }
            }
          }
        }
      }
    });
    const parsed = JSON.parse(response.text?.trim() || "{}");
    res.json(parsed);
  } catch (error) {
    console.error("Gemini Itinerary Error:", error);
    res.status(500).json({ error: error.message });
  }
});
app.get("/api/safety-map", (req, res) => {
  res.json(safetyZones);
});
app.post("/api/safety-map", (req, res) => {
  const { title, address, category, coords, tags, testReview } = req.body;
  if (!title || !address || !category) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const newZone = {
    id: `z${Date.now()}`,
    title,
    address,
    coords: coords || { x: Math.floor(Math.random() * 80) + 10, y: Math.floor(Math.random() * 80) + 10 },
    category,
    safetyScore: 9,
    crowdLevel: "Moderate",
    verificationCount: 1,
    tags: tags || ["Verified Safe", "Community Recommended"],
    reviews: [
      {
        id: `r_new_${Date.now()}`,
        user: "Community Member",
        avatar: "",
        text: testReview || "Community-verified safe spot.",
        date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        isVerified: true,
        rating: 5
      }
    ]
  };
  safetyZones.unshift(newZone);
  res.json(newZone);
});
app.post("/api/safety-map/:id/verify", (req, res) => {
  const zone = safetyZones.find((z) => z.id === req.params.id);
  if (zone) {
    zone.verificationCount += 1;
    zone.safetyScore = parseFloat(Math.min(10, zone.safetyScore + 0.1).toFixed(1));
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
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      isVerified: true,
      rating: rating || 5
    };
    zone.reviews.push(newRev);
    zone.safetyScore = parseFloat(((zone.safetyScore * 4 + rating) / 5).toFixed(1));
    return res.json(zone);
  }
  res.status(404).json({ error: "Zone not found or missing text" });
});
app.get("/api/guides", (req, res) => {
  res.json(localGuides);
});
app.get("/api/chats", (req, res) => {
  res.json(chatMessages);
});
app.post("/api/chats", (req, res) => {
  const { text, receiverId } = req.body;
  if (!text || !receiverId) {
    return res.status(400).json({ error: "Missing text or receiverId" });
  }
  const newMsg = {
    id: `m${Date.now()}`,
    senderId: "user",
    receiverId,
    text,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  chatMessages.push(newMsg);
  res.json(newMsg);
});
app.get("/api/social-feed", (req, res) => {
  res.json(memberPosts);
});
app.post("/api/social-feed", (req, res) => {
  const { caption, imageUrl, locationsRecommended, authorName } = req.body;
  if (!caption || !imageUrl) {
    return res.status(400).json({ error: "Caption and dynamic image required" });
  }
  const newPost = {
    id: `p${Date.now()}`,
    author: {
      name: authorName || "Anonymous",
      avatar: "",
      location: "Verified Member Route",
      verified: true
    },
    imageUrl,
    caption,
    likesCount: 1,
    commentsCount: 0,
    hasLiked: true,
    locationsRecommended: locationsRecommended || [],
    date: "Today"
  };
  memberPosts.unshift(newPost);
  res.json(newPost);
});
app.post("/api/social-feed/:id/like", (req, res) => {
  const post = memberPosts.find((p) => p.id === req.params.id);
  if (post) {
    if (post.hasLiked) {
      post.likesCount -= 1;
      post.hasLiked = false;
    } else {
      post.likesCount += 1;
      post.hasLiked = true;
    }
    return res.json(post);
  }
  res.status(404).json({ error: "Post not found" });
});
app.get("/api/marketplace/items", (req, res) => {
  res.json(itemsDatabase);
});
app.get("/api/marketplace/bookings", (req, res) => {
  res.json(userBookings);
});
app.post("/api/marketplace/bookings", (req, res) => {
  const {
    itemId,
    photoUploaded,
    isPhysicalPostcard,
    postalRecipient,
    postalStreet,
    postalCityZip,
    postalCountry,
    postalMessage
  } = req.body;
  const item = itemsDatabase.find((dbItem) => dbItem.id === itemId);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }
  const finalPrice = isPhysicalPostcard ? item.price + 4.99 : item.price;
  const dispatchSuffix = isPhysicalPostcard ? ` (Physical Postcard to ${postalRecipient || "Recipient"})` : "";
  const newBooking = {
    id: `book_${Date.now()}`,
    itemTitle: `${item.title}${dispatchSuffix}`,
    totalPrice: finalPrice,
    bookingDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    status: "Confirmed",
    photoUploaded: photoUploaded || void 0,
    // customizable souvenirs
    isPhysical: isPhysicalPostcard || false,
    addressDetails: isPhysicalPostcard ? {
      recipient: postalRecipient,
      street: postalStreet,
      cityZip: postalCityZip,
      country: postalCountry,
      message: postalMessage
    } : void 0
  };
  userBookings.unshift(newBooking);
  res.json(newBooking);
});
app.get("/api/bucket-list", (req, res) => {
  res.json(userBucketList);
});
app.post("/api/bucket-list", (req, res) => {
  const { title, destination } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Missing bucket list title" });
  }
  const newItem = {
    id: `bl${Date.now()}`,
    title,
    destination: destination || "Global",
    completed: false
  };
  userBucketList.unshift(newItem);
  res.json(newItem);
});
app.post("/api/bucket-list/:id/toggle", (req, res) => {
  const item = userBucketList.find((bl) => bl.id === req.params.id);
  if (item) {
    item.completed = !item.completed;
    return res.json(item);
  }
  res.status(404).json({ error: "Item not found" });
});
app.delete("/api/bucket-list/:id", (req, res) => {
  const index = userBucketList.findIndex((bl) => bl.id === req.params.id);
  if (index !== -1) {
    userBucketList.splice(index, 1);
    return res.json({ success: true });
  }
  res.status(404).json({ error: "Item not found" });
});
var contactMessages = [];
app.post("/api/contact", (req, res) => {
  const { name, email, topic, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required" });
  }
  const entry = {
    id: `cm_${Date.now()}`,
    name,
    email,
    topic: topic || "General",
    message,
    receivedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  contactMessages.unshift(entry);
  console.log(`[contact] New message from ${name} <${email}> \u2014 ${topic}`);
  res.json({ success: true, id: entry.id });
});
app.get("/api/contact", (req, res) => {
  res.json(contactMessages);
});
app.post("/api/photo-albums/digital", (req, res) => {
  const { title, subtitle, creatorName, themeName, photos } = req.body;
  if (!title || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: "Album title and at least one uploaded photo are required" });
  }
  const entry = {
    id: `album_${Date.now()}`,
    title,
    subtitle: subtitle || "",
    creatorName: creatorName || "",
    themeName: themeName || "Custom",
    photos,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  photoAlbumExports.unshift(entry);
  res.json({
    success: true,
    id: entry.id,
    downloadUrl: `/api/photo-albums/${entry.id}/export.html`,
    message: "Digital album compiled."
  });
});
app.get("/api/photo-albums/:id/export.html", (req, res) => {
  const album = photoAlbumExports.find((entry) => entry.id === req.params.id);
  if (!album) {
    return res.status(404).send("Album not found");
  }
  const escapeHtml = (value) => String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const pages = album.photos.map((photo, index) => `
    <section class="page">
      <p class="kicker">Page ${index + 1}${photo.location ? ` \xB7 ${escapeHtml(photo.location)}` : ""}</p>
      <img src="${photo.url}" alt="${escapeHtml(photo.title || `Album photo ${index + 1}`)}" />
      <h2>${escapeHtml(photo.title || `Photo ${index + 1}`)}</h2>
      <p>${escapeHtml(photo.caption || "")}</p>
    </section>
  `).join("");
  res.type("html").send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(album.title)}</title>
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
      <p class="kicker">${escapeHtml(album.themeName)} Album</p>
      <h1>${escapeHtml(album.title)}</h1>
      <p>${escapeHtml(album.subtitle)}</p>
      <p class="kicker">${album.creatorName ? `Curated by ${escapeHtml(album.creatorName)}` : ""}</p>
    </section>
    ${pages}
  </body>
</html>`);
});
app.post("/api/photo-albums/physical-orders", (req, res) => {
  const { title, recipient, address, photos } = req.body;
  if (!title || !recipient || !address || !Array.isArray(photos) || photos.length === 0) {
    return res.status(400).json({ error: "Album title, recipient, address, and at least one uploaded photo are required" });
  }
  const order = {
    id: `album_order_${Date.now()}`,
    title,
    recipient,
    address,
    photoCount: photos.length,
    totalPrice: 34.95,
    status: "Print Queue Received",
    submittedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  photoAlbumOrders.unshift(order);
  res.json({ success: true, order });
});
app.get("/api/photo-albums/physical-orders", (req, res) => {
  res.json(photoAlbumOrders);
});
if (process.env.NODE_ENV !== "production") {
  (async () => {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  })();
} else {
  const distPath = import_path.default.join(process.cwd(), "dist");
  app.use(import_express.default.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(import_path.default.join(distPath, "index.html"));
  });
}
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Judy's Express Server running on http://0.0.0.0:${PORT}`);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
