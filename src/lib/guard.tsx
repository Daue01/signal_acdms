'use client';
import {useEffect,useState} from 'react';
import {supabase} from './supabase';
import {Role,HOME} from './roles';
// UI convenience only: the real enforcement is Postgres RLS. Sends signed-out, inactive
// or wrong-role users away instead of showing an empty page.
export function RequireRole({allow,children}:{allow:Role[];children:React.ReactNode}){
 const[ok,setOk]=useState(false);
 useEffect(()=>{(async()=>{
  const{data:{session}}=await supabase.auth.getSession();
  if(!session){location.href='/login';return}
  const{data:p}=await supabase.from('profiles').select('role,is_active').eq('user_id',session.user.id).single();
  if(!p?.is_active){await supabase.auth.signOut();location.href='/login';return}
  if(!allow.includes(p.role as Role)){location.href=HOME[p.role as Role]??'/login';return}
  setOk(true)})()},[]);
 return ok?<>{children}</>:<p>Checking access…</p>}
