import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { defineCustomElements } from 'jeep-sqlite/loader';
import { hasPersistedSQLiteData } from './sqlite-snapshot.js';
import { batchStatements, planSave } from './sqlite-save-plan.js';
const NAME='eshop';
const TABLES=['store','categories','products','pages','inventory','favorites','cart_items','orders','hero_slides','plans','analytics','tenant_catalogs','website_themes','web_visits','web_events','newsletter_subscribers','booking_holds','customer_points','payment_methods','studio_settings','main_store_inventory'];
let sqlite, db, queue=Promise.resolve(), timer, pendingSnapshot;
function enqueue(operation){const result=queue.catch(console.error).then(operation);queue=result.then(()=>undefined);return result;}
export async function initializeSQLite(){
 sqlite=new SQLiteConnection(CapacitorSQLite);
 if(Capacitor.getPlatform()==='web'){await defineCustomElements(window);document.body.appendChild(document.createElement('jeep-sqlite'));await customElements.whenDefined('jeep-sqlite');await sqlite.initWebStore();}
 const state=await sqlite.checkConnectionsConsistency(), conn=await sqlite.isConnection(NAME,false);
 db=state.result&&conn.result?await sqlite.retrieveConnection(NAME,false):await sqlite.createConnection(NAME,false,'no-encryption',1,false);await db.open();
 // One statement per table: on Android, joining them with ';' left the last table uncreated on a
 // fresh install, and the first load then failed with "no such table" (a white screen).
 for(const t of TABLES)await db.execute('CREATE TABLE IF NOT EXISTS "'+t+'" (row_id INTEGER PRIMARY KEY AUTOINCREMENT,payload TEXT NOT NULL);');
 window.ShopSQLite={
  load,
  save(snapshot){return enqueue(()=>save(snapshot));},
  query(statement,values=[]){return enqueue(()=>db.query(statement,values));},
  run(statement,values=[]){return enqueue(async()=>{const result=await db.run(statement,values);if(Capacitor.getPlatform()==='web')await sqlite.saveToStore(NAME);return result;});},
  execute(statement){return enqueue(async()=>{const result=await db.execute(statement);if(Capacitor.getPlatform()==='web')await sqlite.saveToStore(NAME);return result;});},
  executeSet(statements,transaction=true){return enqueue(async()=>{const result=await db.executeSet(statements,transaction);if(Capacitor.getPlatform()==='web')await sqlite.saveToStore(NAME);return result;});},
  scheduleSave(data){pendingSnapshot=data;clearTimeout(timer);timer=setTimeout(()=>{const snapshot=pendingSnapshot;pendingSnapshot=null;if(snapshot)void enqueue(()=>save(snapshot));},100);},
  async flush(){clearTimeout(timer);if(pendingSnapshot){const snapshot=pendingSnapshot;pendingSnapshot=null;await enqueue(()=>save(snapshot));}await queue;}
 };
 window.addEventListener('pagehide',()=>void window.ShopSQLite.flush());
}
async function load(){const snapshot={tables:Object.fromEntries(TABLES.map(t=>[t,[]])),schema:{}};const union=TABLES.map((t,i)=>`SELECT ${i} AS table_index, '${t}' AS table_name, row_id, payload FROM "${t}"`).join(' UNION ALL ');const r=await db.query(`SELECT table_name,row_id,payload FROM (${union}) ORDER BY table_index,row_id`);onDisk.clear();for(const t of TABLES)onDisk.set(t,{ids:[],json:[]});for(const row of r.values||[]){snapshot.tables[row.table_name].push(JSON.parse(row.payload));const known=onDisk.get(row.table_name);known.ids.push(row.row_id);known.json.push(row.payload);}if(hasPersistedSQLiteData(snapshot))return snapshot;if(localStorage.getItem('ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1')==='1')return null;try{const old=localStorage.getItem('ESHOP_SQLITE_DB_V1');if(old){const v=JSON.parse(old);if(hasPersistedSQLiteData(v)){await save(v);localStorage.removeItem('ESHOP_SQLITE_DB_V1');return v;}}}catch(e){console.warn('Legacy data migration failed',e);}return null;}
// Every save used to delete and rewrite every row of every table in ONE executeSet call. Once the
// website drafts in studio_settings passed ~20 MB, that single message became a 54 MB string inside
// the Capacitor bridge and Android killed the app (OutOfMemoryError in Bridge.callPluginMethod),
// typically right after the web builder opened and autosaved. It also meant every small edit
// rewrote the whole database 100 ms later, which is much of why the app felt slow.
//
// Now: only rows that actually changed are written, and no single message to the native side
// carries more than about a megabyte. All batches run inside one transaction, so a save either
// lands completely or not at all, exactly as before.
const onDisk=new Map();

async function save(snapshot){
 if(!db||!snapshot?.tables)return;
 const work=planSave(snapshot,onDisk,TABLES);
 if(!work.length)return;
 const batches=batchStatements(work);
 if(batches.length===1){
  await db.executeSet(batches[0],true);
 }else{
  await db.beginTransaction();
  try{
   for(const batch of batches)await db.executeSet(batch,false);
   await db.commitTransaction();
  }catch(error){
   try{await db.rollbackTransaction();}catch(rollbackError){console.error('SQLite rollback failed',rollbackError);}
   throw error;
  }
 }
 // Only now that it is committed does memory agree with disk.
 for(const job of work){
  if(job.kind==='update'){const known=onDisk.get(job.table);for(const u of job.updates)known.json[u.index]=u.json;continue;}
  try{
   const ids=((await db.query('SELECT row_id FROM "'+job.table+'" ORDER BY row_id',[])).values||[]).map(v=>v.row_id);
   onDisk.set(job.table,{ids,json:job.next.slice()});
  }catch(error){
   // Without the new row ids an in-place update could hit the wrong row, so the next save of this
   // table rewrites it instead.
   onDisk.delete(job.table);
   console.error('Could not read back saved row ids for '+job.table,error);
  }
 }
 if(Capacitor.getPlatform()==='web')await sqlite.saveToStore(NAME);
}
