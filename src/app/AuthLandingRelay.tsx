'use client';

import {useEffect} from 'react';
import {supabase} from '@/lib/supabase';

const emailOtpTypes=['signup','invite','magiclink','recovery','email_change','email'] as const;

function getEmailOtpType(value:string|null){
 return value&&emailOtpTypes.includes(value as typeof emailOtpTypes[number])?value:'signup';
}

export default function AuthLandingRelay(){
 useEffect(()=>{(async()=>{
  if(window.location.pathname!=='/')return;
  const params=new URLSearchParams(window.location.search);
  const hash=new URLSearchParams(window.location.hash.replace(/^#/,'')||'');
  const code=params.get('code');
  const tokenHash=params.get('token_hash');
  const requestedType=params.get('type');
  const hasAuthInput=Boolean(code||tokenHash||hash.get('access_token'));
  if(!hasAuthInput)return;

  let error:any=null;
  if(code)error=(await supabase.auth.exchangeCodeForSession(code)).error;
  else if(tokenHash)error=(await supabase.auth.verifyOtp({token_hash:tokenHash,type:getEmailOtpType(requestedType)})).error;
  else if(hash.get('access_token')&&hash.get('refresh_token')){
   error=(await supabase.auth.setSession({
    access_token:hash.get('access_token')!,
    refresh_token:hash.get('refresh_token')!,
   })).error;
  }
  if(error)return;

  const{data:{user}}=await supabase.auth.getUser();
  const requested=params.get('portal');
  const destination=requested==='enumerator'||user?.user_metadata?.account_type==='enumerator'
   ?'enumerator':requested==='administrator'?'administrator':'citizen';
  window.location.replace(`/login/${destination}?confirmed=1`);
 })()},[]);
 return null;
}
