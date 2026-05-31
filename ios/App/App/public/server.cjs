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
var PORT = 3e3;
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
var flightsData = [
  {
    id: "f1",
    flightNumber: "PV-101",
    airline: "Pride Airways",
    origin: "San Francisco (SFO)",
    destination: "Barcelona (BCN)",
    scheduledTime: "14:30",
    status: "On Time",
    gate: "B24",
    terminal: "Intl T2",
    lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString()
  },
  {
    id: "f2",
    flightNumber: "PV-255",
    airline: "Rainbow Lines",
    origin: "New York (JFK)",
    destination: "Puerto Vallarta (PVR)",
    scheduledTime: "16:45",
    status: "Boarding",
    gate: "C12",
    terminal: "Terminal 4",
    lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString()
  },
  {
    id: "f3",
    flightNumber: "PV-711",
    airline: "EuroPride Express",
    origin: "London Heathrow (LHR)",
    destination: "Berlin (BER)",
    scheduledTime: "19:15",
    status: "Delayed",
    gate: "A05",
    terminal: "Terminal 5",
    lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString()
  },
  {
    id: "f4",
    flightNumber: "PV-880",
    airline: "Southern Cross Pride",
    origin: "Sydney (SYD)",
    destination: "Bangkok (BKK)",
    scheduledTime: "08:10",
    status: "Scheduled",
    gate: "18",
    terminal: "T1",
    lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString()
  }
];
var safetyZones = [
  {
    id: "z1",
    title: "Gaixample Queer Culture Hub",
    address: "Carrer de Balmes, Barcelona",
    coords: { x: 42, y: 38 },
    category: "Bar/Nightclub",
    safetyScore: 9.6,
    crowdLevel: "Vibrant",
    verificationCount: 142,
    tags: ["LGBTQ+ Owned", "Fully Accessible", "Well-lit", "English Spoken"],
    reviews: [
      {
        id: "r1",
        user: "Marcus V.",
        avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100",
        text: "Outstanding ambiance! Felt 100% comfortable holding hands. Active security guard at the door and superb, inclusive staff.",
        date: "2026-05-28",
        isVerified: true,
        rating: 5
      },
      {
        id: "r2",
        user: "Julian K.",
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100",
        text: "A pillar of Barcelona nightlife. Always highly respectful and super friendly crowd.",
        date: "2026-05-30",
        isVerified: true,
        rating: 5
      }
    ]
  },
  {
    id: "z2",
    title: "Castro District Safety Corridor",
    address: "Castro St & 18th St, San Francisco",
    coords: { x: 25, y: 55 },
    category: "General Area",
    safetyScore: 9.8,
    crowdLevel: "Vibrant",
    verificationCount: 310,
    tags: ["Safety Patrol", "Gay Landmark", "Intense Lighting", "De-escalation trained"],
    reviews: [
      {
        id: "r3",
        user: "Tyler S.",
        avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=100",
        text: "The community patrol on weekends is incredibly nice. Absolute safe haven with lovely local shops and historical monuments.",
        date: "2026-05-15",
        isVerified: true,
        rating: 5
      }
    ]
  },
  {
    id: "z3",
    title: "Sch\xF6neberg Cultural Quarter",
    address: "Nollendorfplatz, Berlin",
    coords: { x: 65, y: 48 },
    category: "Cultural Center",
    safetyScore: 9.2,
    crowdLevel: "Moderate",
    verificationCount: 88,
    tags: ["Historical", "Community-Led", "All-Genders Welcomed", "Easy Transit"],
    reviews: [
      {
        id: "r4",
        user: "Lukas P.",
        avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=100",
        text: "Very comfortable area day or night. Plenty of friendly spots and rich history of Berlin queer empowerment.",
        date: "2026-05-20",
        isVerified: true,
        rating: 5
      }
    ]
  }
];
var localGuides = [
  {
    id: "g1",
    name: "Alejandro S.",
    location: "Barcelona, Spain",
    languages: ["Spanish", "English", "Catalan"],
    bio: "Passionate about Barcelona's modern architecture, local queer history, and finding hidden local tapas spots in Gaixample! Let's build your perfect stay.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=150",
    rating: 4.9,
    experienceCount: 78,
    interests: ["Architecture", "Gourmet Tapas", "Nightlife VIP Keyholder", "Queer Art Tours"],
    online: true
  },
  {
    id: "g2",
    name: "Christian M.",
    location: "Berlin, Germany",
    languages: ["German", "English", "French"],
    bio: "Curator of avant-garde electronic music spots and Sch\xF6neberg street histories. I help you avoid the long queues and discover authentic Berlin culture safely.",
    avatar: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?auto=format&fit=crop&q=80&w=150",
    rating: 4.8,
    experienceCount: 124,
    interests: ["Electronic Music", "Street Art", "LGBTIQ+ History Museums", "Culinary Cafes"],
    online: true
  },
  {
    id: "g3",
    name: "Hiroki T.",
    location: "Tokyo, Japan",
    languages: ["Japanese", "English"],
    bio: "Guide to Shinjuku Ni-chome's unique local bars, traditional food tours, and aesthetic Tokyo temples. Your local bestie and translator for an incredible authentic stay.",
    avatar: "https://images.unsplash.com/photo-1542343633-ce7827e7648e?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    experienceCount: 52,
    interests: ["Traditional Arts", "Nightlife Crawls", "Hidden Diners", "Photography"],
    online: false
  }
];
var chatMessages = [
  {
    id: "m1",
    senderId: "g1",
    receiverId: "user",
    text: "Hola! Welcome to Judy's Guides. I would love to guide you through Gaixample or book an exclusive wine tasting experience for you! Let me know if you have any questions.",
    timestamp: "2026-05-31T10:00:00.000Z"
  },
  {
    id: "m2",
    senderId: "user",
    text: "Hi Alejandro! That sounds amazing. Is Gaixample safe around midnight for single travelers?",
    timestamp: "2026-05-31T10:15:00.000Z",
    receiverId: "g1"
  },
  {
    id: "m3",
    senderId: "g1",
    receiverId: "user",
    text: "Si, absolutely! Gaixample is exceptionally active and highly safe. I have highlighted several spots in the Safety Map for reassurance. I can also escort you if you book our VIP Nightlife pass!",
    timestamp: "2026-05-31T10:17:00.000Z"
  }
];
var memberPosts = [
  {
    id: "p1",
    author: {
      name: "Ethan Wright",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100",
      location: "Fell in love with Sitges",
      verified: true
    },
    imageUrl: "https://images.unsplash.com/photo-1517713982677-4c6638865c67?auto=format&fit=crop&q=80&w=600",
    caption: "Sunsets in Sitges are otherwordly! Recommending the beachfront cafes. Highlighted Sitges Beach safety zones with verification! \u{1F3F3}\uFE0F\u200D\u{1F308}\u{1F334} #sitges #gaytravel",
    likesCount: 58,
    commentsCount: 12,
    hasLiked: false,
    locationsRecommended: ["Sitges Beachfront", "L'Art i el Cafe"],
    date: "May 29, 2026"
  },
  {
    id: "p2",
    author: {
      name: "Oliver Smith",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=100",
      location: "Celebrating in Mykonos",
      verified: true
    },
    imageUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=600",
    caption: "The Aegean sea paired with dynamic local culture. Connected with a superb local guide through the private secure chat who arranged an awesome private boat tour!",
    likesCount: 94,
    commentsCount: 24,
    hasLiked: true,
    locationsRecommended: ["Jackie O' Beach", "Mykonos Windmills"],
    date: "May 30, 2026"
  }
];
var itemsDatabase = [
  {
    id: "exp1",
    title: "Gaixample VIP Nightlife Crawl",
    price: 85,
    category: "tours",
    description: "Inclusive curated entry to the top queer clubs of Barcelona, skip-the-line benefits, and a private local coordinator for exceptional safety.",
    imageUrl: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=400",
    details: "Includes 3 signature Cocktails, fast track entrance, and bilingual host support throughout Balmes street hubs."
  },
  {
    id: "exp2",
    title: "Montserrat Sacred Sunset Hike & Wine Tasting",
    price: 120,
    category: "tours",
    description: "An elegant, scenic day trip with verified guides tailored to queer travelers to bond, enjoy stunning sights, and taste premium catalan wine.",
    imageUrl: "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?auto=format&fit=crop&q=80&w=400",
    details: "Transportation included, tailored for dynamic storytelling, organic local tapas, and lovely scenic photoshoots."
  },
  {
    id: "tix1",
    title: "Circuit Festival Barcelona Main Party Admission Ticket",
    price: 65,
    category: "tickets",
    description: "Official secure entry ticket to the world's grandest international LGBTIQ+ Summer Festival. Multi-sensory visuals, international DJs, and extreme community safety.",
    imageUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: "pc1",
    title: "Premium Judy's Personalized Digital Postcard",
    price: 5.95,
    category: "postcards",
    description: "Turn your uploaded trip photos into customized travel postcards. We apply high-art filters, beautiful layout, and send high-resolution print files or dynamic animated links.",
    imageUrl: "https://images.unsplash.com/photo-1452421820064-e70a9a868b43?auto=format&fit=crop&q=80&w=400"
  },
  {
    id: "souv1",
    title: "Judy's starter souvenier box",
    price: 24.99,
    category: "souvenirs",
    description: "Engraved custom with your favorite uploaded travel photograph. Robust, vacuum sealed, and highly elegant, packed with welcoming local goodies.",
    imageUrl: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&q=80&w=400"
  }
];
var userBookings = [
  {
    id: "b_init",
    itemTitle: "Judy's starter souvenier box",
    totalPrice: 15,
    bookingDate: "2026-05-30",
    status: "Confirmed"
  }
];
var userBucketList = [
  { id: "bl1", title: "Participate in Barcelona Pride Parade", destination: "Barcelona", completed: true },
  { id: "bl2", title: "Watch the Sunset from Mykonos Mills", destination: "Mykonos", completed: false },
  { id: "bl3", title: "Meet a professional guide in Berlin", destination: "Berlin", completed: false }
];
app.get("/api/flights", (req, res) => {
  flightsData = flightsData.map((f) => {
    if (Math.random() > 0.7) {
      const statuses = ["On Time", "Boarding", "Delayed", "Departed"];
      const gates = ["B24", "C12", "A05", "18", "D10", "E02"];
      return {
        ...f,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        gate: gates[Math.floor(Math.random() * gates.length)],
        lastUpdated: (/* @__PURE__ */ new Date()).toLocaleTimeString()
      };
    }
    return f;
  });
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
      model: "gemini-3.5-flash",
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
      model: "gemini-3.5-flash",
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
        user: "Verified Voyager",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100",
        text: testReview || "Superb spot. Highly recommended for queer travelers. Respectful neighborhood.",
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
      user: user || "Robert G.",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100",
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
  setTimeout(() => {
    const guide = localGuides.find((g) => g.id === receiverId);
    const guideReply = {
      id: `m_rep_${Date.now()}`,
      senderId: receiverId,
      receiverId: "user",
      text: `Hi voyager! That's brilliant. I love your query "${text}". As your private guide in ${guide ? guide.location : "Europe"}, I advise booking our Curated Experience or VIP Tour packaged item for custom accessories and real-time coordination! Excellent decision!`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    chatMessages.push(guideReply);
  }, 1500);
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
      name: authorName || "Robert G.",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100",
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
