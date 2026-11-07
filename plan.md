# Student Competition Board — implementation plan

## Product and implementation

A responsive student-facing board presents the latest competitions discovered by the Student Council Academic Division. Each listing includes the competition title, description, deadline, and flyer. Listings persist between visits in the project's managed MySQL database and are ordered with current opportunities first, followed by expired listings.

Immediately before the homepage poster carousel, display the exact form notice “Before joining any of these competitions, please fill the following form: https://bit.ly/48GwrMu” with a clickable URL. Beside it, render a separate yellow sticky note with a visible pushpin and the text “Note: Keep in mind, if a competition requires a permission letter (surat keterangan), CONTACT THE ACADEMIC TEAM 1-2 weeks before the competition registration ends”. Bold only the words “CONTACT THE ACADEMIC TEAM 1-2 weeks before the competition registration ends”.

Academic Division Login opens a password form. After the server verifies the supplied passcode from a protected project environment value, the same modal transitions into the editor desk instead of closing. The editor modal contains the flyer-image upload, description, competition-title, and deadline fields, plus a button labeled “Removal” that opens controls for all uploaded competitions. A short-lived HttpOnly cookie contains a random opaque session token; only its SHA-256 hash and expiry are stored in the managed database. HTTPS Preview uses `SameSite=None; Secure; Partitioned` where supported. If an embedded browser still blocks that cookie, the login response also places the same short-lived token in tab-scoped `sessionStorage` and sends it through a dedicated session header; the server validates it against the same hashed database session and expiry. Plain HTTP local development keeps its local cookie settings. Exit Academic Mode revokes the stored editor session and clears both cookie and tab-scoped fallback. As with any shared passcode, anyone who knows it can edit, so it should be shared only with division members.

Authorized editors can submit a title, description, deadline, and flyer image through the editor modal. The server validates inputs, image type and size, verifies the editor session, uploads the image to project object storage, and then stores the stable flyer address alongside the listing. The board exposes only public competition information. The “Removal” view lists every uploaded competition with a button for removing it; clicking that button removes the selected competition from the persistent board regardless of deadline. The server still requires a valid editor session and an existing competition ID. Removing a competition deletes its listing record, not the stored image bytes.

The project uses its initialized React/TypeScript frontend, Express/tRPC server, Drizzle ORM, and managed database. A protected environment secret supplies the password to the backend. The project storage API provides stable `/manus-storage/...` image paths.

## Project structure

- `client/src/pages/Home.tsx`: public board, responsive poster carousel and listings, password-to-editor modal flow, Removal view, and exit mode.
- `client/src/index.css`: visual system and responsive layout.
- `client/src/App.tsx`: existing single-page route remains the home board.
- `server/routers.ts` and `server/competitionRouter.ts`: public list, password verification, session exit, image upload, and authorized create/delete procedures.
- `server/db.ts`: competition queries and persistence, plus editor-session persistence.
- `drizzle/schema.ts` and `drizzle/`: competition and editor-session tables with additive migrations; competition title, description, deadline, flyer address, timestamps, and hashed session tokens with expiry.
- `client/public/manus-routes.json`: current route manifest for the home page.
- `plan.md` and `TODO.md`: implementation decisions and delivery status.

## Design direction

Three uncommon candidates (low prior likelihoods):
- **Collegiate field notes** — archival academic typography with warm paper and vivid botanical green; probability 0.07.
- **Neon competition circuit** — dark electronic scoreboard with electric cyan highlights; probability 0.04.
- **Playful cut-paper campus zine** — layered paper shapes, hand-stamped marks, and bright primary accents; probability 0.02.

**Chosen style: Collegiate field notes.**

- **Design Movement:** contemporary editorial inspired by university journals, library cards, and annotated field guides.
- **Core Principles:** make deadlines immediately scannable; keep the board welcoming and calm; treat every flyer as authentic source material; keep editing actions unmistakably separate from student browsing.
- **Color Philosophy:** use a bright, mostly white canvas with dark ink and fresh green interface accents; let the uploaded competition flyers supply the strong colors and visual variety.
- **Layout Paradigm:** lead with a centered headline and a wide, horizontal row of large portrait competition posters that float across the homepage; place the complete indexed listings and filters below.
- **Signature Elements:** rounded flyer posters; readable dark-gradient title captions over each poster; a softly floating, horizontally scrollable row that hints at more competitions off-screen.
- **Interaction Philosophy:** students can swipe or scroll through posters, then jump to a listing for its full description and deadline; password entry and publication remain deliberate, and deletion is available only to authenticated editors for uploaded listings.
- **Animation:** cards bob gently at staggered intervals and lift slightly on hover; respect reduced-motion preferences and keep titles legible over poster art.
- **Typography System:** use a confident editorial serif for the main headline and competition titles, paired with a neutral sans-serif for descriptions, dates, controls, and interface labels; establish clear title, section, body, and caption tiers.
- **Brand Essence:** the Student Council's reliable field guide to the next chance to compete; **curious, organized, encouraging**.
- **Brand Voice:** concise and student-minded. Example lines: “Find your next challenge.” “Deadlines at a glance. Opportunities in reach.”
- **Wordmark & Logo:** compact monogram combining an open-book outline with a sprouting leaf, used as a small section mark alongside the board name.
- **Signature Brand Color:** leaf green, used consistently for active opportunity markers and the Academic Division identity.

## Material constraints

- Do not expose the passcode or storage API credential in client code, logs, or public listings.
- Use the existing server and database capabilities; avoid browser-only or volatile listing state.
- Validate and limit image uploads, and store stable asset references instead of image bytes in database rows.
- Do not grant edit access based on client state alone; every mutation checks a server-issued session.
- The initialized database is shared by development and publication, so add the schema non-destructively and do not seed fake competitions.
