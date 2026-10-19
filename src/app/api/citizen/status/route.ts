import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {referenceCodeSchema} from '@/lib/citizenSubmission';

export async function GET(request:NextRequest){
 const reference=referenceCodeSchema.safeParse(request.nextUrl.searchParams.get('reference')??'');
 if(!reference.success)return NextResponse.json({error:'Enter a valid reference code.'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)return NextResponse.json({error:'Supabase is not configured'},{status:503});
 const{data,error}=await createClient(url,key).rpc('get_public_submission_status',{p_reference_code:reference.data});
 if(error)return NextResponse.json({error:error.message},{status:500});
 const result=Array.isArray(data)?data[0]:data;
 if(!result)return NextResponse.json({error:'Reference code not found.'},{status:404});
 return NextResponse.json({referenceCode:result.reference_code,status:result.status,submittedAt:result.submitted_at,updatedAt:result.updated_at});
}
