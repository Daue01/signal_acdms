'use client';
import {useState} from 'react';
import {supabase,supabaseConfigured} from '@/lib/supabase';
import {HOME,Role} from '@/lib/roles';

type AccountType='citizen'|'enumerator';

export default function Login(){
 const [signup,setSignup]=useState(false);const [name,setName]=useState('');const [email,setE]=useState('');const [pw,setP]=useState('');const [accountType,setAccountType]=useState<AccountType>('citizen');const [err,setErr]=useState('');const [notice,setNotice]=useState('');
 async function go(){
  setErr('');setNotice('');
  if(!supabaseConfigured)return setErr('Supabase is not configured. Copy .env.example to .env.local and add your project URL and anon key.');
  if(signup){
   if(!name.trim())return setErr('Please add your full name.');
   const {data,error}=await supabase.auth.signUp({email,password:pw,options:{data:{full_name:name.trim(),account_type:accountType}}});
   if(error)return setErr(error.message);
   if(data.user)return setNotice('Account created. Check your email to confirm, then sign in. One email can only have one account.');
   return setNotice('Check your email to confirm your new account.');
  }
  const{data,error}=await supabase.auth.signInWithPassword({email,password:pw});
  if(error)return setErr(error.message);
  const{data:p}=await supabase.from('profiles').select('role,is_active').eq('user_id',data.user.id).single();
  if(!p?.is_active){await supabase.auth.signOut();return setErr('Account pending activation. Contact an administrator.')}
  const home=HOME[p.role as Role];
  if(!home){await supabase.auth.signOut();return setErr('This account level has no access to the system.')}
  location.href=home;
 }
 return <main className="auth-page"><div className="auth-card"><a href="/" className="brand"><span className="brand-mark">✦</span><span>NAIJA<span className="brand-muted"> / SIGNAL</span></span></a><div className="auth-heading"><p className="eyebrow">Citizen & enumerator portal</p><h1>{signup?'Create your signal.':'Welcome back.'}</h1><p>{signup?'One secure account for exploring, contributing and counting Nigeria.':'Sign in to your personal or field workspace.'}</p></div>{signup&&<input className="auth-input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>}<input className="auth-input" placeholder="Email address" type="email" value={email} onChange={e=>setE(e.target.value)}/><input className="auth-input" placeholder="Password" type="password" value={pw} onChange={e=>setP(e.target.value)}/>{signup&&<div className="account-choice"><p>Account type</p><div><button className={accountType==='citizen'?'choice-active':''} onClick={()=>setAccountType('citizen')}>Citizen <span>Explore & contribute</span></button><button className={accountType==='enumerator'?'choice-active':''} onClick={()=>setAccountType('enumerator')}>Enumerator <span>Field workspace</span></button></div></div>}<button className="button button-primary auth-submit" onClick={go}>{signup?'Create account':'Sign in'} <span>↗</span></button>{err&&<p className="auth-error">{err}</p>}{notice&&<p className="auth-notice">{notice}</p>}<button className="auth-switch" onClick={()=>{setSignup(!signup);setErr('');setNotice('')}}>{signup?'Already have an account? Sign in':'New here? Create a citizen or enumerator account'}</button><a href="/" className="auth-home">← Back to Naija / Signal</a></div></main>;
}
