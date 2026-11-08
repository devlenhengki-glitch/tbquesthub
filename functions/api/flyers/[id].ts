export const onRequestGet = async ({params,env}: {params:{id:string};env:{DB:any}}) => {
 const id=params.id;
 if(!/^[0-9a-f-]{36}$/.test(id))return new Response('Not found',{status:404});
 const row=await env.DB.prepare('SELECT dataUrl FROM competition_flyers WHERE id = ?').bind(id).first();
 if(!row)return new Response('Not found',{status:404});
 const match=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(row.dataUrl);
 if(!match)return new Response('Invalid image',{status:500});
 const binary=atob(match[2]);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 return new Response(bytes,{headers:{'Content-Type':match[1],'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}});
};
