import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const require = createRequire(import.meta.url);
const sharp = require("C:/Users/LFen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp");

const workspace = path.resolve(".");
const srcDir = path.join(workspace, "src");
const scratchDir = path.join(workspace, "scratch");
const assetDir = path.join(scratchDir, "assets");
const sourcePreviewDir = path.join(scratchDir, "previews");
const pptxPreviewDir = path.join(scratchDir, "pptx-previews");
const outputDir = path.join(workspace, "output");
const outputPptx = path.join(outputDir, "output.pptx");

const W = 1920;
const H = 1080;

const C = {
  space: "#070A12",
  deep: "#111827",
  ink: "#15171E",
  cream: "#F6EFE4",
  paper: "#F9F6EF",
  white: "#F7FAFC",
  mist: "#C5D0DE",
  muted: "#8794A8",
  gold: "#FFB547",
  amber: "#F1732F",
  blue: "#49B6FF",
  teal: "#5EEAD4",
  rust: "#D85A3A",
  violet: "#A78BFA",
  ice: "#BEE8FF",
};

const F = {
  display: "Aptos Display",
  body: "Aptos",
};

const assets = {
  sun: {
    id: "GSFC_20171208_Archive_e000790",
    title: "NASA's SDO Sees Giant Filament on the Sun",
    href: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e000790/collection.json",
  },
  mercury: {
    id: "GSFC_20171208_Archive_e001545",
    title: "False Color View of Mercury",
    href: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001545/collection.json",
  },
  venus: {
    id: "PIA00104",
    title: "Venus - Computer Simulated Global View Centered at 180 Degrees East Longitude",
    href: "https://images-assets.nasa.gov/image/PIA00104/collection.json",
  },
  earth: {
    id: "GSFC_20171208_Archive_e002131",
    title: "NASA Blue Marble 2007 West",
    href: "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e002131/collection.json",
  },
  mars: {
    id: "PIA00407",
    title: "Global Color Views of Mars",
    href: "https://images-assets.nasa.gov/image/PIA00407/collection.json",
  },
  jupiter: {
    id: "PIA22946",
    title: "Jupiter Marble",
    href: "https://images-assets.nasa.gov/image/PIA22946/collection.json",
  },
  saturn: {
    id: "PIA17172",
    title: "The Day the Earth Smiled",
    href: "https://images-assets.nasa.gov/image/PIA17172/collection.json",
  },
  uranus: {
    id: "PIA18182",
    title: "Uranus as seen by NASA Voyager 2",
    href: "https://images-assets.nasa.gov/image/PIA18182/collection.json",
  },
  neptune: {
    id: "PIA01492",
    title: "Neptune",
    href: "https://images-assets.nasa.gov/image/PIA01492/collection.json",
  },
  ceres: {
    id: "PIA10235",
    title: "Color View of Ceres",
    href: "https://images-assets.nasa.gov/image/PIA10235/collection.json",
  },
};

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function saveBlob(blob, filePath) {
  await writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
}

async function hydrateLocalImages(presentation) {
  const requests = presentation.getPendingImageHydrationRequests?.() ?? [];
  const payloads = [];
  for (const request of requests) {
    if (!request.assetId || !request.uri) continue;
    const filePath = request.uri.startsWith("file:")
      ? new URL(request.uri)
      : request.uri;
    payloads.push({
      assetId: request.assetId,
      contentType: request.contentType ?? "image/jpeg",
      data: await readFile(filePath),
    });
  }
  presentation.hydrateImageAssets(payloads);
  return payloads.length;
}

