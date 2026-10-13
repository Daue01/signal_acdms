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
 let s:Submission; try{s=await req.json()}catch{return NextResponse.json({errors:['Invalid JSON']},{status:400})}
 const v=validateSubmission(s);
 if(!v.valid)return NextResponse.json({errors:v.errors},{status:400});
 const{data,error}=await db.rpc('submit_household',{p_client_id:s.client_id,p_household:s.household,p_individuals:s.individuals});
 if(error){
  // 42501 = RLS denied (wrong role, inactive account, or EA not assigned to this user)
  const status=error.code==='42501'?403:['22023','23514','22P02','23502'].includes(error.code??'')?400:500;
  return NextResponse.json({error:error.message},{status})}
 await db.from('sync_log').insert({enumerator_id:user.id,records_uploaded:1,records_failed:0,device_info:req.headers.get('user-agent')});
 return NextResponse.json({household_id:data},{status:201})}
