'use client';

import {useEffect, useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {RequireRole} from '@/lib/guard';
import {supabase} from '@/lib/supabase';
import styles from './citizen.module.css';

type SubmissionStatus='pending'|'approved'|'rejected';
type Submission={
 submission_id:string;
 state:string;
 lga:string;
 ward:string;
 address:string;
 status:SubmissionStatus;
 submitted_at:string;
};

const statusLabel:Record<SubmissionStatus,string>={pending:'Awaiting review',approved:'Approved',rejected:'Needs attention'};

function CitizenDashboardView(){
 const[name,setName]=useState('Citizen');
 const[submissions,setSubmissions]=useState<Submission[]>([]);
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');

 useEffect(()=>{
  let active=true;
  async function load(){
   setLoading(true);
   const{data:{user},error:userError}=await supabase.auth.getUser();
   if(userError){if(active){setError(userError.message);setLoading(false)}return}
   if(!user){if(active){setError('Your session has expired. Please sign in again.');setLoading(false)}return}

   const[profileResult,submissionResult]=await Promise.all([
    supabase.from('profiles').select('full_name').eq('user_id',user.id).single(),
    supabase.from('citizen_submissions').select('submission_id,state,lga,ward,address,status,submitted_at').order('submitted_at',{ascending:false}),
   ]);
   if(!active)return;
   if(profileResult.error||submissionResult.error){
    const errors=[profileResult.error,submissionResult.error].filter(Boolean).map(result=>result?.message);
    setError(`Could not load your dashboard: ${errors.join('; ')}`);
   }else{
    setName(profileResult.data.full_name);
    setSubmissions((submissionResult.data??[]) as Submission[]);
   }
   setLoading(false);
  }
  void load();
  return()=>{active=false};
 },[]);

 const count=(status:SubmissionStatus)=>submissions.filter(item=>item.status===status).length;

 async function signOut(){
  const{error:signOutError}=await supabase.auth.signOut();
  if(signOutError){setError(`Could not sign out: ${signOutError.message}`);return}
  window.location.assign('/login/citizen');
 }

 return <main className={styles.page}>
  <header className={styles.header}>
   <Link className={styles.brand} href="/" aria-label="Naija Signal home"><Image src="/naija-signal-logo.png" alt="Naija Signal" width={746} height={334}/></Link>
   <div className={styles.headerActions}>
    <span className={styles.role}>Citizen portal</span>
    <button type="button" onClick={()=>void signOut()}>Sign out</button>
   </div>
  </header>
  <section className={styles.welcome}>
   <div>
    <p className={styles.eyebrow}>Your community · Your contribution</p>
    <h1>Welcome, {name}.</h1>
    <p>Manage your household submissions and follow their review status from one place.</p>
   </div>
   <Link className={styles.primaryAction} href="/citizen/form">Submit household <span>↗</span></Link>
  </section>
  {error&&<p className={styles.error} role="alert">{error}</p>}
  <section className={styles.stats} aria-label="Submission summary">
    <article><span>Total submissions</span><strong>{loading?'…':submissions.length}</strong></article>
    <article><span>Awaiting review</span><strong>{loading?'…':count('pending')}</strong></article>
    <article><span>Approved</span><strong>{loading?'…':count('approved')}</strong></article>
    <article><span>Needs attention</span><strong>{loading?'…':count('rejected')}</strong></article>
  </section>
  <section className={styles.submissions}>
   <div className={styles.sectionHeading}>
    <div><p className={styles.eyebrow}>Your records</p><h2>Household submissions</h2></div>
    <Link href="/citizen/form">Add a submission <span>↗</span></Link>
   </div>
   {loading?<p className={styles.empty}>Loading your submissions…</p>:submissions.length?
    <div className={styles.list}>{submissions.map(item=><article className={styles.submission} key={item.submission_id}>
     <div><h3>{item.address}</h3><p>{item.state} / {item.lga} / {item.ward}</p><small>Submitted {new Date(item.submitted_at).toLocaleDateString()}</small></div>
     <span className={`${styles.status} ${styles[item.status]}`}>{statusLabel[item.status]}</span>
    </article>)}</div>
    :<div className={styles.emptyState}><strong>No household submissions yet.</strong><p>Submit your household details to send them to the administrator for review.</p><Link href="/citizen/form">Start a household form <span>↗</span></Link></div>}
  </section>
  <footer className={styles.footer}>Your details stay pending until an administrator reviews them.</footer>
 </main>
}

export default function CitizenDashboard(){return <RequireRole allow={['citizen']}><CitizenDashboardView/></RequireRole>}
