import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceDir = path.resolve(projectRoot, "../rajintalksalot/posts");
const outDir = path.resolve(projectRoot, "public/media");
const postsOut = path.join(outDir, "posts");
const widths = [720, 1080, 1600];
const allowedPosts = new Set(["1", "2", "3", "4", "5", "6", "8"]);

await fs.mkdir(postsOut, { recursive: true });

const files = await fs.readdir(sourceDir);
const slideFiles = files
  .filter((file) => /^[1-9][a-z]\.png$/.test(file))
  .filter((file) => allowedPosts.has(file[0]))
  .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

for (const file of slideFiles) {
  const stem = path.basename(file, ".png");
  const input = path.join(sourceDir, file);

  for (const width of widths) {
    await sharp(input)
      .resize({ width, height: width, fit: "cover" })
      .webp({ quality: 78, effort: 5 })
      .toFile(path.join(postsOut, `${stem}-${width}.webp`));
  }

  await sharp(input)
    .resize({ width: 1080, height: 1080, fit: "cover" })
    .avif({ quality: 58, effort: 6 })
    .toFile(path.join(postsOut, `${stem}-1080.avif`));
}

const logoInput = path.join(sourceDir, "main logo.png");
await sharp(logoInput)
  .resize({ width: 900 })
  .webp({ quality: 82, effort: 5 })
  .toFile(path.join(outDir, "logo-900.webp"));
await sharp(logoInput)
  .resize({ width: 900 })
  .avif({ quality: 62, effort: 6 })
  .toFile(path.join(outDir, "logo-900.avif"));

console.log(`Optimized ${slideFiles.length} slides and logo into ${path.relative(projectRoot, outDir)}`);
