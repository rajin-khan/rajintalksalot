import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.resolve(projectRoot, "content");
const sourcePostsDir = path.join(contentRoot, "posts");
const logoInput = path.join(contentRoot, "brand/images/main-logo.png");
const outDir = path.resolve(projectRoot, "public/media");
const postsOut = path.join(outDir, "posts");
const widths = [720, 1080, 1600];

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPostMeta(postDir) {
  const metaPath = path.join(postDir, "meta.json");
  if (!(await fileExists(metaPath))) return null;
  return JSON.parse(await fs.readFile(metaPath, "utf8"));
}

async function optimizeSlide(input, outputStem) {
  for (const width of widths) {
    await sharp(input)
      .resize({ width, height: width, fit: "cover" })
      .webp({ quality: 78, effort: 5 })
      .toFile(`${outputStem}-${width}.webp`);
  }

  await sharp(input)
    .resize({ width: 1080, height: 1080, fit: "cover" })
    .avif({ quality: 58, effort: 6 })
    .toFile(`${outputStem}-1080.avif`);
}

await fs.rm(postsOut, { recursive: true, force: true });
await fs.mkdir(postsOut, { recursive: true });

const postEntries = await fs.readdir(sourcePostsDir, { withFileTypes: true });
let optimizedSlides = 0;

for (const entry of postEntries) {
  if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

  const postDir = path.join(sourcePostsDir, entry.name);
  const meta = await readPostMeta(postDir);
  if (!meta?.slug || !Array.isArray(meta.slides)) continue;

  const postOut = path.join(postsOut, meta.slug);
  await fs.mkdir(postOut, { recursive: true });

  for (const slide of meta.slides) {
    const stem = path.basename(slide, path.extname(slide));
    const input = path.join(postDir, "images", slide);
    if (!(await fileExists(input))) {
      throw new Error(`Missing slide image: ${path.relative(projectRoot, input)}`);
    }

    await optimizeSlide(input, path.join(postOut, stem));
    optimizedSlides += 1;
  }
}

await sharp(logoInput)
  .resize({ width: 900 })
  .webp({ quality: 82, effort: 5 })
  .toFile(path.join(outDir, "logo-900.webp"));
await sharp(logoInput)
  .resize({ width: 900 })
  .avif({ quality: 62, effort: 6 })
  .toFile(path.join(outDir, "logo-900.avif"));

console.log(`Optimized ${optimizedSlides} slides and logo into ${path.relative(projectRoot, outDir)}`);
