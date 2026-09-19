// Artwork lives in public/assets and is referenced by filename only, so
// dropping a file in that folder is all it takes for it to appear.

export const HOME_BACKGROUND = "/assets/bghome.png";
export const LOGO = "/assets/logo.png";

const characters: Record<string, string> = {
  dholuo: "/assets/luo.png",
  gikuyu: "/assets/kikuyu.png",
  maasai: "/assets/maasai.png",
  kiswahili: "/assets/swahili.png",
};

/** Character art for a language, if one has been assigned. */
export function characterFor(languageId: string | undefined): string | undefined {
  return languageId ? characters[languageId] : undefined;
}
