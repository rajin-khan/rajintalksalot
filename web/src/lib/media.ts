export const widths = [720, 1080, 1600] as const;
export const squareImageSize = 1080;

export function imageSet(stem: string) {
  return {
    avif: `/media/posts/${stem}-1080.avif`,
    webp: widths.map((width) => ({
      width,
      src: `/media/posts/${stem}-${width}.webp`
    })),
    fallback: `/media/posts/${stem}-1080.webp`
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
