import { siteUrl } from "../lib/seo";

export const prerender = true;

export function GET({ site }: { site?: URL }) {
  const origin = site?.origin ?? siteUrl;

  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      `Sitemap: ${origin}/sitemap.xml`
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}
