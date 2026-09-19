import { books, type Book } from "@/data/seed/books";
import type { LibraryCategory } from "@/types";

export type { Book };

export const categoryLabels: Record<LibraryCategory, { label: string; access: string }> = {
  public_domain: { label: "Public domain", access: "Full text may be available." },
  open_licence: { label: "Open licence", access: "Full text available under its licence terms." },
  licensed: { label: "Licensed", access: "Available with permission from the rights holder." },
  copyrighted: { label: "In copyright", access: "Catalogue entry only. Find the book through a library or bookseller." },
};

export async function listBooks(): Promise<Book[]> {
  return [...books].sort((a, b) => a.year - b.year);
}

export async function getBook(id: string): Promise<Book | undefined> {
  return books.find((b) => b.id === id);
}

/** External catalogue search, never a hosted copy. */
export function findBookUrl(book: Book): string {
  return `https://openlibrary.org/search?q=${encodeURIComponent(`${book.title} ${book.author}`)}`;
}
