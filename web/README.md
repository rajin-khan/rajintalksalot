# RAJINTALKSALOT Web

Self-contained Astro site for RAJINTALKSALOT.

## Commands

```bash
pnpm install
pnpm run optimize:images
pnpm run dev
pnpm run build
```

## Content Structure

```text
content/
  brand/
    images/
      main-logo.png
  posts/
    post-slug/
      meta.json
      content.md
      images/
        1a.png
        1b.png
```

`meta.json` controls the post title, order, date, Instagram URL, and slide order:

```json
{
  "id": 8,
  "slug": "vincent-van-gogh",
  "title": "Vincent Van Gogh",
  "series": "Not Gatekeeping",
  "date": "2026-05-10",
  "instagramUrl": "https://www.instagram.com/rajintalksalot/p/DYKhsFJmk73/",
  "slides": ["8a.png", "8b.png", "8c.png"]
}
```

Write the caption/body in `content.md`. Add post images to that post's `images/` folder, then list the image filenames in `meta.json` in the exact carousel order.

Optimized images are generated into `public/media` and are rebuilt from `content/` by `pnpm run optimize:images`.
