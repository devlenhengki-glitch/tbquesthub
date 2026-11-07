# Student Competition Board — implementation plan

## Product and implementation

A responsive student-facing board presents the latest competitions discovered by the Student Council Academic Division. Each listing includes the competition title, description, deadline, and flyer. Listings persist between visits in the project's managed MySQL database and are ordered with current opportunities first, followed by expired listings.

Academic Division Login opens a password form for the supplied passcode (the supplied passcode, held in a protected environment secret). The credential is verified by the server using a protected project environment value; it is not embedded in browser code. A short-lived, signed, HttpOnly editor-session cookie protects create, upload, and delete operations. Cookie attributes support the public HTTPS Preview iframe (`SameSite=None; Secure`) while allowing plain HTTP local development. Exit Academic Mode clears the editor session. As with any shared passcode, anyone who knows it can edit, so it should be shared only with division members.

Authorized editors can submit a title, description, deadline, and flyer image. The server validates inputs, image type and size, verifies the editor session, uploads the image to project object storage, and then stores the stable flyer address alongside the listing. The board exposes only public competition information. In Academic Mode, editors can delete entries only after their deadline has passed; the server also checks the deadline so the restriction cannot be bypassed from the interface. Deletion removes the competition record from the board; it does not claim to erase the stored image bytes.

The project uses its initialized React/TypeScript frontend, Express/tRPC server, Drizzle ORM, and managed database. A protected environment secret will supply the password to the backend. The project storage API will provide stable `/manus-storage/...` image paths.

## Project structure

- `client/src/pages/Home.tsx`: public board, responsive competition list, Academic Division Login, editor form and exit mode.
- `client/src/index.css`: visual system and responsive layout.
- `client/src/App.tsx`: existing single-page route remains the home board.
- `server/routers.ts` and a focused competition router/module: public list, password verification, session exit, image upload and authorized create/delete procedures.
- `server/db.ts`: competition queries and persistence.
- `drizzle/schema.ts` and `drizzle/`: competition table and additive migration, with title, description, deadline, flyer address, and timestamps.
- `public/manus-routes.json`: current route manifest for the home page.
- `plan.md` and `TODO.md`: implementation decisions and delivery status.

## Design direction

Three uncommon candidates (low prior likelihoods):
- **Collegiate field notes** — archival academic typography with warm paper and vivid botanical green; probability 0.07.
- **Neon competition circuit** — dark electronic scoreboard with electric cyan highlights; probability 0.04.
- **Playful cut-paper campus zine** — layered paper shapes, hand-stamped marks, and bright primary accents; probability 0.02.

**Chosen style: Collegiate field notes.**

- **Design Movement:** contemporary editorial inspired by university journals, library cards, and annotated field guides.
- **Core Principles:** make deadlines immediately scannable; keep the board welcoming and calm; treat every flyer as authentic source material; keep editing actions unmistakably separate from student browsing.
- **Color Philosophy:** warm paper and ink establish trust and legibility; an ownable vivid leaf-green marks active opportunities and Academic Division actions; muted rust signals a passed deadline without alarm.
- **Layout Paradigm:** an asymmetric editorial masthead with a narrow index rail and spacious, vertically stacked opportunity cards rather than a generic centered dashboard grid.
- **Signature Elements:** hand-numbered opportunity labels; fine ruled dividers and paper-like card edges; pill-shaped deadline stamps.
- **Interaction Philosophy:** clear, direct controls; password entry and publication are deliberate; delete requires a final confirmation and is only offered for expired listings.
- **Animation:** restrained fade/slide on first render and subtle hover lift on cards; respect reduced-motion preferences; never animate data so heavily that deadlines are hard to read.
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
