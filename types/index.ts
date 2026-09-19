export type LanguageFamilyId = "bantu" | "nilotic" | "cushitic" | "other";

export type LanguageFamily = {
  id: LanguageFamilyId;
  name: string;
  description: string;
};

/** How much data we actually hold for a language. Shown honestly in the UI. */
export type CoverageTier = "full" | "developing" | "heritage";

export type LanguageStatus = "active" | "endangered" | "revitalization";

export type ConfidenceTier =
  | "verified"
  | "community_verified"
  | "corpus_supported"
  | "machine_generated"
  | "ai_suggested"
  | "not_available";

export type LibraryCategory =
  | "public_domain"
  | "open_licence"
  | "licensed"
  | "copyrighted";

export type Source = {
  id: string;
  sourceType: string;
  title: string;
  url?: string;
  license?: string;
};

export type LanguageVariety = {
  id: string;
  name: string;
  nativeName?: string;
  iso639_3?: string;
};

export type Language = {
  /** URL slug, used by /languages/[language] */
  id: string;
  name: string;
  nativeName?: string;
  iso639_3?: string;
  family: LanguageFamilyId;
  status: LanguageStatus;
  coverage: CoverageTier;
  /** One of the deep-supported launch languages. */
  isFocus?: boolean;
  /** Entry is a cluster of related varieties (e.g. Luhya, Kalenjin). */
  isCluster?: boolean;
  /** Set when this entry is a member of a cluster. */
  parentId?: string;
  varieties?: LanguageVariety[];
  regions: string[];
  speakers?: number;
  description: string;
  sources: Source[];
  /** Registry facts have been checked against a cited source. */
  verified: boolean;
};

export type ProficiencyLevel = "beginner" | "intermediate" | "advanced";
