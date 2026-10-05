/* config.js: gallery name, contact email and exhibition list. Edit these first. */
window.KG = window.KG || {};

KG.SITE = {
  name: "Kalakriti",
  fullName: "Kalakriti Gallery",
  tagline: "Contemporary painting, photography and digital art from India.",
  featuredId: 1,                        // id of the artwork shown in the hero
  email: "hello@kalakriti.example",     // used by the inquiry email link
  locale: "en-IN",
  currency: "INR"
};

KG.EXHIBITIONS = [
  { title: "Monsoon Light", start: "2026-11-14", end: "2026-12-20", venue: "Kalakriti Gallery, Vijayawada",
    text: "Twelve paintings and photographs about rain, rivers and reflection." },
  { title: "Quiet Weights", start: "2027-01-17", end: "2027-02-28", venue: "Online viewing room",
    text: "New paintings by Kabir Sethi, shown with a conversation between the artist and the curator." },
  { title: "Signals", start: "2026-06-06", end: "2026-08-02", venue: "Online viewing room",
    text: "A solo exhibition of generative and digital work by Anita Rao." },
  { title: "Harbour Light", start: "2026-02-07", end: "2026-03-22", venue: "Kalakriti Gallery, Vijayawada",
    text: "Photographs of the Kerala coast by Meera Nair." },
  { title: "First Light", start: "2025-10-04", end: "2025-11-16", venue: "Kalakriti Gallery, Vijayawada",
    text: "The founding group show, with six artists and thirty works." }
];
