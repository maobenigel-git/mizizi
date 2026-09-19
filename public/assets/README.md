# Assets

Everything in this folder is served at `/assets/<file>` and appears in the app as soon as the
file exists (refresh the page). A missing file just leaves its slot empty.

| File          | Where it shows                                                        |
|---------------|-----------------------------------------------------------------------|
| `bghome.png`  | Main background of the Home dashboard                                 |
| `logo.png`    | Sidebar and the welcome screen                                        |
| `luo.png`     | Dholuo character: Home, Learn, the Dholuo language and culture pages  |
| `kikuyu.png`  | Gikuyu character: same places, for Gikuyu                             |
| `maasai.png`  | Maasai character: same places, for Maasai                             |
| `swahili.png` | Kiswahili character: same places, for Kiswahili                       |

## Adding or replacing artwork

- Already transparent? Save it straight into this folder.
- Has a white, grey or checkerboard background? Save the original into `assets-src/` (repo root)
  and run `npm run assets`. That removes the background, trims the margins and writes the result
  here. `bghome` is copied as-is.
- A character for another language: add one line to `lib/assets.ts`.