async function downloadAssets() {
  await mkdir(assetDir, { recursive: true });
  const manifest = {};

  for (const [key, asset] of Object.entries(assets)) {
    const filePath = path.join(assetDir, `${key}.jpg`);
    if (!(await exists(filePath))) {
      const collectionRes = await fetch(asset.href);
      if (!collectionRes.ok) {
        throw new Error(`Could not fetch NASA collection for ${key}: ${collectionRes.status}`);
      }
      const links = await collectionRes.json();
      const preferred =
        links.find((url) => /~large\.(jpg|jpeg|png)$/i.test(url)) ??
        links.find((url) => /~medium\.(jpg|jpeg|png)$/i.test(url)) ??
        links.find((url) => /~orig\.(jpg|jpeg|png)$/i.test(url)) ??
        links.find((url) => /\.(jpg|jpeg|png)$/i.test(url));
      if (!preferred) throw new Error(`NASA collection for ${key} had no image link.`);

      const imageUrl = preferred.replace(/^http:/i, "https:");
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) throw new Error(`Could not fetch image for ${key}: ${imageRes.status}`);
      await writeFile(filePath, Buffer.from(await imageRes.arrayBuffer()));
      manifest[key] = { ...asset, imageUrl, filePath };
    } else {
      manifest[key] = { ...asset, imageUrl: null, filePath };
    }
  }

  await writeFile(path.join(scratchDir, "asset-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest;
}

function setBg(slide, color = C.space) {
  slide.background.fill = { type: "solid", color };
}

function addText(slide, value, frame, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "rect",
    position: frame,
    fill: opts.fill ?? { type: "none" },
    line: { visible: false },
  });
  shape.name = opts.name ?? `text-${Math.round(frame.left)}-${Math.round(frame.top)}`;
  shape.text.style = {
    typeface: opts.typeface ?? F.body,
    fontSize: opts.size ?? 28,
    color: opts.color ?? C.white,
    bold: Boolean(opts.bold),
    italic: Boolean(opts.italic),
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
  };
  shape.text = value;
  return shape;
}

function addRect(slide, frame, color, opts = {}) {
  const shape = slide.shapes.add({
    geometry: opts.geometry ?? "rect",
    position: { ...frame, rotation: opts.rotation ?? 0 },
    fill: opts.fill ?? { type: "solid", color },
    line: opts.line ?? { visible: false },
  });
  shape.name = opts.name ?? `shape-${Math.round(frame.left)}-${Math.round(frame.top)}`;
  return shape;
}

function addRule(slide, left, top, width, color = C.gold, height = 5) {
  return addRect(slide, { left, top, width, height }, color, { name: `rule-${left}-${top}` });
}

function addImage(slide, manifest, key, frame, opts = {}) {
  const img = slide.images.add({
    path: manifest[key].filePath,
    alt: opts.alt ?? manifest[key].title,
    position: frame,
    fit: opts.fit ?? "contain",
  });
  img.name = opts.name ?? `${key}-image`;
  if (opts.geometry) img.geometry = opts.geometry;
  if (opts.crop) img.crop = opts.crop;
  return img;
}

function addFooter(slide, text = "Images and data: NASA/JPL/GSFC. Distances and sizes are simplified for presentation.", color = C.muted) {
  addText(slide, text, { left: 86, top: 1024, width: 1420, height: 28 }, {
    name: "footer-source",
    size: 14,
    color,
    typeface: F.body,
  });
}

function starField(slide, seed = 1, color = "#FFFFFF", count = 42, avoid = []) {
  let value = seed;
  const next = () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
  for (let i = 0, placed = 0; placed < count && i < count * 8; i += 1) {
    const x = 70 + next() * 1780;
    const y = 52 + next() * 910;
    const size = 2 + next() * 3.8;
    if (avoid.some((r) => x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height)) {
      continue;
    }
    const palette = next() > 0.82 ? C.gold : color;
    addRect(slide, { left: x, top: y, width: size, height: size }, palette, {
      geometry: "ellipse",
      name: `star-${seed}-${placed}`,
    });
    placed += 1;
  }
}

function cover(p, manifest) {
  const s = p.slides.add();
  setBg(s, C.space);
  starField(s, 17, "#C7D7FF", 58);
  addImage(s, manifest, "sun", { left: -250, top: -140, width: 1080, height: 1360 }, { fit: "cover", name: "cover-sun" });
  addRect(s, { left: 760, top: 0, width: 220, height: H }, C.space, { name: "cover-shadow" });
  addRule(s, 928, 196, 7, C.gold, 688);
  addText(s, "Solar\nSystem", { left: 1020, top: 190, width: 640, height: 260 }, {
    name: "cover-title",
    size: 104,
    bold: true,
    typeface: F.display,
    color: C.white,
  });
  addText(s, "A neighborhood built by gravity, sunlight, and deep time", { left: 1024, top: 505, width: 660, height: 126 }, {
    name: "cover-subtitle",
    size: 36,
    color: C.cream,
    typeface: F.display,
  });
  addText(s, "Editable 8-slide visual tour", { left: 1026, top: 710, width: 420, height: 40 }, {
    name: "cover-kicker",
    size: 22,
    bold: true,
    color: C.gold,
  });
  addText(s, "NASA image sources; simplified educational scale", { left: 1026, top: 926, width: 620, height: 28 }, {
    name: "cover-source",
    size: 13,
    color: "#9DA8B8",
  });
  s.speakerNotes.text = "Open with the idea that the solar system is not a list of planets. It is a dynamic system organized by the Sun's gravity.";
}

