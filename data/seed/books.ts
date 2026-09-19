import type { LibraryCategory } from "@/types";

// Catalogue metadata only. Every title here is in copyright, so there is no
// full text, no excerpt and no translation — just bibliographic facts, a
// one-line description in our own words, and topics to explore. Rights
// positions must be confirmed before any entry changes category
// (docs/spec.md §1.11).

export type Book = {
  id: string;
  title: string;
  author: string;
  year: number;
  category: LibraryCategory;
  languageIds: string[];
  tags: string[];
  summary: string;
  concepts: string[];
  verified: boolean;
};

export const books: Book[] = [
  {
    id: "facing-mount-kenya",
    title: "Facing Mount Kenya",
    author: "Jomo Kenyatta",
    year: 1938,
    category: "copyrighted",
    languageIds: ["gikuyu"],
    tags: ["Cultural history", "Ethnography"],
    summary: "An account of Gikuyu society, written by Kenyatta as an anthropology student in London.",
    concepts: ["Gikuyu social structure", "Land and agriculture", "Kinship", "Ceremonies"],
    verified: false,
  },
  {
    id: "weep-not-child",
    title: "Weep Not, Child",
    author: "Ngũgĩ wa Thiong'o",
    year: 1964,
    category: "copyrighted",
    languageIds: ["gikuyu"],
    tags: ["Novel"],
    summary: "A boy's hopes for education collide with the upheaval of the Emergency years.",
    concepts: ["Education", "Land", "The Emergency"],
    verified: false,
  },
  {
    id: "the-river-between",
    title: "The River Between",
    author: "Ngũgĩ wa Thiong'o",
    year: 1965,
    category: "copyrighted",
    languageIds: ["gikuyu"],
    tags: ["Novel"],
    summary: "Two ridges divided by a river, and by their responses to missionary Christianity.",
    concepts: ["Tradition and change", "Mission education", "Community leadership"],
    verified: false,
  },
  {
    id: "a-grain-of-wheat",
    title: "A Grain of Wheat",
    author: "Ngũgĩ wa Thiong'o",
    year: 1967,
    category: "copyrighted",
    languageIds: ["gikuyu"],
    tags: ["Novel"],
    summary: "A village's secrets surface in the days before Kenya's independence celebrations.",
    concepts: ["Independence", "Betrayal and loyalty", "Collective memory"],
    verified: false,
  },
  {
    id: "petals-of-blood",
    title: "Petals of Blood",
    author: "Ngũgĩ wa Thiong'o",
    year: 1977,
    category: "copyrighted",
    languageIds: [],
    tags: ["Novel"],
    summary: "A murder investigation opens onto the disappointments of post-independence Kenya.",
    concepts: ["Post-independence society", "Rural and urban life"],
    verified: false,
  },
  {
    id: "decolonising-the-mind",
    title: "Decolonising the Mind",
    author: "Ngũgĩ wa Thiong'o",
    year: 1986,
    category: "copyrighted",
    languageIds: ["gikuyu"],
    tags: ["Essays", "Language politics"],
    summary: "Essays arguing for African literature written in African languages.",
    concepts: ["Language and identity", "Writing in African languages"],
    verified: false,
  },
  {
    id: "the-promised-land",
    title: "The Promised Land",
    author: "Grace Ogot",
    year: 1966,
    category: "copyrighted",
    languageIds: ["dholuo"],
    tags: ["Novel"],
    summary: "A Luo couple migrate in search of better land, and find trouble waiting.",
    concepts: ["Migration", "Luo family life"],
    verified: false,
  },
  {
    id: "going-down-river-road",
    title: "Going Down River Road",
    author: "Meja Mwangi",
    year: 1976,
    category: "copyrighted",
    languageIds: [],
    tags: ["Novel", "Urban life"],
    summary: "Life among Nairobi's construction labourers in the 1970s.",
    concepts: ["Nairobi", "Working life"],
    verified: false,
  },
  {
    id: "coming-to-birth",
    title: "Coming to Birth",
    author: "Marjorie Oludhe Macgoye",
    year: 1986,
    category: "copyrighted",
    languageIds: ["dholuo"],
    tags: ["Novel"],
    summary: "A young woman's coming of age in Nairobi runs alongside the nation's own.",
    concepts: ["Women's lives", "Nairobi", "Independence era"],
    verified: false,
  },
  {
    id: "the-river-and-the-source",
    title: "The River and the Source",
    author: "Margaret A. Ogola",
    year: 1994,
    category: "copyrighted",
    languageIds: ["dholuo"],
    tags: ["Novel", "Family saga"],
    summary: "Four generations of women, from a Luo homestead to modern Kenya.",
    concepts: ["Luo traditions", "Generational change", "Women's lives"],
    verified: false,
  },
  {
    id: "one-day-i-will-write-about-this-place",
    title: "One Day I Will Write About This Place",
    author: "Binyavanga Wainaina",
    year: 2011,
    category: "copyrighted",
    languageIds: [],
    tags: ["Memoir"],
    summary: "A memoir of growing up in Nakuru and becoming a writer.",
    concepts: ["Memoir", "Language and belonging"],
    verified: false,
  },
  {
    id: "dust",
    title: "Dust",
    author: "Yvonne Adhiambo Owuor",
    year: 2013,
    category: "copyrighted",
    languageIds: [],
    tags: ["Novel"],
    summary: "A family in northern Kenya mourns a son, and the country's buried history comes with him.",
    concepts: ["Northern Kenya", "Memory and silence"],
    verified: false,
  },
];
