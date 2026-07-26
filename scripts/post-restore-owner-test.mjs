import pg from 'pg';
import { readFile } from 'node:fs/promises';
const parse=text=>Object.fromEntries(text.split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')&&line.includes('=')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)]}));
const env={...parse(await readFile('.env.local','utf8')),...parse(await readFile('.env.supabase.local','utf8'))},ref=new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const db=new pg.Client({host:`db.${ref}.supabase.co`,port:5432,database:'postgres',user:'postgres',password:env.SUPABASE_DB_PASSWORD,ssl:{rejectUnauthorized:false}});
try{
 await db.connect();const owner=(await db.query("select id from public.profiles where role='owner' and active limit 1")).rows[0];if(!owner)throw new Error('Owner ativo ausente.');
 await db.query('begin');await db.query('set local role authenticated');await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:owner.id,role:'authenticated'})]);
 const counts={};for(const table of ['companies','categories','clients','assets','properties','vehicles','transactions'])counts[table]=Number((await db.query(`select count(*)::int count from public.${table}`)).rows[0].count);
 await db.query('rollback');console.log(JSON.stringify({projectRef:ref,ownerSession:true,rlsRead:true,counts},null,2));
}finally{await db.end().catch(()=>{})}