function sunAnchor(p, manifest) {
  const s = p.slides.add();
  setBg(s, C.cream);
  addImage(s, manifest, "sun", { left: 1050, top: -160, width: 1020, height: 1360 }, { fit: "cover", name: "sun-anchor-image" });
  addRect(s, { left: 0, top: 0, width: 1160, height: H }, C.cream, { name: "paper-field" });
  addText(s, "The Sun is the anchor", { left: 90, top: 78, width: 990, height: 86 }, {
    name: "slide-title",
    size: 66,
    bold: true,
    typeface: F.display,
    color: C.ink,
  });
  addRule(s, 92, 186, 220, C.gold, 6);
  addText(s, "99.8%", { left: 84, top: 270, width: 600, height: 170 }, {
    name: "sun-mass-number",
    size: 150,
    bold: true,
    typeface: F.display,
    color: C.ink,
  });
  addText(s, "of the solar system's mass is in the Sun.", { left: 96, top: 456, width: 650, height: 70 }, {
    name: "sun-mass-caption",
    size: 32,
    color: "#344052",
  });
  const notes = [
    ["Fusion lights the worlds", "Energy from the Sun drives climates, seasons, and photosynthesis on Earth."],
    ["Gravity sets the tempo", "Planets, moons, comets, and dust all move inside the Sun's dominant pull."],
    ["Everything else is tiny", "The planets are spectacular, but they are the thin outer punctuation."],
  ];
  notes.forEach(([head, body], i) => {
    const top = 610 + i * 104;
    addRule(s, 100, top, 86, i === 0 ? C.amber : C.blue, 4);
    addText(s, head, { left: 218, top: top - 13, width: 440, height: 36 }, {
      name: `sun-anchor-head-${i + 1}`,
      size: 25,
      bold: true,
      color: C.ink,
    });
    addText(s, body, { left: 218, top: top + 30, width: 650, height: 52 }, {
      name: `sun-anchor-body-${i + 1}`,
      size: 21,
      color: "#4B5563",
    });
  });
  addFooter(s, "Data: NASA Solar System Exploration. Image: NASA/SDO.", "#667085");
  s.speakerNotes.text = "Use this slide to reset scale. The Sun is the object that makes a solar system a system.";
}

function eightPlanets(p, manifest) {
  const s = p.slides.add();
  setBg(s, C.space);
  starField(s, 26, "#BCD7FF", 36, [{ left: 78, top: 60, width: 1130, height: 170 }]);
  addText(s, "Eight planets, two families", { left: 88, top: 70, width: 930, height: 78 }, {
    name: "slide-title",
    size: 64,
    bold: true,
    typeface: F.display,
  });
  addText(s, "Small rocky worlds close to the heat. Giant worlds where gas, ice, rings, and moons take over.", { left: 92, top: 160, width: 1040, height: 64 }, {
    name: "slide-subtitle",
    size: 28,
    color: C.mist,
  });
  addRule(s, 96, 250, 690, C.gold, 3);
  addRule(s, 982, 250, 760, C.blue, 3);
  addText(s, "Rocky inner worlds", { left: 96, top: 276, width: 360, height: 36 }, {
    name: "group-inner",
    size: 24,
    bold: true,
    color: C.gold,
  });
  addText(s, "Gas and ice giants", { left: 982, top: 276, width: 360, height: 36 }, {
    name: "group-outer",
    size: 24,
    bold: true,
    color: C.blue,
  });

  const planets = [
    ["mercury", "Mercury", 112, 392, 120],
    ["venus", "Venus", 302, 370, 164],
    ["earth", "Earth", 540, 356, 184],
    ["mars", "Mars", 802, 386, 140],
    ["jupiter", "Jupiter", 1040, 318, 280],
    ["saturn", "Saturn", 1320, 344, 310],
    ["uranus", "Uranus", 1634, 420, 150],
    ["neptune", "Neptune", 1770, 420, 150],
  ];
  planets.forEach(([key, label, left, top, size]) => {
    addImage(s, manifest, key, { left, top, width: size, height: size }, { name: `${key}-portrait`, fit: "contain" });
    addText(s, label, { left: left - 20, top: top + size + 18, width: size + 40, height: 34 }, {
      name: `${key}-label`,
      size: key === "saturn" ? 22 : 24,
      bold: true,
      align: "center",
      color: C.white,
    });
  });
  addText(s, "Not to scale", { left: 1620, top: 916, width: 210, height: 30 }, {
    name: "scale-note",
    size: 18,
    color: C.muted,
    align: "right",
  });
  addFooter(s, "Planet portraits: NASA/JPL/GSFC. Layout groups by composition, not physical scale.");
  s.speakerNotes.text = "The viewer should remember the family split: terrestrial planets inside, giant planets outside.";
}

