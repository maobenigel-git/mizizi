/*
 * The localStorage key for the light/dark choice. Its own module because the
 * root layout (a server component) inlines it into the pre-paint script: a
 * constant imported from a "use client" file arrives on the server as a client
 * reference, not a string, and the script ended up reading `undefined`.
 */
export const THEME_KEY = "mizizi-theme";
