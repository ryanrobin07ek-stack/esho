import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { defineCustomElements } from 'jeep-sqlite/loader';
import { hasPersistedSQLiteData } from './sqlite-snapshot.js';
const NAME='eshop';
const TABLES=['store','categories','products','pages','inventory','favorites','cart_items','orders','hero_slides','plans','analytics','tenant_catalogs','website_themes','web_visits','web_events','newsletter_subscribers','booking_holds','customer_points','payment_methods','studio_settings','main_store_inventory'];
let sqlite, db, queue=Promise.resolve(), timer, pendingSnapshot;
function enqueue(operation){const result=queue.catch(console.error).then(operation);queue=result.then(()=>undefined);return result;}
export async function initializeSQLite(){
 sqlite=new SQLiteConnection(CapacitorSQLite);
 if(Capacitor.getPlatform()==='web'){await defineCustomElements(window);document.body.appendChild(document.createElement('jeep-sqlite'));await customElements.whenDefined('jeep-sqlite');await sqlite.initWebStore();}
 const state=await sqlite.checkConnectionsConsistency(), conn=await sqlite.isConnection(NAME,false);
 db=state.result&&conn.result?await sqlite.retrieveConnection(NAME,false):await sqlite.createConnection(NAME,false,'no-encryption',1,false);await db.open();
 for(const t of TABLES)await db.execute('CREATE TABLE IF NOT EXISTS "'+t+'" (row_id INTEGER PRIMARY KEY AUTOINCREMENT,payload TEXT NOT NULL)');
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
async function load(){const snapshot={tables:{},schema:{}};for(const t of TABLES){const r=await db.query('SELECT payload FROM "'+t+'" ORDER BY row_id');snapshot.tables[t]=(r.values||[]).map(x=>JSON.parse(x.payload));}if(hasPersistedSQLiteData(snapshot))return snapshot;if(localStorage.getItem('ESHOP_BUILD_YOUR_WEB_RESET_ORIGINAL_HTML_V1')==='1')return null;try{const old=localStorage.getItem('ESHOP_SQLITE_DB_V1');if(old){const v=JSON.parse(old);if(hasPersistedSQLiteData(v)){await save(v);localStorage.removeItem('ESHOP_SQLITE_DB_V1');return v;}}}catch(e){console.warn('Legacy data migration failed',e);}return null;}
async function save(snapshot){if(!db||!snapshot?.tables)return;const items=[];for(const t of TABLES){items.push({statement:'DELETE FROM "'+t+'"',values:[]});for(const row of snapshot.tables[t]||[])items.push({statement:'INSERT INTO "'+t+'" (payload) VALUES (?)',values:[JSON.stringify(row)]});}await db.executeSet(items,true);if(Capacitor.getPlatform()==='web')await sqlite.saveToStore(NAME);}
