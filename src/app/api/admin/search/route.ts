import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';

const querySchema=z.object({q:z.string().trim().min(2).max(120),reason:z.string().trim().min(5).max(240),page:z.coerce.number().int().min(1).default(1)});

export async function GET(request:NextRequest){
 const parsed=querySchema.safeParse({q:request.nextUrl.searchParams.get('q')??'',reason:request.nextUrl.searchParams.get('reason')??'',page:request.nextUrl.searchParams.get('page')??'1'});
 if(!parsed.success)return NextResponse.json({error:'Enter a search reason and at least two characters.'},{status:400});
 const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY??process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!token)return NextResponse.json({error:'Authentication required'},{status:401});if(!url||!key)return NextResponse.json({error:'Supabase is not configured'},{status:503});
 const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}}});const{data:{user},error:userError}=await client.auth.getUser(token);if(userError||!user)return NextResponse.json({error:'Authentication required'},{status:401});
 const{data:profile,error:profileError}=await client.from('profiles').select('role,is_active').eq('user_id',user.id).single();if(profileError||!profile?.is_active||!['administrator','supervisor','analyst'].includes(profile.role))return NextResponse.json({error:'Search is not available for this role.'},{status:403});
 const{data,error}=await client.rpc('admin_search',{p_query:parsed.data.q,p_reason:parsed.data.reason,p_limit:20,p_offset:(parsed.data.page-1)*20});if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({query:parsed.data.q,page:parsed.data.page,results:data??[]});
}
