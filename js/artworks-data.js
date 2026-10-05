/* artworks-data.js: the SAMPLE artworks shown the first time the site opens.
   They are placeholders. Signed-in users replace them from the My art page (dashboard.html).
   Styles: landscape, colorfield, geometric, neon, photoCity, photoSea, topo, dunes */
window.KG = window.KG || {};

KG.DEFAULT_ARTWORKS = [
  { id: 1, title: "Dusk at the Barrage", artist: "Ravi Kumar", year: 2025, category: "Painting",
    medium: "Oil on canvas", dimensions: "80 × 100 cm", price: 185000, sold: false, image: "",
    ratio: [4,5], style: "landscape", seed: 11,
    palette: ["#3b3a73","#e58a6a","#ffe9bf","#8a4f7a","#4a3566","#1d1730"],
    description: "The last light of a monsoon evening settles over the Krishna river. Painted in layers of thin oil over several weeks from studies made at the barrage.",
    alt: "Oil painting of a river at dusk. A pale sun sits above layered violet hills, and its reflection runs through dark water." },

  { id: 2, title: "Held Breath No. 4", artist: "Kabir Sethi", year: 2024, category: "Painting",
    medium: "Acrylic on linen", dimensions: "120 × 150 cm", price: 240000, sold: false, image: "",
    ratio: [4,5], style: "colorfield", seed: 2,
    palette: ["#3a0f12","#c2512b","#7a1f22","#e7a561"],
    description: "Two soft-edged fields of colour press against each other across a thin line of light. Part of a series about the pause before a decision.",
    alt: "Abstract painting of two soft-edged rectangles, burnt orange above deep red, on a dark maroon ground." },

  { id: 3, title: "Courtyard Study", artist: "Lakshmi Iyer", year: 2023, category: "Painting",
    medium: "Gouache on paper", dimensions: "50 × 65 cm", price: 68000, sold: false, image: "",
    ratio: [4,5], style: "geometric", seed: 5,
    palette: ["#efe6d2","#d4552e","#2b4a6f","#e0b04a","#1d1d1d"],
    description: "A traditional Chettinad courtyard reduced to circles, arches and bands of flat colour. Made on handmade cotton paper.",
    alt: "Geometric gouache composition with a red circle, blue and yellow arches, and thin black lines on a cream ground." },

  { id: 4, title: "Neon Monsoon", artist: "Anita Rao", year: 2026, category: "Digital",
    medium: "Pigment print on aluminium", dimensions: "60 × 75 cm", price: 42000, sold: false, image: "",
    ratio: [4,5], style: "neon", seed: 7,
    palette: ["#10062b","#ff3b8d","#19d3ff","#7a4dff"],
    description: "Rain on a night street, rebuilt from photographs and painted over digitally. Printed on aluminium in an edition of fifteen.",
    alt: "Digital artwork of glowing pink, cyan and violet light blooms with thin curved lines on a deep purple background." },

  { id: 5, title: "Harbour Hands", artist: "Meera Nair", year: 2024, category: "Photography",
    medium: "Archival pigment print", dimensions: "60 × 40 cm", price: 24000, sold: false, image: "",
    ratio: [3,2], style: "photoSea", seed: 9,
    palette: ["#dde3e6","#9fb0b6","#1f2a30"],
    description: "A fishing boat waits at the edge of a long exposure at Fort Kochi. Edition of twenty-five, signed and numbered.",
    alt: "Photograph of a small boat silhouetted on a pale, misty sea beneath a soft white sun." },

  { id: 6, title: "Signal Garden", artist: "Anita Rao", year: 2025, category: "Digital",
    medium: "Generative digital print", dimensions: "70 × 70 cm", price: 55000, sold: false, image: "",
    ratio: [1,1], style: "topo", seed: 4,
    palette: ["#0e1f1c","#7bd8b0","#f1d27b"],
    description: "Contour lines grown by a small program that listens to radio static. No two prints in the edition share the same lines.",
    alt: "Generative artwork of green and gold contour lines forming concentric organic shapes on a dark teal ground." },

  { id: 7, title: "Monsoon Terrace", artist: "Meera Nair", year: 2023, category: "Photography",
    medium: "Silver gelatin print", dimensions: "30 × 40 cm", price: null, sold: false, image: "",
    ratio: [4,5], style: "photoCity", seed: 6,
    palette: ["#d9c6a8","#a9835c","#2a211c"],
    description: "Rooftops and water tanks under a heavy afternoon sky, printed by hand in the darkroom. A rare unique print.",
    alt: "Sepia photograph of a city skyline in silhouette beneath a bright, glowing sky." },

  { id: 8, title: "Paddy Geometry", artist: "Ravi Kumar", year: 2026, category: "Painting",
    medium: "Acrylic on canvas", dimensions: "100 × 80 cm", price: 120000, sold: false, image: "",
    ratio: [5,4], style: "dunes", seed: 3,
    palette: ["#d9e4a8","#b6d07a","#8bb45a","#5f9a4a","#3f7a45","#27553a"],
    description: "Terraced fields seen from a train window, flattened into bands of green. Painted quickly, in a single sitting.",
    alt: "Painting of rolling horizontal bands in fresh greens, like terraced paddy fields." },

  { id: 9, title: "Low Tide Algorithm", artist: "Anita Rao", year: 2025, category: "Digital",
    medium: "Giclée print", dimensions: "75 × 50 cm", price: 38000, sold: false, image: "",
    ratio: [3,2], style: "dunes", seed: 8,
    palette: ["#f6e3c4","#f0c48a","#e39c64","#c46f55","#8e4a5a","#4a2f55"],
    description: "Waves of warm colour calculated from tide tables for the Bay of Bengal. Printed on cotton rag paper.",
    alt: "Digital artwork of layered wavy bands moving from pale cream through orange to deep plum." },

  { id: 10, title: "Stairwell, Ahmedabad", artist: "Meera Nair", year: 2022, category: "Photography",
    medium: "Archival pigment print", dimensions: "40 × 50 cm", price: 30000, sold: true, image: "",
    ratio: [4,5], style: "photoCity", seed: 12,
    palette: ["#e6eaec","#aab5ba","#1c2327"],
    description: "Concrete, shadow and a single band of light in a 1960s apartment block. This edition has sold out.",
    alt: "Cool grey photograph of tall dark building shapes against a pale, glowing sky." },

  { id: 11, title: "Evening Offering", artist: "Lakshmi Iyer", year: 2021, category: "Painting",
    medium: "Oil on board", dimensions: "60 × 40 cm", price: 92000, sold: false, image: "",
    ratio: [3,2], style: "landscape", seed: 21,
    palette: ["#f2b66d","#fbe4b6","#fffaf0","#c97b45","#8a4a2f","#3a2418"],
    description: "Lamps floating on a river at the end of a festival day, painted from memory in warm, low light.",
    alt: "Warm oil painting of a pale sun over amber hills, with its glow reflected in dark water." },

  { id: 12, title: "Quiet Weight", artist: "Kabir Sethi", year: 2022, category: "Painting",
    medium: "Oil on canvas", dimensions: "100 × 100 cm", price: null, sold: false, image: "",
    ratio: [1,1], style: "colorfield", seed: 14,
    palette: ["#101a2b","#2f4f7a","#1d2f4d","#c9d3e6"],
    description: "Deep blues stacked in a square, with a thin pale line where the two fields meet. Made slowly, over a winter.",
    alt: "Square abstract painting of two deep blue fields separated by a thin pale line on a navy ground." }
];
