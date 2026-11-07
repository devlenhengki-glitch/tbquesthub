import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileImage,
  Leaf,
  LockKeyhole,
  LogOut,
  Plus,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Competition = {
  id: number;
  title: string;
  description: string;
  deadline: string;
  flyerUrl: string;
  createdAt: Date;
};

const todayUtc = () => new Date().toISOString().slice(0, 10);
const formatDate = (value: string) => new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date(`${value}T12:00:00`));
const initialsFor = (index: number) => String(index + 1).padStart(2, "0");

function daysUntil(deadline: string) {
  const target = new Date(`${deadline}T00:00:00.000Z`).getTime();
  const start = new Date(`${todayUtc()}T00:00:00.000Z`).getTime();
  return Math.ceil((target - start) / 86_400_000);
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read that flyer."));
    reader.onerror = () => reject(new Error("Could not read that flyer."));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const utils = trpc.useUtils();
  const competitionsQuery = trpc.competitions.list.useQuery();
  const editorStatusQuery = trpc.competitions.editorStatus.useQuery();
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [editorModalView, setEditorModalView] = useState<"login" | "form" | "removal">("login");
  const [password, setPassword] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "open" | "past">("all");

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (!editorModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditorModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editorModalOpen]);

  const loginMutation = trpc.competitions.login.useMutation({
    onSuccess: async result => {
      try { sessionStorage.setItem("academic-editor-session", result.sessionToken); } catch { /* HttpOnly cookie remains available */ }
      setPassword("");
      const status = await editorStatusQuery.refetch();
      if (!status.data?.editor) {
        toast.error("The editor session could not be confirmed. Please try again.");
        return;
      }
      setEditorModalView("form");
      toast.success("Academic Mode is on.");
    },
    onError: error => toast.error(error.message),
  });
  const logoutMutation = trpc.competitions.logout.useMutation({
    onSuccess: async () => {
      try { sessionStorage.removeItem("academic-editor-session"); } catch { /* Continue with server-side logout */ }
      await editorStatusQuery.refetch();
      setEditorModalOpen(false);
      setEditorModalView("login");
      toast.success("You’re back in visitor mode.");
    },
    onError: error => toast.error(error.message),
  });
  const createMutation = trpc.competitions.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      setDeadline("");
      setSelectedFile(null);
      await utils.competitions.list.invalidate();
      setEditorModalOpen(false);
      setEditorModalView("form");
      toast.success("Competition added to the board.");
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.competitions.deleteExpired.useMutation({
    onSuccess: async () => {
      await utils.competitions.list.invalidate();
      toast.success("Expired competition removed.");
    },
    onError: error => toast.error(error.message),
  });

  const editor = editorStatusQuery.data?.editor === true;
  const competitions = (competitionsQuery.data ?? []) as Competition[];
  const now = todayUtc();
  const expiredCompetitions = competitions.filter(item => item.deadline < now);
  const activeCount = competitions.filter(item => item.deadline >= now).length;
  const pastCount = competitions.length - activeCount;
  const featuredCompetitions = competitions.slice(0, 12);
  const visibleCompetitions = useMemo(() => {
    return competitions.filter(item => {
      if (activeFilter === "open") return item.deadline >= now;
      if (activeFilter === "past") return item.deadline < now;
      return true;
    });
  }, [competitions, activeFilter, now]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.error("Choose the competition flyer image first.");
      return;
    }
    if (selectedFile.size > 8 * 1024 * 1024) {
      toast.error("Flyer images must be 8 MB or smaller.");
      return;
    }
    try {
      const flyerDataUrl = await fileAsDataUrl(selectedFile);
      createMutation.mutate({ title, description, deadline, flyerDataUrl });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that flyer.");
    }
  };

  const removeCompetition = (competition: Competition) => {
    if (competition.deadline >= todayUtc()) return;
    const confirmed = window.confirm(`Remove “${competition.title}” from the competition board?`);
    if (confirmed) deleteMutation.mutate({ id: competition.id });
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <a href="#top" className="brand-lockup" aria-label="Student Competition Board home">
          <span className="brand-mark"><BookOpen size={22} strokeWidth={1.7} /><Leaf className="brand-leaf" size={12} /></span>
          <span className="brand-name">The Opportunity <b>Index</b></span>
        </a>
        <div className="header-context"><span className="context-dot" /> STUDENT COUNCIL <span className="context-divider">/</span> ACADEMIC DIVISION</div>
        <div className="header-actions">
          {editor ? (
            <>
              <span className="mode-pill"><span /> ACADEMIC MODE</span>
              <button className="button button-dark header-button" onClick={() => { setEditorModalView("form"); setEditorModalOpen(true); }}>
                <Plus size={15} /> Editor Desk
              </button>
            </>
          ) : (
            <button className="button button-dark header-button" onClick={() => { setEditorModalView("login"); setEditorModalOpen(true); }}>
              <LockKeyhole size={15} /> Academic Division Login
            </button>
          )}
        </div>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy hero-copy-centered">
            <div className="eyebrow"><span className="eyebrow-rule" /> ACADEMIC DIVISION PICKS</div>
            <h1 className="poster-hero-title">Most wanted.<br /><em>Worth joining.</em></h1>
            <p className="hero-description">The latest competitions, collected in one place. Find a flyer that sparks something.</p>
          </div>
          <section className="poster-carousel" aria-label="Latest competition flyers">
            {competitionsQuery.isLoading ? (
              <div className="poster-empty-state"><span className="loading-mark" />Gathering the latest flyers…</div>
            ) : featuredCompetitions.length ? (
              <>
                <div className="poster-track">
                  {featuredCompetitions.map((competition, index) => {
                    const expired = competition.deadline < todayUtc();
                    const days = daysUntil(competition.deadline);
                    return (
                      <a
                        className="poster-card"
                        href={`#competition-${competition.id}`}
                        key={competition.id}
                        aria-label={`View details for ${competition.title}`}
                        style={{ "--poster-delay": `${(index % 5) * -0.8}s` } as React.CSSProperties}
                      >
                        <img src={competition.flyerUrl} alt="" loading="lazy" />
                        <span className="poster-image-wash" />
                        <span className="poster-topline"><span>{expired ? "PAST DEADLINE" : days <= 7 ? "CLOSING SOON" : "OPEN NOW"}</span><span>{initialsFor(index)}</span></span>
                        <span className="poster-copy">
                          <span className="poster-kicker">STUDENT COMPETITION</span>
                          <strong>{competition.title}</strong>
                          <span className="poster-deadline">DEADLINE · {formatDate(competition.deadline)}</span>
                        </span>
                      </a>
                    );
                  })}
                </div>
                <div className="poster-carousel-hint"><span>SCROLL OR SWIPE TO EXPLORE</span><span className="poster-hint-arrows">← &nbsp; →</span></div>
              </>
            ) : (
              <>
                <div className="poster-track poster-track-empty" role="list" aria-label="Empty competition poster slots">
                  {[1, 2, 3].map(slot => (
                    <div className={`poster-card poster-placeholder poster-placeholder-${slot}`} role="listitem" key={slot}>
                      <span className="poster-placeholder-art" aria-hidden="true"><BookOpen size={33} strokeWidth={1.3} /><Leaf size={16} /></span>
                      <span className="poster-topline"><span>ACADEMIC DIVISION</span><span>0{slot}</span></span>
                      <span className="poster-copy"><span className="poster-kicker">FLYER SLOT</span><strong>A new competition poster will appear here.</strong><span className="poster-deadline">WAITING FOR THE NEXT FIND</span></span>
                    </div>
                  ))}
                </div>
                <div className="poster-carousel-hint poster-empty-hint" role="status">No listings yet. Post the first competition in Academic Mode.</div>
              </>
            )}
          </section>
          <a className="hero-link hero-link-centered" href="#opportunities">Browse all competitions <ArrowRight size={17} /></a>
        </section>

        <section className="board-section" id="opportunities">
          <div className="board-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-rule" /> THE COMPETITION BOARD</div>
              <h2>Find your next challenge.</h2>
              <p className="section-intro">Good things are out there. Here are a few places to start.</p>
            </div>
            <div className="board-count" aria-live="polite">
              <span className="count-number">{competitionsQuery.isLoading ? "—" : String(activeCount).padStart(2, "0")}</span>
              <span className="count-label">OPEN<br />OPPORTUNITIES</span>
            </div>
          </div>

          <div className="board-layout">
            <aside className="index-rail">
              <div className="rail-heading">IN THIS INDEX</div>
              <button className={`rail-filter ${activeFilter === "all" ? "selected" : ""}`} onClick={() => setActiveFilter("all")}>
                <span>All competitions</span><span>{competitions.length.toString().padStart(2, "0")}</span>
              </button>
              <button className={`rail-filter ${activeFilter === "open" ? "selected" : ""}`} onClick={() => setActiveFilter("open")}>
                <span>Open now</span><span>{activeCount.toString().padStart(2, "0")}</span>
              </button>
              <button className={`rail-filter ${activeFilter === "past" ? "selected" : ""}`} onClick={() => setActiveFilter("past")}>
                <span>Past deadline</span><span>{pastCount.toString().padStart(2, "0")}</span>
              </button>
              <div className="rail-note"><span className="rail-note-icon"><CalendarDays size={16} /></span><p>Keep an eye on the deadline. Every great entry starts with showing up.</p></div>
              {editor && <button className="rail-add-link" onClick={() => { setEditorModalView("form"); setEditorModalOpen(true); }}><Plus size={15} /> Add a competition</button>}
            </aside>

            <div className="competition-feed">
              {editor && <div className="editor-banner"><span className="editor-banner-icon"><Check size={15} /></span><div><b>You’re in Academic Mode.</b><span>New opportunities you add will appear on the student board.</span></div></div>}
              {competitionsQuery.isLoading ? (
                <div className="feed-state"><span className="loading-mark" /> Gathering opportunities…</div>
              ) : competitionsQuery.isError ? (
                <div className="feed-state feed-error"><p>The board couldn’t load just now.</p><button className="text-button" onClick={() => competitionsQuery.refetch()}>Try again <ChevronRight size={15} /></button></div>
              ) : visibleCompetitions.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon"><BookOpen size={25} strokeWidth={1.5} /></span>
                  <div className="empty-kicker">NOTHING ON THIS PAGE—YET</div>
                  <h3>{activeFilter === "past" ? "No past deadlines." : activeFilter === "open" ? "No open competitions right now." : "The next opportunity is just around the corner."}</h3>
                  <p>{editor ? "Open the Editor Desk to add a listing, and students will find it here." : "The Academic Division is always looking. Check back for the next find."}</p>
                  {activeFilter !== "all" && <button className="text-button" onClick={() => setActiveFilter("all")}>View all competitions <ChevronRight size={15} /></button>}
                </div>
              ) : (
                <div className="competition-list">
                  {visibleCompetitions.map((competition, index) => {
                    const expired = competition.deadline < todayUtc();
                    const days = daysUntil(competition.deadline);
                    return (
                      <article className={`competition-card ${expired ? "is-expired" : ""}`} id={`competition-${competition.id}`} key={competition.id}>
                        <div className="competition-card-topline"><span className="record-number">OPPORTUNITY {initialsFor(index)}</span><span className={`status-stamp ${expired ? "status-past" : days <= 7 ? "status-soon" : "status-open"}`}>{expired ? "PAST DEADLINE" : days === 0 ? "DUE TODAY" : days <= 7 ? `${days} DAYS LEFT` : "OPEN NOW"}</span></div>
                        <div className="competition-card-content">
                          <a className="flyer-frame" href={competition.flyerUrl} target="_blank" rel="noreferrer" aria-label={`Open flyer for ${competition.title}`}>
                            <img src={competition.flyerUrl} alt={`Flyer for ${competition.title}`} loading="lazy" />
                            <span className="flyer-view"><FileImage size={14} /> VIEW FLYER</span>
                          </a>
                          <div className="competition-details">
                            <div className="deadline-label"><CalendarDays size={14} /> DEADLINE <span>·</span> {formatDate(competition.deadline)}</div>
                            <h3>{competition.title}</h3>
                            <p className="competition-description">{competition.description}</p>
                            <div className="card-footer">
                              <span className="posted-date"><Clock3 size={13} /> ADDED {new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(competition.createdAt))}</span>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

            </div>
          </div>
        </section>

      <section className="closing-note"><div className="closing-mark"><Leaf size={22} /></div><p>Made for the ones who are <em>ready to try.</em></p><span>STUDENT COUNCIL · ACADEMIC DIVISION</span></section>
      </main>
      <footer className="site-footer"><span>THE OPPORTUNITY INDEX</span><span>One good opportunity can change everything.</span><a href="#top">BACK TO TOP <ChevronRight size={13} className="back-arrow" /></a></footer>

      {editorModalOpen && <div className="modal-scrim" onMouseDown={event => { if (event.target === event.currentTarget) setEditorModalOpen(false); }}>
        <section className={`login-dialog ${editor ? "editor-dialog" : ""}`} role="dialog" aria-modal="true" aria-labelledby={editor ? "editor-modal-title" : "login-title"}>
          <button className="modal-close" aria-label={editor ? "Close editor modal" : "Close login dialog"} onClick={() => setEditorModalOpen(false)}><X size={18} /></button>
          {editor ? (
            <>
              <div className="editor-modal-heading">
                <div className="dialog-emblem"><BookOpen size={23} /><Leaf size={13} /></div>
                <div className="editor-modal-heading-copy">
                  <div className="eyebrow"><span className="eyebrow-rule" /> ACADEMIC MODE · EDITOR DESK</div>
                  <h2 id="editor-modal-title">{editorModalView === "removal" ? <>Clear a past<br /><em>opportunity.</em></> : <>Share a new<br /><em>competition.</em></>}</h2>
                  <p>{editorModalView === "removal" ? "Only competitions with passed deadlines can be removed." : "Add the flyer and details students need to take the next step."}</p>
                </div>
                <button className="button button-quiet removal-open-button" type="button" onClick={() => setEditorModalView(editorModalView === "removal" ? "form" : "removal")}>
                  {editorModalView === "removal" ? <ArrowRight size={15} className="back-arrow" /> : <Trash2 size={15} />}
                  {editorModalView === "removal" ? "Back to form" : "Removal"}
                </button>
              </div>

              {editorModalView === "removal" ? (
                <div className="removal-view">
                  {expiredCompetitions.length ? (
                    <ul className="removal-list">
                      {expiredCompetitions.map(competition => (
                        <li className="removal-item" key={competition.id}>
                          <img src={competition.flyerUrl} alt="" loading="lazy" />
                          <div className="removal-item-copy"><span>PAST DEADLINE · {formatDate(competition.deadline)}</span><strong>{competition.title}</strong></div>
                          <button className="delete-button" onClick={() => removeCompetition(competition)} disabled={deleteMutation.isPending}><Trash2 size={14} /> Remove</button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="removal-empty"><span className="empty-icon"><Check size={22} /></span><h3>Nothing to remove.</h3><p>Competitions will appear here after their deadlines have passed.</p></div>
                  )}
                  <div className="editor-modal-footer">
                    <span>Removal is limited to past-deadline listings.</span>
                    <button className="button button-quiet" type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}><LogOut size={15} /> {logoutMutation.isPending ? "Exiting…" : "Exit Academic Mode"}</button>
                  </div>
                </div>
              ) : (
                <form className="competition-form editor-competition-form" onSubmit={handleSubmit}>
                  <div className="form-row form-row-two">
                    <label className="form-field"><span>Competition title <i>REQUIRED</i></span><input required maxLength={140} value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. National Science Challenge" /></label>
                    <label className="form-field"><span>Registration deadline <i>REQUIRED</i></span><input type="date" required min={todayUtc()} value={deadline} onChange={event => setDeadline(event.target.value)} /></label>
                  </div>
                  <label className="form-field"><span>Description <i>REQUIRED</i></span><textarea required minLength={8} maxLength={4000} rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder="What is the competition about? Who can enter? Include the details students will want to know." /></label>
                  <div className="form-row flyer-upload-row">
                    <label className="form-field flyer-field"><span>Competition flyer <i>REQUIRED</i></span><span className="upload-control"><input type="file" accept="image/png,image/jpeg,image/webp" required={!selectedFile} onChange={event => setSelectedFile(event.target.files?.[0] ?? null)} /><span className="upload-icon"><UploadCloud size={18} /></span><span className="upload-copy"><b>{selectedFile ? selectedFile.name : "Choose a flyer image"}</b><small>PNG, JPG or WebP · up to 8 MB</small></span><span className="upload-action">BROWSE</span></span></label>
                    {previewUrl && <div className="upload-preview"><img src={previewUrl} alt="Preview of the selected flyer" /><button type="button" aria-label="Remove selected flyer" onClick={() => setSelectedFile(null)}><X size={14} /></button></div>}
                  </div>
                  <div className="editor-modal-footer">
                    <span>New listings appear immediately on the student board.</span>
                    <div className="editor-modal-footer-actions">
                      <button className="button button-quiet" type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}><LogOut size={15} /> {logoutMutation.isPending ? "Exiting…" : "Exit Academic Mode"}</button>
                      <button className="button button-green" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Publishing…" : "Publish competition"}<ArrowRight size={16} /></button>
                    </div>
                  </div>
                </form>
              )}
            </>
          ) : (
            <>
              <div className="dialog-emblem"><BookOpen size={23} /><Leaf size={13} /></div>
              <div className="eyebrow"><span className="eyebrow-rule" /> EDITOR ACCESS</div>
              <h2 id="login-title">A note from the<br /><em>Academic Division.</em></h2>
              <p>Enter the division passcode to add new opportunities and manage past competitions.</p>
              <form onSubmit={event => { event.preventDefault(); loginMutation.mutate({ password }); }}>
                <label className="form-field"><span>Division passcode</span><input autoFocus type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter passcode" /></label>
                <button className="button button-green dialog-submit" type="submit" disabled={loginMutation.isPending}>{loginMutation.isPending ? "Checking…" : "Enter Academic Mode"}<ArrowRight size={16} /></button>
              </form>
              <div className="dialog-footnote"><LockKeyhole size={13} /> This space is for Academic Division editors.</div>
            </>
          )}
        </section>
      </div>}
    </div>
  );
}
