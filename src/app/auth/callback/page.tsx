'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {supabase} from '@/lib/supabase';

export default function AuthCallback(){const router=useRouter();const[error,setError]=useState('Confirming your email…');useEffect(()=>{(async()=>{const params=new URLSearchParams(window.location.search);const code=params.get('code');const tokenHash=params.get('token_hash');const type=params.get('type') as 'email'|'signup'|null;let result:any={error:null};if(code)result=await supabase.auth.exchangeCodeForSession(code);else if(tokenHash&&type)result=await supabase.auth.verifyOtp({token_hash:tokenHash,type});if(result.error){setError(result.error.message);return}router.replace(`/login/${params.get('portal')==='enumerator'?'enumerator':params.get('portal')==='administrator'?'administrator':'citizen'}?confirmed=1`)})()},[router]);return <main className="auth-page"><div className="auth-card"><p className="eyebrow">Email confirmation</p><h1>{error}</h1>{error!=='Confirming your email…'&&<a className="auth-home" href="/login/citizen">Return to login</a>}</div></main>}
