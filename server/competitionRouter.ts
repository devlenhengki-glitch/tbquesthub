import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createAcademicEditorSession,
  createCompetition,
  deleteAcademicEditorSession,
  deleteCompetition,
  getAcademicEditorSession,
  getCompetitionById,
  getCompetitions,
} from "./db";
import { publicProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

const COOKIE_NAME = "academic_division_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_FLYER_BYTES = 8 * 1024 * 1024;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDeadline(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isLocalHttpOrigin(origin: string | undefined) {
  return !!origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function cookieOptions(origin: string | undefined) {
  const localHttp = isLocalHttpOrigin(origin);
  return {
    httpOnly: true,
    secure: !localHttp,
    sameSite: localHttp ? "lax" as const : "none" as const,
    partitioned: !localHttp,
    path: "/",
    maxAge: SESSION_TTL_MS,
  };
}

function sessionTokensFromRequest(req: { headers: { cookie?: string; "x-academic-session"?: string } }) {
  const candidates = [parseCookie(req.headers.cookie ?? "")[COOKIE_NAME], req.headers["x-academic-session"]];
  return [...new Set(candidates.filter((token): token is string => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)))];
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function isEditorRequest(req: { headers: { cookie?: string; "x-academic-session"?: string } }) {
  const sessions = await Promise.all(sessionTokensFromRequest(req).map(token => getAcademicEditorSession(hashSessionToken(token))));
  return sessions.some(session => !!session && session.expiresAt.getTime() > Date.now());
}

async function assertEditor(req: { headers: { cookie?: string; "x-academic-session"?: string } }) {
  if (!(await isEditorRequest(req))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to Academic Mode to continue." });
  }
}

function checkLoginThrottle(req: { socket: { remoteAddress?: string | null } }) {
  const key = req.socket.remoteAddress || "unknown";
  const record = loginAttempts.get(key);
  if (!record) return key;
  if (record.blockedUntil > Date.now()) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Please wait a little before trying again." });
  }
  if (record.blockedUntil > 0 && record.blockedUntil <= Date.now()) loginAttempts.delete(key);
  return key;
}

const deadlineSchema = z.string().refine(isValidDeadline, "Enter a valid deadline.");
const competitionInput = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().min(8).max(4000),
  deadline: deadlineSchema,
  flyerDataUrl: z.string().max(12_000_000),
});

function decodeFlyer(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a PNG, JPG, or WebP flyer image." });
  const mimeType = match[1];
  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > MAX_FLYER_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Flyer images must be 8 MB or smaller." });
  }

  const isPng = mimeType === "image/png" && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isJpeg = mimeType === "image/jpeg" && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const isWebp = mimeType === "image/webp" && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  if (!isPng && !isJpeg && !isWebp) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The uploaded file does not match its image type." });
  }
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
  return { data, mimeType, extension };
}

export const competitionRouter = router({
  list: publicProcedure.query(async () => {
    const rows = await getCompetitions();
    const today = todayUtc();
    return rows.sort((a, b) => {
      const aExpired = a.deadline < today;
      const bExpired = b.deadline < today;
      if (aExpired !== bExpired) return aExpired ? 1 : -1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }),

  editorStatus: publicProcedure.query(async ({ ctx }) => ({ editor: await isEditorRequest(ctx.req) })),

  login: publicProcedure
    .input(z.object({ password: z.string().min(1).max(256) }))
    .mutation(async ({ ctx, input }) => {
      const ipKey = checkLoginThrottle(ctx.req);
      const configuredPassword = process.env.ACADEMIC_DIVISION_PASSWORD;
      if (!configuredPassword) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Academic login is not configured yet." });
      }

      const submitted = Buffer.from(input.password, "utf8");
      const expected = Buffer.from(configuredPassword, "utf8");
      const valid = submitted.length === expected.length && timingSafeEqual(submitted, expected);
      if (!valid) {
        const previous = loginAttempts.get(ipKey);
        const count = (previous?.count ?? 0) + 1;
        loginAttempts.set(ipKey, { count, blockedUntil: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
        throw new TRPCError({ code: count >= 5 ? "TOO_MANY_REQUESTS" : "UNAUTHORIZED", message: count >= 5 ? "Too many attempts. Please wait a little before trying again." : "That password did not match." });
      }

      loginAttempts.delete(ipKey);
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await createAcademicEditorSession(hashSessionToken(token), expiresAt);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions(ctx.req.get("origin")));
      return { editor: true, sessionToken: token };
    }),

  logout: publicProcedure.mutation(async ({ ctx }) => {
    await Promise.all(sessionTokensFromRequest(ctx.req).map(token => deleteAcademicEditorSession(hashSessionToken(token))));
    const options = cookieOptions(ctx.req.get("origin"));
    ctx.res.clearCookie(COOKIE_NAME, { ...options, maxAge: undefined });
    return { editor: false };
  }),

  create: publicProcedure
    .input(competitionInput)
    .mutation(async ({ ctx, input }) => {
      await assertEditor(ctx.req);
      if (input.deadline < todayUtc()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a deadline that has not passed." });
      }
      const flyer = decodeFlyer(input.flyerDataUrl);
      const uploaded = await storagePut(`competition-flyers/${randomBytes(16).toString("hex")}.${flyer.extension}`, flyer.data, flyer.mimeType);
      return createCompetition({
        title: input.title,
        description: input.description,
        deadline: input.deadline,
        flyerUrl: uploaded.url,
      });
    }),

  deleteCompetition: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertEditor(ctx.req);
      const current = await getCompetitionById(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "This competition is no longer on the board." });
      await deleteCompetition(input.id);
      return { deleted: true };
    }),
});
