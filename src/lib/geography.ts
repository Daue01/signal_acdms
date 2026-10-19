import {supabase} from './supabase';

export type GeographyState={state_id:number;name:string};
export type GeographyLga={lga_id:number;state_id:number;name:string};
export type GeographyWard={ward_id:number;lga_id:number;name:string};

export type GeographyLoad<T>={data:T[];error:string|null};

export async function loadStates():Promise<GeographyLoad<GeographyState>>{
 const result=await supabase.from('states').select('state_id,name').order('name');
 return {data:(result.data??[]) as GeographyState[],error:result.error?`States: ${result.error.message}`:null};
}

export async function loadLgas(stateId:number):Promise<GeographyLoad<GeographyLga>>{
 const result=await supabase.from('lgas').select('lga_id,state_id,name').eq('state_id',stateId).order('name');
 return {data:(result.data??[]) as GeographyLga[],error:result.error?`LGAs: ${result.error.message}`:null};
}

export async function loadWards(lgaId:number):Promise<GeographyLoad<GeographyWard>>{
 const result=await supabase.from('wards').select('ward_id,lga_id,name').eq('lga_id',lgaId).order('name');
 return {data:(result.data??[]) as GeographyWard[],error:result.error?`Wards: ${result.error.message}`:null};
}