function distanceSlide(p) {
  const s = p.slides.add();
  setBg(s, C.paper);
  addText(s, "Distance is the trick", { left: 86, top: 70, width: 800, height: 80 }, {
    name: "slide-title",
    size: 66,
    bold: true,
    typeface: F.display,
    color: C.ink,
  });
  addText(s, "Planet sizes are memorable. The empty space between them is the real scale lesson.", { left: 90, top: 164, width: 980, height: 54 }, {
    name: "slide-subtitle",
    size: 28,
    color: "#536174",
  });

  const chart = s.charts.add("bar", {
    title: "",
    categories: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
    series: [{
      name: "Average distance from Sun (AU)",
      values: [0.39, 0.72, 1.0, 1.52, 5.2, 9.58, 19.2, 30.05],
      fill: { type: "solid", color: C.blue },
      line: { fill: C.blue, style: "solid", width: 1 },
    }],
    hasLegend: false,
    dataLabels: { showValue: false },
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 82 },
    xAxis: {
      textStyle: { fontSize: 12, fill: "#465469" },
      line: { fill: "#C9CED8", style: "solid", width: 1 },
    },
    yAxis: {
      title: { text: "Astronomical units", textStyle: { fontSize: 13, fill: "#667085" } },
      majorGridlines: { fill: "#E2E5EA", style: "solid", width: 1 },
      textStyle: { fontSize: 11, fill: "#667085" },
    },
    chartFill: { type: "solid", color: C.paper },
    plotAreaFill: { type: "solid", color: C.paper },
    chartLine: { visible: false },
    plotAreaLine: { visible: false },
  });
  chart.name = "distance-chart";
  chart.frame = { left: 84, top: 286, width: 1240, height: 590 };
  chart.series.items[0].fill = { type: "solid", color: C.blue };

  addText(s, "30x", { left: 1428, top: 340, width: 330, height: 130 }, {
    name: "distance-big-number",
    size: 118,
    bold: true,
    typeface: F.display,
    color: C.ink,
  });
  addText(s, "Neptune orbits about thirty times farther from the Sun than Earth.", { left: 1436, top: 486, width: 330, height: 140 }, {
    name: "distance-callout",
    size: 31,
    color: "#3D4758",
  });
  addRule(s, 1438, 666, 260, C.gold, 6);
  addText(s, "The solar system is mostly distance with bright punctuation.", { left: 1438, top: 704, width: 330, height: 90 }, {
    name: "distance-landing",
    size: 23,
    bold: true,
    color: C.amber,
  });
  addFooter(s, "Data: NASA Solar System Exploration; values rounded in astronomical units.", "#667085");
  s.speakerNotes.text = "This is the scale reveal. Even the chart compresses the inner planets near the baseline.";
}

