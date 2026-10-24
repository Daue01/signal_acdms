import {createServerClient} from '@supabase/ssr';
import {NextResponse, type NextRequest} from 'next/server';

type Role='administrator'|'state_admin'|'supervisor'|'enumerator'|'citizen'|'analyst';

const HOME:Record<Role,string>={
 administrator:'/admin',
 state_admin:'/admin',
 supervisor:'/admin',
 enumerator:'/enumerator',
 citizen:'/citizen',
 analyst:'/admin',
};

function requiredRoles(pathname:string):Role[]|null{
 if(pathname==='/admin'||pathname.startsWith('/admin/'))return ['administrator','state_admin','supervisor','analyst'];
 if(pathname==='/enumerator'||pathname.startsWith('/enumerator/'))return ['enumerator','state_admin'];
 if(pathname==='/citizen'||pathname==='/citizen/')return ['citizen'];
 return null;
}

function redirectWithCookies(request:NextRequest,response:NextResponse,destination:string){
 const redirect=NextResponse.redirect(new URL(destination,request.url));
 response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));
 return redirect;
}

export async function updateSession(request:NextRequest){
 const required=requiredRoles(request.nextUrl.pathname);
 if(!required)return NextResponse.next({request});

 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return NextResponse.redirect(new URL('/login',request.url));

 let response=NextResponse.next({request});
 const supabase=createServerClient(url,key,{
  auth:{flowType:'pkce',detectSessionInUrl:false},
  cookies:{
   getAll:()=>request.cookies.getAll(),
   setAll(cookiesToSet){
    cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));
    response=NextResponse.next({request});
    cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));
   },
  },
 });

 try{
  const{data:claimsData}=await supabase.auth.getClaims();
  const userId=claimsData?.claims?.sub;
  if(!userId)return redirectWithCookies(request,response,'/login');

  const{data:profile,error}=await supabase.from('profiles').select('role,is_active').eq('user_id',userId).maybeSingle();
  if(error||!profile?.is_active)return redirectWithCookies(request,response,'/login');

  const role=profile.role as Role;
  if(!required.includes(role))return redirectWithCookies(request,response,HOME[role]??'/login');
  return response;
 }catch(error){
  console.error('Could not verify the dashboard session:',error);
  return redirectWithCookies(request,response,'/login');
 }
}
