import { posts } from "../data/posts";
import { siteUrl } from "../lib/seo";

export const prerender = true;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function GET({ site }: { site?: URL }) {
  const origin = site?.origin ?? siteUrl;
  const routes = [
    {
      path: "/",
      lastmod: posts.reduce((latest, post) => (post.date > latest ? post.date : latest), posts[0]?.date ?? "")
    },
    {
      path: "/about/",
      lastmod: posts.reduce((latest, post) => (post.date > latest ? post.date : latest), posts[0]?.date ?? "")
    },
    ...posts.map((post) => ({
      path: `/posts/${post.slug}/`,
      lastmod: post.date
    }))
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes
  .map(({ path, lastmod }) => `  <url>
    <loc>${xmlEscape(`${origin}${path}`)}</loc>
    ${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ""}
  </url>`)
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
