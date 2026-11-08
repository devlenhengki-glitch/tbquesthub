import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";

type D1 = { prepare(sql: string): { bind(...values: unknown[]): any; all(): Promise<{results: any[]}>; first(): Promise<any>; run(): Promise<any> } };
type Env = { DB: D1; ACADEMIC_DIVISION_PASSWORD?: string };
type Ctx = { db: D1; request: Request; env: Env; headers: Headers };
const t = initTRPC.context<Ctx>().create({ transformer: superjson });
const pub = t.procedure;
const router = t.router;
const encoder = new TextEncoder();
const TTL = 8 * 60 * 60 * 1000;
const MAX_FLYER_BYTES = 700 * 1024; // D1 single-value limit: keep base64 safely under 2MB.
const today = () => new Date().toISOString().slice(0, 10);
const competitionInput = z.object({title:z.string().trim().min(2).max(140), description:z.string().trim().min(8).max(4000), deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), flyerDataUrl:z.string().max(1_100_000)});
async function hash(value:string) {
 const digest = await crypto.subtle.digest('SHA-256',encoder.encode(value));
 return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
}
function token() { const b=crypto.getRandomValues(new Uint8Array(32)); return Array.from(b, x=>x.toString(16).padStart(2,'0')).join(''); }
function sessionToken(request:Request) {
 const header=request.headers.get('x-academic-session');
 const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)academic_division_session=([^;]+)/)?.[1];
 return header || cookie || '';
}
async function editor(ctx:Ctx) {
 const raw=sessionToken(ctx.request);
 if(!/^[a-f0-9]{64}$/.test(raw)) return false;
 const row=await ctx.db.prepare('SELECT expiresAt FROM academic_editor_sessions WHERE tokenHash = ?').bind(await hash(raw)).first();
 return !!row && Number(row.expiresAt)>Date.now();
}
async function requireEditor(ctx:Ctx) {if(!await editor(ctx)) throw new TRPCError({code:'UNAUTHORIZED',message:'Sign in to Academic Mode to continue.'});}
function safeEqual(a:string,b:string) { const x=encoder.encode(a),y=encoder.encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]??0)^(y[i]??0);return diff===0; }
function flyerDataUrl(value:string) {
 const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
 if(!match)throw new TRPCError({code:'BAD_REQUEST',message:'Use a PNG, JPG or WebP image.'});
 const bytes= Math.floor(match[2].length*3/4)-(match[2].endsWith('==')?2:match[2].endsWith('=')?1:0);
 if(bytes<1||bytes>MAX_FLYER_BYTES)throw new TRPCError({code:'BAD_REQUEST',message:'For free D1 storage, please compress the flyer to 700 KB or smaller.'});
 return value;
}
const competitions=router({
 list:pub.query(async ({ctx}) => {
  const rows=(await ctx.db.prepare('SELECT id,title,description,deadline,flyerUrl,createdAt FROM competitions ORDER BY CASE WHEN deadline < date(\'now\') THEN 1 ELSE 0 END, createdAt DESC').all()).results;
  return rows.map(r=>({...r,createdAt:new Date(String(r.createdAt))}));
 }),
 editorStatus:pub.query(async ({ctx})=>({editor:await editor(ctx)})),
 login:pub.input(z.object({password:z.string().min(1).max(256)})).mutation(async ({ctx,input})=>{
  if(!ctx.env.ACADEMIC_DIVISION_PASSWORD)throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Academic login password has not been configured in Cloudflare.'});
  // Persistent IP throttling: Cloudflare's edge instances do not share in-memory state.
  const ip=ctx.request.headers.get('CF-Connecting-IP')||'unknown';
  const ipHash=await hash(ip);
  const key='login:'+ipHash;
  const attempt=await ctx.db.prepare('SELECT expiresAt FROM academic_editor_sessions WHERE tokenHash = ?').bind(key).first();
  if(attempt && Number(attempt.expiresAt)>Date.now())throw new TRPCError({code:'TOO_MANY_REQUESTS',message:'Please wait 15 minutes before trying again.'});
  if(!safeEqual(input.password,ctx.env.ACADEMIC_DIVISION_PASSWORD)){
   // Fixed 15 minute cooldown on failed password; protects public editor login.
   await ctx.db.prepare('INSERT OR REPLACE INTO academic_editor_sessions(tokenHash,expiresAt) VALUES(?,?)').bind(key,Date.now()+15*60*1000).run();
   throw new TRPCError({code:'UNAUTHORIZED',message:'Incorrect password. Please wait 15 minutes before trying again.'});
  }
  const raw=token();
  await ctx.db.prepare('INSERT INTO academic_editor_sessions(tokenHash,expiresAt) VALUES(?,?)').bind(await hash(raw),Date.now()+TTL).run();
  ctx.headers.append('Set-Cookie',`academic_division_session=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
  return {editor:true,sessionToken:raw};
 }),
 logout:pub.mutation(async ({ctx})=>{
  const raw=sessionToken(ctx.request);
  if(/^[a-f0-9]{64}$/.test(raw))await ctx.db.prepare('DELETE FROM academic_editor_sessions WHERE tokenHash = ?').bind(await hash(raw)).run();
  ctx.headers.append('Set-Cookie','academic_division_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return {editor:false};
 }),
 create:pub.input(competitionInput).mutation(async ({ctx,input})=>{
  await requireEditor(ctx);
  if(input.deadline<today()||new Date(input.deadline+'T00:00:00Z').toISOString().slice(0,10)!==input.deadline)throw new TRPCError({code:'BAD_REQUEST',message:'Choose a valid future deadline.'});
  const data=flyerDataUrl(input.flyerDataUrl),id=crypto.randomUUID();
  await ctx.db.prepare('INSERT INTO competition_flyers(id,dataUrl) VALUES(?,?)').bind(id,data).run();
  const flyerUrl='/api/flyers/'+id;
  const res=await ctx.db.prepare('INSERT INTO competitions(title,description,deadline,flyerUrl) VALUES(?,?,?,?) RETURNING id,title,description,deadline,flyerUrl,createdAt').bind(input.title,input.description,input.deadline,flyerUrl).first();
  return {...res,createdAt:new Date(String(res.createdAt))};
 }),
 deleteCompetition:pub.input(z.object({id:z.number().int().positive()})).mutation(async ({ctx,input})=>{
  await requireEditor(ctx);
  const row=await ctx.db.prepare('SELECT flyerUrl FROM competitions WHERE id = ?').bind(input.id).first();
  if(!row)throw new TRPCError({code:'NOT_FOUND',message:'Competition not found.'});
  await ctx.db.prepare('DELETE FROM competitions WHERE id = ?').bind(input.id).run();
  const flyerId=String(row.flyerUrl).split('/').pop();
  await ctx.db.prepare('DELETE FROM competition_flyers WHERE id = ?').bind(flyerId).run();
  return {deleted:true};
 }),
 updateCompetition:pub.input(z.object({id:z.number().int().positive(),title:z.string().trim().min(2).max(140),description:z.string().trim().min(8).max(4000),deadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)})).mutation(async ({ctx,input})=>{
  await requireEditor(ctx);
  const current=await ctx.db.prepare('SELECT id FROM competitions WHERE id = ?').bind(input.id).first();
  if(!current)throw new TRPCError({code:'NOT_FOUND'});
  if(input.deadline<today())throw new TRPCError({code:'BAD_REQUEST',message:'Choose a future deadline.'});
  await ctx.db.prepare('UPDATE competitions SET title=?,description=?,deadline=? WHERE id=?').bind(input.title,input.description,input.deadline,input.id).run();
  return {updated:true};
 })
});
const appRouter=router({competitions,auth:router({me:pub.query(()=>null),logout:pub.mutation(()=>({success:true}))})});
export const onRequest = async ({request,env}: {request:Request;env:Env}) => {
 if(!env.DB)return new Response('Missing DB binding',{status:500});
 const headers=new Headers();
 const path=new URL(request.url).pathname.replace(/^\/api\/trpc\/?/,'');
 return fetchRequestHandler({endpoint:'/api/trpc',req:request,router:appRouter,createContext:()=>({db:env.DB,request,env,headers}),responseMeta:()=>({headers})});
};
