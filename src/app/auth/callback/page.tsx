'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';
import type {EmailOtpType} from '@supabase/supabase-js';

const emailOtpTypes:EmailOtpType[]=['signup','invite','magiclink','recovery','email_change','email'];

function getEmailOtpType(value:string|null):EmailOtpType{
 return value&&emailOtpTypes.includes(value as EmailOtpType)?value as EmailOtpType:'signup';
}

function readableAuthError(message:string){
 const lower=message.toLowerCase();
 if(lower.includes('code verifier')||lower.includes('pkce'))return 'This confirmation link was opened in a different browser or after its sign-up session expired. Request a new confirmation email and open it in the same browser where you registered.';
 if(lower.includes('expired')||lower.includes('invalid'))return 'This confirmation link is invalid or has expired. Request a new confirmation email and use the newest link only once.';
 return message;
}

export default function AuthCallback(){
 const router=useRouter();
 const[error,setError]=useState('Confirming your email…');
 useEffect(()=>{(async()=>{
  const params=new URLSearchParams(window.location.search);
  const portal=params.get('portal');
  const code=params.get('code');
  const tokenHash=params.get('token_hash');
  const requestedType=params.get('type');
  let authError:Error|null=null;

  if(code){
   const result=await supabase.auth.exchangeCodeForSession(code);
   authError=result.error;
  }else if(tokenHash){
   const type=getEmailOtpType(requestedType);
   const result=await supabase.auth.verifyOtp({token_hash:tokenHash,type});
   authError=result.error;
  }else{
   const result=await supabase.auth.getSession();
   if(!result.data.session)authError=new Error('The confirmation link is missing its verification token. Request a new confirmation email and try again.');
  }

  if(authError){setError(readableAuthError(authError.message));return}
  const{data:{user}}=await supabase.auth.getUser();
  const accountType=user?.user_metadata?.account_type;
  const destination=portal==='enumerator'||accountType==='enumerator'?'enumerator':portal==='administrator'||accountType==='administrator'?'administrator':'citizen';
  router.replace(`/login/${destination}?confirmed=1`);
 })()},[router]);
 return <main className="auth-page"><div className="auth-card"><p className="eyebrow">Email confirmation</p><h1>{error}</h1>{error!=='Confirming your email…'&&<a className="auth-home" href={`/login/${new URLSearchParams(typeof window==='undefined'?'':window.location.search).get('portal')||'citizen'}`}>Return to login</a>}</div></main>
}
