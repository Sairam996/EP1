/**
 * One showcase vendor so the home rail and vendor detail screen can be
 * previewed even when the API has no listings. Rendered entirely client-side;
 * booking is disabled for it (it is a preview, not a real partner).
 */
const G = [
  "https://images.pexels.com/photos/33852486/pexels-photo-33852486.jpeg",
  "https://images.pexels.com/photos/28950121/pexels-photo-28950121.jpeg",
  "https://images.pexels.com/photos/35508916/pexels-photo-35508916.jpeg",
  "https://images.pexels.com/photos/35042459/pexels-photo-35042459.jpeg",
];

export const SAMPLE_VENDOR_ID = "sample-taj-mahal-palace-hyd";

function blocked(): string[] {
  // A few booked dates this and next month so the availability calendar has content.
  const d = new Date(); const out: string[] = [];
  for (const m of [0, 1]) for (const day of [4, 8, 15, 22, 29]) {
    const x = new Date(d.getFullYear(), d.getMonth() + m, day);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`);
  }
  return out;
}

export const SAMPLE_VENDOR = {
  id: SAMPLE_VENDOR_ID,
  is_sample: true,
  name: "Sitara Palace Banquets",
  category: "venues",
  city: "Hyderabad",
  cover: G[0],
  gallery: G,
  description:
    "A heritage-style banquet in Jubilee Hills with a 600-guest pillarless hall, open-air lawn for haldi & mehendi, and an in-house décor team. Sample listing — shows how vendor details appear on Thara.",
  starting_price: 250000,
  rating: 4.8,
  reviews_count: 3,
  verified: true,
  founding_vendor: true,
  facilities: ["600 guests", "Valet parking", "Bridal suite", "In-house décor", "Veg & non-veg catering", "Power backup"],
  address: "Road No. 36, Jubilee Hills, Hyderabad",
  lat: 17.4326, lng: 78.4071,
  team: [
    { id: "t1", name: "Ananya R.", role: "Event Manager" },
    { id: "t2", name: "Vikram S.", role: "Décor Lead" },
    { id: "t3", name: "Chef Imran", role: "Head Chef" },
  ],
  blocked_dates: blocked(),
};

export const SAMPLE_SERVICES = [
  { id: "sp1", title: "Royal Wedding Package", description: "Hall + lawn for 2 days, floral mandap, 400-pax buffet, bridal suite.", price: 650000, photos: [G[0], G[2]] },
  { id: "sp2", title: "Sangeet & Mehendi Night", description: "Lawn setup, fairy lighting, DJ console, 200-pax live counters.", price: 250000, photos: [G[1], G[3]] },
];

export const SAMPLE_REVIEWS = [
  { id: "r1", user_name: "Priya K.", rating: 5, comment: "Our wedding looked straight out of a film. Team handled everything." },
  { id: "r2", user_name: "Rahul M.", rating: 5, comment: "Gorgeous lawn for haldi, food was the highlight." },
  { id: "r3", user_name: "Sneha T.", rating: 4, comment: "Great venue and décor, parking got busy late evening." },
];
