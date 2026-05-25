export const siteName = "rajintalksalot";
export const siteUrl = "https://rajintalksalot.com";
export const defaultDescription = "Rajin's essays, art dives, and visual stories.";
export const defaultOgImage = "/og-image.png";
export const defaultOgImageAlt = "rajintalksalot visual archive cover";
export const ogImageWidth = 1200;
export const ogImageHeight = 630;

export function toAbsoluteUrl(pathname: string, base = siteUrl) {
  return new URL(pathname, base).toString();
}

export function excerpt(text: string, maxLength = 155) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const trimmed = normalized.slice(0, maxLength - 3).replace(/\s+\S*$/, "");
  return `${trimmed}...`;
}