function innerWorlds(p, manifest) {
  const s = p.slides.add();
  setBg(s, C.deep);
  starField(s, 33, "#E8F1FF", 32, [{ left: 78, top: 60, width: 1260, height: 170 }]);
  addText(s, "The inner worlds are four rocky experiments", { left: 86, top: 72, width: 1260, height: 78 }, {
    name: "slide-title",
    size: 58,
    bold: true,
    typeface: F.display,
  });
  addText(s, "Same basic ingredients. Very different atmospheres, temperatures, and histories.", { left: 90, top: 156, width: 980, height: 50 }, {
    name: "slide-subtitle",
    size: 27,
    color: C.mist,
  });
  const worlds = [
    ["mercury", "Mercury", "airless, cratered, extreme", 112],
    ["venus", "Venus", "thick clouds, runaway greenhouse", 520],
    ["earth", "Earth", "liquid water and active life", 940],
    ["mars", "Mars", "cold desert, ancient rivers", 1358],
  ];
  worlds.forEach(([key, label, note, left], i) => {
    addImage(s, manifest, key, { left, top: 304, width: 276, height: 276 }, { fit: "contain", name: `inner-${key}` });
    addRule(s, left + 14, 626, 210, [C.gold, C.amber, C.teal, C.rust][i], 5);
    addText(s, label, { left, top: 656, width: 292, height: 46 }, {
      name: `inner-${key}-label`,
      size: 34,
      bold: true,
      typeface: F.display,
      color: C.white,
    });
    addText(s, note, { left, top: 716, width: 300, height: 78 }, {
      name: `inner-${key}-note`,
      size: 24,
      color: C.mist,
    });
  });
  addText(s, "The habitable zone is not a magic ring. Atmosphere, geology, and time decide the outcome.", { left: 206, top: 890, width: 1340, height: 54 }, {
    name: "inner-landing",
    size: 30,
    bold: true,
    align: "center",
    color: C.cream,
  });
  addFooter(s);
  s.speakerNotes.text = "Treat the four inner planets as a natural experiment in planetary evolution.";
}

function outerWorlds(p, manifest) {
  const s = p.slides.add();
  setBg(s, "#0B1020");
  addRect(s, { left: 0, top: 0, width: W, height: H }, "#0B1020", { name: "outer-bg" });
  starField(s, 44, "#CCEEFF", 45, [{ left: 78, top: 60, width: 1240, height: 170 }]);
  addText(s, "Beyond Mars, scale changes again", { left: 84, top: 68, width: 1120, height: 78 }, {
    name: "slide-title",
    size: 60,
    bold: true,
    typeface: F.display,
  });
  addText(s, "The outer planets are systems in miniature, with rings, storms, magnetic fields, and dozens of moons.", { left: 88, top: 154, width: 1220, height: 58 }, {
    name: "slide-subtitle",
    size: 27,
    color: C.mist,
  });
  const giants = [
    ["jupiter", "Jupiter", "storm engine", "largest planet; a moon system of its own", 96, 284, 330, C.gold],
    ["saturn", "Saturn", "ring laboratory", "icy rings turn gravity into visible structure", 506, 294, 410, C.amber],
    ["uranus", "Uranus", "tilted ice giant", "rotates on its side, likely after a giant impact", 1030, 338, 254, C.ice],
    ["neptune", "Neptune", "blue wind world", "far, cold, and still dynamically active", 1388, 338, 254, C.blue],
  ];
  giants.forEach(([key, label, head, body, left, top, size, color]) => {
    addImage(s, manifest, key, { left, top, width: size, height: size }, { fit: "contain", name: `outer-${key}` });
    addText(s, label, { left, top: 708, width: Math.max(size, 260), height: 44 }, {
      name: `outer-${key}-label`,
      size: 34,
      bold: true,
      typeface: F.display,
      color: C.white,
    });
    addRule(s, left, 765, 176, color, 5);
    addText(s, head, { left, top: 792, width: 280, height: 34 }, {
      name: `outer-${key}-head`,
      size: 22,
      bold: true,
      color,
    });
    addText(s, body, { left, top: 836, width: 330, height: 72 }, {
      name: `outer-${key}-body`,
      size: 21,
      color: C.mist,
    });
  });
  addFooter(s);
  s.speakerNotes.text = "The giant planets are not just bigger rocks. They are complex worlds with their own internal systems.";
}

