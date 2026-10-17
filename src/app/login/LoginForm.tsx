'use client';

import {useEffect,useState} from 'react';
import {supabase,supabaseConfigured} from '@/lib/supabase';
import {HOME,Role} from '@/lib/roles';

type Portal='citizen'|'enumerator'|'administrator';
const portalCopy={citizen:{title:'Citizen portal',description:'Create a citizen account with email verification. No administrator approval is needed.',signup:true},enumerator:{title:'Enumerator portal',description:'Capture field data securely, even when the network is unavailable.',signup:true},administrator:{title:'Superadmin portal',description:'Approve enumerators, manage areas and monitor census operations.',signup:false}} as const;

function authErrorMessage(error:{message?:string}|null):string{
 const message=error?.message??'Authentication failed.';
 if(/failed to fetch|networkerror|load failed|name_not_resolved/i.test(message)){
  return 'Cannot reach Supabase Auth. Check NEXT_PUBLIC_SUPABASE_URL in your production hosting settings against the Project URL in Supabase Dashboard, then rebuild and redeploy.';
 }
 return message;
}

export default function LoginForm({portal}:{portal:Portal}){
 const copy=portalCopy[portal];const[signup,setSignup]=useState(portal==='citizen');const[name,setName]=useState('');const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[notice,setNotice]=useState('');
 useEffect(()=>{if(typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('confirmed')==='1'){setSignup(false);setNotice('Email confirmed. You can now sign in.');}},[]);
 async function submit(){
  setError('');setNotice('');if(!supabaseConfigured)return setError('Supabase is not configured.');
  if(signup){
   if(!name.trim())return setError('Please enter your full name.');
   const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name.trim(),account_type:portal},emailRedirectTo:`${window.location.origin}/auth/callback`}});
   if(error)return setError(authErrorMessage(error));
   if(data.user)return setNotice(portal==='citizen'?'Citizen account created. Verify your email to sign in; no administrator approval is needed.':'Account created. Check your email and click the confirmation link before signing in.');
   return setNotice('Check your email for the confirmation link.');
  }
  const{data,error}=await supabase.auth.signInWithPassword({email,password});if(error)return setError(authErrorMessage(error));
  if(portal==='citizen'&&!data.user.email_confirmed_at){await supabase.auth.signOut();return setError('Please verify your email before signing in.');}
  const{data:profile,error:profileError}=await supabase.from('profiles').select('role,is_active').eq('user_id',data.user.id).single();
  if(profileError||!profile)return setError('Your account profile is not ready. Contact the administrator.');
  if(!profile.is_active)return setError('Your account is awaiting administrator approval.');
  const role=profile.role as Role;
  if(portal==='administrator'&&!['administrator','supervisor'].includes(role))return setError('This account is not an administrator account.');
  if(portal==='enumerator'&&role!=='enumerator')return setError('This account is not an enumerator account.');
  if(portal==='citizen'&&role!=='citizen')return setError('This account is not a citizen account.');
  location.href=HOME[role];
 }
 return <main className="auth-page"><div className="auth-card"><a href="/" className="brand"><span className="brand-mark">✦</span><span>NAIJA<span className="brand-muted"> / SIGNAL</span></span></a><div className="portal-switch"><a className={portal==='citizen'?'active':''} href="/login/citizen">Citizen</a><a className={portal==='enumerator'?'active':''} href="/login/enumerator">Enumerator</a><a className={portal==='administrator'?'active':''} href="/login/administrator">Admin</a></div><div className="auth-heading"><p className="eyebrow">{copy.title}</p><h1>{signup?'Create your account.':'Welcome back.'}</h1><p>{copy.description}</p></div>{signup&&<input className="auth-input" placeholder="Full name" value={name} onChange={e=>setName(e.target.value)}/>}<input className="auth-input" placeholder="Email address" type="email" value={email} onChange={e=>setEmail(e.target.value)}/><input className="auth-input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="button button-primary auth-submit" onClick={submit}>{signup?'Create account':'Sign in'} <span>↗</span></button>{error&&<p className="auth-error">{error}</p>}{notice&&<p className="auth-notice">{notice}</p>}{copy.signup&&<button className="auth-switch" onClick={()=>{setSignup(!signup);setError('');setNotice('')}}>{signup?'Already have an account? Sign in':'New here? Create a '+portal+' account'}</button>}<a href="/" className="auth-home">← Back to Naija / Signal</a></div></main>;
}
