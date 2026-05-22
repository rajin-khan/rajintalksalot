import fs from "node:fs";
import path from "node:path";

export type Post = {
  id: number;
  slug: string;
  title: string;
  series: string;
  date: string;
  instagramUrl: string;
  slides: string[];
  caption: string;
};

type PostMeta = Omit<Post, "caption" | "slides"> & {
  slides?: string[];
};

const contentRoot = path.resolve(import.meta.dirname, "../../content");
const postsRoot = path.join(contentRoot, "posts");

const imageExtensions = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp"]);

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as PostMeta;
}

function stripExtension(fileName: string) {
  return fileName.slice(0, -path.extname(fileName).length);
}

function readSlideFiles(postDir: string, meta: PostMeta) {
  if (Array.isArray(meta.slides) && meta.slides.length > 0) {
    return meta.slides;
  }

  const imagesDir = path.join(postDir, "images");
  if (!fs.existsSync(imagesDir)) return [];

  return fs
    .readdirSync(imagesDir)
    .filter((file) => imageExtensions.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

function readPost(folderName: string): Post | null {
  const postDir = path.join(postsRoot, folderName);
  const metaPath = path.join(postDir, "meta.json");
  const contentPath = path.join(postDir, "content.md");

  if (!fs.existsSync(metaPath) || !fs.existsSync(contentPath)) {
    return null;
  }

  const meta = readJson(metaPath);
  const slug = meta.slug || folderName;
  const slides = readSlideFiles(postDir, meta).map((fileName) => (
    `${slug}/${stripExtension(fileName)}`
  ));

  return {
    ...meta,
    slug,
    slides,
    caption: fs.readFileSync(contentPath, "utf8").trim()
  };
}

export const posts: Post[] = fs
  .readdirSync(postsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("_"))
  .map((entry) => readPost(entry.name))
  .filter((post): post is Post => Boolean(post))
  .sort((a, b) => a.id - b.id);

export function getPost(slug: string) {
  return posts.find((post) => post.slug === slug);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}
