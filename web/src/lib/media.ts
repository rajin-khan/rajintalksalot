export const widths = [720, 1080, 1600] as const;
export const squareImageSize = 1080;

export function imageSet(imageId: string) {
  const normalizedId = imageId.replace(/^\/+/, "");

  return {
    avif: `/media/posts/${normalizedId}-1080.avif`,
    webp: widths.map((width) => ({
      width,
      src: `/media/posts/${normalizedId}-${width}.webp`
    })),
    fallback: `/media/posts/${normalizedId}-1080.webp`
  };
}

export function logoSet() {
  return {
    avif: "/media/logo-900.avif",
    webp: "/media/logo-900.webp",
    fallback: "/media/logo-900.webp",
    width: 900,
    height: 256
  };
}
