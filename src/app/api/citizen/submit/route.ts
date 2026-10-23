import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {citizenSubmissionSchema} from '@/lib/citizenSubmission';
import {getSupabaseServerClient} from '@/lib/supabaseServer';

async function verifyCaptcha(token:string){
 const verifyUrl=process.env.CAPTCHA_VERIFY_URL;
 const secret=process.env.CAPTCHA_SECRET_KEY;
 if(!verifyUrl||!secret)return process.env.CAPTCHA_REQUIRED!=='true';
 const response=await fetch(verifyUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:token})});
 if(!response.ok)return false;
 const result=await response.json() as {success?:boolean};
 return result.success===true;
}

export async function POST(request:NextRequest){
 try{
  const database=getSupabaseServerClient();
  if(!database)return NextResponse.json({error:'Server-side Supabase is not configured. Add SUPABASE_SECRET_KEY to the deployment environment.'},{status:503});
  const parsed=citizenSubmissionSchema.safeParse(await request.json());
  if(!parsed.success)return NextResponse.json({error:'Please correct the highlighted form fields.',issues:parsed.error.flatten().fieldErrors},{status:400});
  const input=parsed.data;
  const captchaVerified=await verifyCaptcha(input.captchaToken);
  if(!captchaVerified)return NextResponse.json({error:'Captcha verification failed. Please try again.'},{status:400});
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??request.headers.get('x-real-ip')??'unknown';
  const userAgent=request.headers.get('user-agent')??'unknown';
  const rateKey=createHash('sha256').update(`${ip}|${userAgent}`).digest('hex');
  const payload={
   housing_type:input.housingType,
   ownership_status:input.ownershipStatus,
   electricity_access_type:input.electricityAccessType,
   electricity_hours_per_day:input.electricityHoursPerDay,
   water_source:input.waterSource,
   water_fetch_minutes:input.waterFetchMinutes,
   cars_owned:input.carsOwned,
   income_band:input.incomeBand,
   census_responses:input.census_responses,
   individuals:input.individuals,
  };
  const{data,error}=await database.rpc('submit_public_citizen_submission',{
   p_state_id:input.stateId,p_lga_id:input.lgaId,p_ward_id:input.wardId,
   p_locality:input.locality,p_address:input.address,p_payload:payload,
   p_consent_recorded:input.consentRecorded,p_captcha_verified:captchaVerified,
   p_rate_key:rateKey,p_latitude:input.latitude??null,p_longitude:input.longitude??null,
  });
  if(error){
   const status=error.code==='P0001'?429:error.code==='42501'?403:error.code==='23503'?400:500;
   return NextResponse.json({error:error.code==='P0001'?'Too many submissions from this connection. Please try again later.':error.message},{status});
  }
  const result=Array.isArray(data)?data[0]:data;
  return NextResponse.json({referenceCode:result?.reference_code,status:result?.status,routingReason:result?.routing_reason??null},{status:201});
 }catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:'Unable to submit household.'},{status:500});
 }
}
