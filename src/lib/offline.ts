import {set,get,del,keys} from 'idb-keyval';
import {supabase} from './supabase';
import type {Submission} from './validation';

const QUEUE_PREFIX='pending:';
const AREAS_KEY='assigned-enumeration-areas';
const K=(id:string)=>`${QUEUE_PREFIX}${id}`;
export type CachedArea={ea_id:string;ea_code:string;state:string;lga:string;ward:string;target_households:number};

export const queue=(s:Submission)=>set(K(s.client_id),{s,queued_at:new Date().toISOString()});
export const pendingCount=async()=> (await keys()).filter(k=>String(k).startsWith(QUEUE_PREFIX)).length;
export const cacheAreas=async(areas:CachedArea[])=>set(AREAS_KEY,areas);
export const cachedAreas=async():Promise<CachedArea[]>=>(await get(AREAS_KEY))??[];
const withTimeout=async<T>(promise:PromiseLike<T>,ms=7000):Promise<T>=>Promise.race([Promise.resolve(promise),new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('network timeout')),ms))]);

export async function loadAssignedAreas(){
 if(typeof navigator!=='undefined'&&!navigator.onLine)return cachedAreas();
 try{
  const {data,error}=await withTimeout(supabase.from('enumeration_areas').select('ea_id,ea_code,state,lga,ward,target_households').order('ea_code')) as any;
  if(error||!data)throw error??new Error('Unable to load assigned areas');
  await cacheAreas(data as CachedArea[]);return data as CachedArea[];
 }catch{return cachedAreas()}
}

async function send(s:Submission,token:string){return fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(s)})}
export async function submitOrQueue(s:Submission){await queue(s);return syncAll()}
export async function syncAll(){
 const pendingKeys=(await keys()).filter(k=>String(k).startsWith(QUEUE_PREFIX));
 if(typeof navigator!=='undefined'&&!navigator.onLine)return{uploaded:0,failed:0,pending:pendingKeys.length};
 const {data:{session}}=await supabase.auth.getSession();
 if(!session)return{uploaded:0,failed:0,pending:pendingKeys.length};
 let uploaded=0,failed=0;
 for(const key of pendingKeys){
  const item:any=await get(key);if(!item?.s)continue;
  try{const response=await send(item.s,session.access_token);if(response.ok||response.status===409){await del(key);uploaded++}else failed++}catch{failed++}
 }
 return{uploaded,failed,pending:await pendingCount()};
}
if(typeof window!=='undefined')window.addEventListener('online',()=>{void syncAll()});
