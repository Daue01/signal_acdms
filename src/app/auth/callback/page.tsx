'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import type {EmailOtpType} from '@supabase/supabase-js';

export default function AuthCallback(){
 const router=useRouter();
 const[error,setError]=useState('Confirming your email…');
 useEffect(()=>{(async()=>{
  const params=new URLSearchParams(window.location.search);
  const portal=params.get('portal');
  const destination=portal==='enumerator'?'enumerator':portal==='administrator'?'administrator':'citizen';
  const code=params.get('code');
  const tokenHash=params.get('token_hash');
  const requestedType=params.get('type');
  let authError:Error|null=null;

  if(code){
   const result=await supabase.auth.exchangeCodeForSession(code);
   authError=result.error;
  }else if(tokenHash){
   const type:EmailOtpType=requestedType==='email'?'email':'email';
   const result=await supabase.auth.verifyOtp({token_hash:tokenHash,type});
   authError=result.error;
  }else{
   const result=await supabase.auth.getSession();
   if(!result.data.session)authError=new Error('The confirmation link is missing its verification token. Request a new confirmation email and try again.');
  }

  if(authError){setError(authError.message);return}
  router.replace(`/login/${destination}?confirmed=1`);
 })()},[router]);
 return <main className="auth-page"><div className="auth-card"><p className="eyebrow">Email confirmation</p><h1>{error}</h1>{error!=='Confirming your email…'&&<a className="auth-home" href={`/login/${new URLSearchParams(typeof window==='undefined'?'':window.location.search).get('portal')||'citizen'}`}>Return to login</a>}</div></main>
}
