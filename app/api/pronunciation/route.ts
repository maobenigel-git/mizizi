/** Record-and-compare scoring is v2 (docs/spec.md §2.4); v1 only plays native audio. */
export async function POST() {
  return Response.json(
    { error: "not_implemented", message: "Pronunciation scoring arrives in v2 for the five focus languages." },
    { status: 501 },
  );
}
