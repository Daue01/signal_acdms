import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {validateSubmission,Submission} from '@/lib/validation';
// One atomic, idempotent database call (supabase/002_hardening.sql -> submit_household).
// Runs as the signed-in user, so RLS (role + is_active + EA assignment) is enforced by Postgres.
// A repeated client_id returns the existing household_id, so retries never duplicate or lose data.
export async function POST(req:NextRequest){
 const token=req.headers.get('authorization')?.replace('Bearer ','');
 if(!token)return NextResponse.json({error:'Authentication required'},{status:401});
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!key)return NextResponse.json({error:'Supabase is not configured'},{status:503});
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,key,{global:{headers:{Authorization:`Bearer ${token}`}}});
 const{data:{user}}=await db.auth.getUser(token);
 if(!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const deviceInfo=req.headers.get('user-agent');
 const logAttempt=async(input:{client_id?:string;status:'success'|'failed';records_uploaded?:number;records_failed?:number;http_status?:number;error_code?:string;error_message?:string})=>{
  try{await db.rpc('log_sync_attempt',{p_client_id:input.client_id??null,p_status:input.status,p_records_uploaded:input.records_uploaded??0,p_records_failed:input.records_failed??0,p_http_status:input.http_status??null,p_error_code:input.error_code??null,p_error_message:input.error_message??null,p_device_info:deviceInfo})}catch(error){console.error('Unable to write sync attempt log',error)}
 };
 let raw:any;try{raw=await req.json()}catch{await logAttempt({status:'failed',records_failed:1,http_status:400,error_code:'INVALID_JSON',error_message:'Invalid JSON'});return NextResponse.json({errors:['Invalid JSON']},{status:400})}
 const clientId=typeof raw?.client_id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw.client_id)?raw.client_id:undefined;
 const s=raw as Submission;
 const v=validateSubmission(s);
 if(!v.valid){await logAttempt({client_id:clientId,status:'failed',records_failed:1,http_status:400,error_code:'VALIDATION',error_message:v.errors.join('; ')});return NextResponse.json({errors:v.errors},{status:400})}
 const{data,error}=await db.rpc('submit_household',{p_client_id:s.client_id,p_household:s.household,p_individuals:s.individuals});
 if(error){
  // 42501 = RLS denied (wrong role, inactive account, or EA not assigned to this user)
  const status=error.code==='42501'?403:['22023','23514','22P02','23502'].includes(error.code??'')?400:500;
  await logAttempt({client_id:s.client_id,status:'failed',records_failed:1,http_status:status,error_code:error.code??'RPC_ERROR',error_message:error.message});
  return NextResponse.json({error:error.message},{status})}
 await logAttempt({client_id:s.client_id,status:'success',records_uploaded:1,http_status:201});
 return NextResponse.json({household_id:data},{status:201})}
