import {supabase,supabaseConfigured} from './supabase';

export type GeographyState={state_id:number;name:string};
export type GeographyLga={lga_id:number;state_id:number;name:string};
export type GeographyWard={ward_id:number;lga_id:number;name:string};
export type GeographySource='database'|'local';
type GeographyCounts={states:number;lgas:number;wards:number};

export type GeographyLoad<T>={data:T[];error:string|null;source:GeographySource};
type GeographySourceResolution={source:GeographySource;states:GeographyState[]};

let sourceResolution:Promise<GeographySourceResolution>|null=null;

async function loadLocal<T>(level:'states'|'lgas'|'wards',parentId?:number):Promise<{data:T[];error:string|null}>{
 try{
  const query=parentId===undefined?'':`&${level==='lgas'?'state_id':'lga_id'}=${parentId}`;
  const response=await fetch(`/api/geography/local?level=${level}${query}`,{cache:'no-store'});
  const payload=await response.json() as {data?:T[];error?:string};
  if(!response.ok)throw new Error(payload.error??`Could not load local ${level}.`);
  return {data:payload.data??[],error:null};
 }catch(error){return {data:[],error:error instanceof Error?error.message:`Could not load local ${level}.`}}
}

function stateKey(name:string){return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase().replace(/\s+state$/,'').replace(/\s+/g,' ')}

async function resolveSource():Promise<GeographySourceResolution>{
 if(!sourceResolution)sourceResolution=(async()=>{
  let expected:GeographyCounts;
  try{
   const response=await fetch('/api/geography/local?level=summary',{cache:'no-store'});
   const payload=await response.json() as {data?:GeographyCounts;error?:string};
   if(!response.ok||!payload.data)throw new Error(payload.error??'Could not verify the local geography register.');
   expected=payload.data;
  }catch(error){
   console.error('Could not verify the local geography register; using the bundled reference list.',error);
   return {source:'local',states:[]};
  }

  if(!supabaseConfigured)return {source:'local',states:[]};

  const [states,lgas,wards,syntheticWards]=await Promise.all([
   supabase.from('states').select('state_id,name').order('name'),
   supabase.from('lgas').select('lga_id',{count:'exact',head:true}),
   supabase.from('wards').select('ward_id',{count:'exact',head:true}),
   supabase.from('wards').select('ward_id',{count:'exact',head:true}).eq('record_type','synthetic'),
  ]);
  const failure=states.error??lgas.error??wards.error??syntheticWards.error;
  if(failure){
   console.error('Could not verify the Supabase geography tables; using the bundled reference list.',failure);
   return {source:'local',states:[]};
  }

  const localStates=await loadLocal<GeographyState>('states');
  const actualStates=(states.data??[]) as GeographyState[];
  const names=new Set(actualStates.map(state=>stateKey(state.name)));
  const complete=localStates.error===null
   &&expected.states>0&&expected.lgas>0&&expected.wards>0
   &&(states.count??actualStates.length)>=expected.states
   &&(lgas.count??0)>=expected.lgas
   &&(wards.count??0)>=expected.wards
   &&localStates.data.every(state=>names.has(stateKey(state.name)));
  const demoWardCount=syntheticWards.count??0;
  if(complete&&demoWardCount===0)return {source:'database',states:actualStates};
  if(complete)console.info('Using bundled reference geography because Supabase includes synthetic wards.');
  else console.warn('Supabase geography is incomplete; using the bundled reference list.',{expected,actual:{states:actualStates.length,lgas:lgas.count??0,wards:wards.count??0}});
  return {source:'local',states:[]};
 })();
 return sourceResolution;
}

export async function loadStates():Promise<GeographyLoad<GeographyState>>{
 const resolution=await resolveSource();
 if(resolution.source==='database')return {data:resolution.states,error:null,source:resolution.source};
 const local=await loadLocal<GeographyState>('states');
 return {...local,source:resolution.source};
}

export async function loadLgas(stateId:number):Promise<GeographyLoad<GeographyLga>>{
 const resolution=await resolveSource();
 if(resolution.source==='database'){
  const result=await supabase.from('lgas').select('lga_id,state_id,name').eq('state_id',stateId).order('name');
  if(result.error)return {data:[],error:result.error.message,source:resolution.source};
  return {data:(result.data??[]) as GeographyLga[],error:null,source:resolution.source};
 }
 const local=await loadLocal<GeographyLga>('lgas',stateId);
 return {...local,source:resolution.source};
}

export async function loadWards(lgaId:number):Promise<GeographyLoad<GeographyWard>>{
 const resolution=await resolveSource();
 if(resolution.source==='database'){
  const result=await supabase.from('wards').select('ward_id,lga_id,name').eq('lga_id',lgaId).order('name');
  if(result.error)return {data:[],error:result.error.message,source:resolution.source};
  return {data:(result.data??[]) as GeographyWard[],error:null,source:resolution.source};
 }
 const local=await loadLocal<GeographyWard>('wards',lgaId);
 return {...local,source:resolution.source};
}