function smallWorlds(p, manifest) {
  const s = p.slides.add();
  setBg(s, C.paper);
  addText(s, "The leftovers are records", { left: 90, top: 74, width: 920, height: 76 }, {
    name: "slide-title",
    size: 64,
    bold: true,
    typeface: F.display,
    color: C.ink,
  });
  addText(s, "Asteroids, comets, dwarf planets, and moons preserve clues from the early solar system.", { left: 94, top: 164, width: 1060, height: 54 }, {
    name: "slide-subtitle",
    size: 28,
    color: "#536174",
  });
  addImage(s, manifest, "ceres", { left: 106, top: 300, width: 500, height: 500 }, { fit: "contain", name: "ceres-image" });
  addText(s, "Ceres", { left: 138, top: 816, width: 300, height: 46 }, {
    name: "ceres-label",
    size: 34,
    bold: true,
    typeface: F.display,
    color: C.ink,
  });
  addText(s, "a dwarf planet in the asteroid belt", { left: 140, top: 866, width: 390, height: 34 }, {
    name: "ceres-note",
    size: 22,
    color: "#536174",
  });

  const lanes = [
    ["Asteroid belt", "rocky fragments between Mars and Jupiter", C.rust],
    ["Kuiper Belt", "icy bodies beyond Neptune, including Pluto", C.blue],
    ["Comets", "ice-rich messengers with long looping paths", C.teal],
    ["Moons", "worlds around worlds, some with oceans", C.violet],
  ];
  lanes.forEach(([head, body, color], i) => {
    const top = 306 + i * 132;
    addRule(s, 778, top + 10, 160, color, 6);
    addText(s, head, { left: 980, top: top - 2, width: 360, height: 38 }, {
      name: `small-head-${i + 1}`,
      size: 28,
      bold: true,
      color: C.ink,
    });
    addText(s, body, { left: 980, top: top + 44, width: 610, height: 54 }, {
      name: `small-body-${i + 1}`,
      size: 24,
      color: "#536174",
    });
  });
  addText(s, "The small stuff is not debris in the story. It is the archive.", { left: 778, top: 870, width: 780, height: 50 }, {
    name: "small-landing",
    size: 30,
    bold: true,
    color: C.amber,
  });
  addFooter(s, "Images and topic references: NASA/JPL. Small-body categories simplified for teaching.", "#667085");
  s.speakerNotes.text = "Use Ceres as a concrete example that small worlds can be scientifically rich.";
}

function whyItMatters(p, manifest) {
  const s = p.slides.add();
  setBg(s, C.space);
  starField(s, 59, "#DCF7FF", 42, [
    { left: 78, top: 80, width: 960, height: 330 },
    { left: 88, top: 500, width: 720, height: 360 },
  ]);
  addImage(s, manifest, "earth", { left: 1040, top: 108, width: 700, height: 700 }, { fit: "contain", name: "closing-earth" });
  addText(s, "The point of the map is us", { left: 86, top: 92, width: 980, height: 166 }, {
    name: "slide-title",
    size: 76,
    bold: true,
    typeface: F.display,
    color: C.white,
  });
  addText(s, "Studying the solar system turns big human questions into places we can visit, measure, and compare.", { left: 92, top: 292, width: 840, height: 94 }, {
    name: "closing-thesis",
    size: 34,
    color: C.cream,
  });
  const ideas = [
    ["Origins", "How did planets assemble?"],
    ["Life", "Where can chemistry become biology?"],
    ["Climate", "What makes a world stable or hostile?"],
    ["Exploration", "How do we move farther without losing home?"],
  ];
  ideas.forEach(([head, body], i) => {
    const left = 96 + (i % 2) * 420;
    const top = 514 + Math.floor(i / 2) * 168;
    addRule(s, left, top, 118, [C.gold, C.teal, C.rust, C.blue][i], 5);
    addText(s, head, { left, top: top + 24, width: 320, height: 42 }, {
      name: `closing-head-${i + 1}`,
      size: 30,
      bold: true,
      color: C.white,
    });
    addText(s, body, { left, top: top + 72, width: 350, height: 58 }, {
      name: `closing-body-${i + 1}`,
      size: 22,
      color: C.mist,
    });
  });
  addRule(s, 1044, 840, 604, C.teal, 4);
  addText(s, "A solar system is a mirror with eight planets, countless small worlds, and one home.", { left: 1044, top: 876, width: 610, height: 74 }, {
    name: "closing-line",
    size: 28,
    bold: true,
    color: C.white,
  });
  addFooter(s, "Images and data: NASA/JPL/GSFC. Closing synthesis by deck author.");
  s.speakerNotes.text = "Close by making the science feel connected to origin, habitability, climate, and exploration.";
}

