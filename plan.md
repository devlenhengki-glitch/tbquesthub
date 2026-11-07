# Student Competition Board — implementation plan

## Product and implementation

A responsive student-facing board presents the latest competitions discovered by the Student Council Academic Division. Each listing includes the competition title, description, deadline, and flyer. Listings persist between visits in the project's managed MySQL database and are ordered with current opportunities first, followed by expired listings. The homepage visual direction shifts to the user's campus-tech reference: a dark navy-and-blue campus hero above cool pale-blue competition sections, while preserving the working board, sticky reminders, and Academic Division editor.

Immediately before the homepage poster carousel, display the exact form notice “Before joining any of these competitions, please fill the following form: https://bit.ly/48GwrMu” with a clickable URL. Beneath it, show two equally sized yellow sticky notes with visible red pushpins in a responsive row: the permission-letter reminder and a second team-contact note. The contact note says “MEET THE ACADEMIC TEAM”, “Contact Us:”, “0819-7757-0007 (Aaron)”, “0816-1866-635 (Enzo)”, “0815-1919-2108 (Nathan)”, and “0857-7575-9510 (William)” on separate lines; its heading is bold and its body text is larger. The permission note text matches the contact note body size, with only “CONTACT THE ACADEMIC TEAM 1-2 weeks before the competition registration ends” bolded.

After the competition board and before the footer, keep the About panel's exact copy “About TB QuestHub”, “A platform by students, for students.”, and “TB QuestHub is an initiative by the Student Council Academic Division to connect students with opportunities beyond the classroom.” with the reference-style center illustration. Remove the Stay Updated/email-signup column. Change the existing “Our Mission” control into a button that opens a responsive, closable dialog showing the user's full mission copy verbatim in two paragraphs; the dialog closes from its close control, backdrop, or Escape key.
The mission dialog displays “At TB QuestHub, our mission is to empower students to discover, pursue, and seize opportunities beyond the classroom. Through the Student Council Academic Division’s commitment to providing accessible and up-to-date information on competitions, we aim to help students develop their skills, explore their interests, gain valuable experiences, and build stronger portfolios for their future.” followed by “We believe that every student deserves the opportunity to grow, and that every great achievement begins with the willingness to try.”

Academic Division Login opens a password form. After the server verifies the supplied passcode from a protected project environment value, the same modal transitions into the editor desk instead of closing. The editor modal contains the flyer-image upload, description, competition-title, and deadline fields, plus a button labeled “Removal” that opens controls for all uploaded competitions. A short-lived HttpOnly cookie contains a random opaque session token; only its SHA-256 hash and expiry are stored in the managed database. HTTPS Preview uses `SameSite=None; Secure; Partitioned` where supported. If an embedded browser still blocks that cookie, the login response also places the same short-lived token in tab-scoped `sessionStorage` and sends it through a dedicated session header; the server validates it against the same hashed database session and expiry. Plain HTTP local development keeps its local cookie settings. Exit Academic Mode revokes the stored editor session and clears both cookie and tab-scoped fallback. As with any shared passcode, anyone who knows it can edit, so it should be shared only with division members.

Authorized editors can submit a title, description, deadline, and flyer image through the editor modal. The server validates inputs, image type and size, verifies the editor session, uploads the image to project object storage, and then stores the stable flyer address alongside the listing. The board exposes only public competition information. The “Removal” view lists every uploaded competition with a button for removing it; clicking that button removes the selected competition from the persistent board regardless of deadline. The server still requires a valid editor session and an existing competition ID. Removing a competition deletes its listing record, not the stored image bytes.

The project uses its initialized React/TypeScript frontend, Express/tRPC server, Drizzle ORM, and managed database. A protected environment secret supplies the password to the backend. The project storage API provides stable `/manus-storage/...` image paths.

## Project structure

- `client/src/pages/Home.tsx`: public board, responsive poster carousel and listings, password-to-editor modal flow, Removal view, exit mode, About TB QuestHub panel, and mission dialog.
- `client/src/index.css`: visual system, responsive layout, and reference-matched About/mission-dialog composition.
- `client/src/App.tsx`: existing single-page route remains the home board.
- `server/routers.ts` and `server/competitionRouter.ts`: public list, password verification, session exit, image upload, and authorized create/delete procedures.
- `server/db.ts`: competition queries and persistence, plus editor-session persistence.
- `drizzle/schema.ts` and `drizzle/`: competition and editor-session tables with additive migrations; competition title, description, deadline, flyer address, timestamps, and hashed session tokens with expiry.
- `client/public/manus-routes.json`: current route manifest for the home page.
- `plan.md` and `TODO.md`: implementation decisions and delivery status.

## Design direction

**Chosen style: Modern campus-tech showcase, guided by the supplied reference.**

- **Design Movement:** contemporary student-technology landing page with a bold campus hero and crisp competition marketplace cards.
- **Core Principles:** create a strong first-screen campus identity; keep text readable over the hero; use bright blue for calls to action; retain warm sticky-note reminders and clear editor separation.
- **Color Philosophy:** use deep navy and cobalt in the hero for focus and ambition, then shift to cool pale blue-gray content sections for calm scanning; preserve the warm yellow reminders as high-contrast practical notes.
- **Layout Paradigm:** a full-width split hero places the headline and copy on the left and an original campus-building image on the right; the poster carousel and full competition index follow on a light background, then a two-part About panel sits above the footer.
- **Signature Elements:** wide twilight campus photograph; translucent diagonal blue geometry and a subtle star glint; a lavender About panel with a student-silhouette illustration and a clean mission-dialog reveal.
- **Interaction Philosophy:** students can swipe or scroll through posters, jump to a listing for its full description and deadline, or open and dismiss the mission dialog; password entry and publication remain deliberate, and deletion is available only to authenticated editors for uploaded listings.
- **Animation:** keep the existing gentle poster float and hover lift; use only a restrained background shimmer, respect reduced-motion preferences, and avoid motion that competes with the hero copy.
- **Typography System:** use bold, oversized DM Sans for the hero headline and neutral sans-serif for descriptions, dates, controls, and interface labels; maintain clear section, body, and caption tiers.
- **Brand Essence:** the Student Council's reliable guide to the next chance to compete; **ambitious, clear, student-minded**.
- **Brand Voice:** concise and optimistic. Example lines: “Where Potential Meets Opportunity” and “Find your next challenge.”
- **Wordmark & Logo:** use the supplied TB QuestHub compass-and-wordmark artwork, remove its white background, and recolor it in high-contrast white/cobalt for the navy site header; use a navy/cobalt variant for the browser icon and project-logo metadata. Place the supplied school seal in its original colors as a compact secondary mark within the About illustration area.
- **Signature Brand Color:** cobalt blue, used for emphasis, active navigation, and primary calls to action.

## Material constraints

- Do not expose the passcode or storage API credential in client code, logs, or public listings.
- Use the existing server and database capabilities; avoid browser-only or volatile listing state.
- Validate and limit image uploads, and store stable asset references instead of image bytes in database rows.
- Do not grant edit access based on client state alone; every mutation checks a server-issued session.
- The initialized database is shared by development and publication, so add the schema non-destructively and do not seed fake competitions.