async function buildDeck() {
  await mkdir(srcDir, { recursive: true });
  await mkdir(scratchDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await rm(sourcePreviewDir, { recursive: true, force: true });
  await rm(pptxPreviewDir, { recursive: true, force: true });
  await mkdir(sourcePreviewDir, { recursive: true });
  await mkdir(pptxPreviewDir, { recursive: true });

  const manifest = await downloadAssets();
  const presentation = Presentation.create({ slideSize: { width: W, height: H } });

  cover(presentation, manifest);
  sunAnchor(presentation, manifest);
  eightPlanets(presentation, manifest);
  distanceSlide(presentation);
  innerWorlds(presentation, manifest);
  outerWorlds(presentation, manifest);
  smallWorlds(presentation, manifest);
  whyItMatters(presentation, manifest);

  const hydratedImages = await hydrateLocalImages(presentation);

  for (let i = 0; i < presentation.slides.items.length; i += 1) {
    const blob = await presentation.slides.items[i].export({ format: "png", scale: 1 });
    await saveBlob(blob, path.join(sourcePreviewDir, `slide-${String(i + 1).padStart(2, "0")}.png`));
  }

  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await pptxBlob.save(outputPptx);

  const imported = await PresentationFile.importPptx(await readFile(outputPptx));
  for (let i = 0; i < imported.slides.items.length; i += 1) {
    const blob = await imported.slides.items[i].export({ format: "png", scale: 1 });
    await saveBlob(blob, path.join(pptxPreviewDir, `slide-${String(i + 1).padStart(2, "0")}.png`));
  }

  await writeFile(path.join(scratchDir, "source-inspect.json"), `${JSON.stringify(await presentation.inspect({ include: "slides elements" }), null, 2)}\n`, "utf8");
  await writeFile(path.join(scratchDir, "pptx-inspect.json"), `${JSON.stringify(await imported.inspect({ include: "slides elements" }), null, 2)}\n`, "utf8");

  const previewFiles = Array.from({ length: imported.slides.items.length }, (_, i) =>
    path.join(pptxPreviewDir, `slide-${String(i + 1).padStart(2, "0")}.png`)
  );
  await makeContactSheet(previewFiles, path.join(scratchDir, "contact-sheet.png"));

  const report = {
    exportedDeck: outputPptx,
    sourcePreviews: sourcePreviewDir,
    pptxPreviews: pptxPreviewDir,
    contactSheet: path.join(scratchDir, "contact-sheet.png"),
    slideCount: imported.slides.count,
    hydratedImages,
    assetSource: "NASA Image and Video Library / NASA Solar System materials",
    notes: [
      "Slides were rendered from source and from the saved PPTX import for parity inspection.",
      "The planet lineup is not to scale by design; distance scale is handled on slide 4.",
    ],
  };
  await writeFile(path.join(scratchDir, "build-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
}

async function makeContactSheet(files, outputPath) {
  const thumbW = 480;
  const thumbH = 270;
  const gap = 22;
  const labelH = 34;
  const cols = 2;
  const rows = Math.ceil(files.length / cols);
  const width = cols * thumbW + (cols + 1) * gap;
  const height = rows * (thumbH + labelH) + (rows + 1) * gap;
  const composites = [];

  for (let i = 0; i < files.length; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const left = gap + col * (thumbW + gap);
    const top = gap + row * (thumbH + labelH + gap);
    const thumb = await sharp(files[i]).resize(thumbW, thumbH).png().toBuffer();
    const label = await sharp({
      create: {
        width: thumbW,
        height: labelH,
        channels: 4,
        background: "#111827",
      },
    })
      .composite([{
        input: Buffer.from(
          `<svg width="${thumbW}" height="${labelH}" xmlns="http://www.w3.org/2000/svg"><text x="14" y="23" font-family="Arial" font-size="18" fill="#E5E7EB">Slide ${i + 1}</text></svg>`
        ),
        top: 0,
        left: 0,
      }])
      .png()
      .toBuffer();
    composites.push({ input: thumb, left, top });
    composites.push({ input: label, left, top: top + thumbH });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#05070D",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

buildDeck().catch((error) => {
  console.error(error);
  process.exit(1);
});
