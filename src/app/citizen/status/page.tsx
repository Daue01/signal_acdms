'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';

type StatusResult={referenceCode:string;status:string;submittedAt:string;updatedAt:string};
const labels:Record<string,string>={pending_enumerator:'Waiting for enumerator review',needs_admin:'Waiting for administrator resolution',approved:'Approved',rejected:'Rejected',correction_requested:'Correction requested'};

export default function CitizenStatus(){
 const[reference,setReference]=useState('');const[result,setResult]=useState<StatusResult|null>(null);const[error,setError]=useState('');const[loading,setLoading]=useState(false);
 useEffect(()=>{const value=new URLSearchParams(window.location.search).get('reference');if(value){setReference(value);void lookup(value)}},[]);
 async function lookup(value=reference){setError('');setResult(null);setLoading(true);try{const response=await fetch(`/api/citizen/status?reference=${encodeURIComponent(value)}`);const body=await response.json();if(!response.ok)throw new Error(body.error??'Reference code not found.');setResult(body as StatusResult)}catch(e){setError(e instanceof Error?e.message:'Could not check status.')}finally{setLoading(false)}}
 return <main className="field-page"><div className="field-header"><div><p className="eyebrow">Public status tracking</p><h1>Check a submission</h1><p>Enter the reference code you received. No personal details are shown here.</p></div><Link className="auth-home" href="/">← Back to Naija / Signal</Link></div><section className="capture-card"><form onSubmit={event=>{event.preventDefault();void lookup()}}><label className="field-label">Reference code<input className="auth-input" required placeholder="ACD-XXXXXXXXXXXX" value={reference} onChange={event=>setReference(event.target.value.toUpperCase())}/></label><button className="button button-primary" disabled={loading}>{loading?'Checking…':'Check status'} <span>↗</span></button></form>{error&&<p className="auth-error" role="alert">{error}</p>}{result&&<div className="capture-message"><strong>{result.referenceCode}</strong><p>{labels[result.status]??result.status}</p><small>Last updated {new Date(result.updatedAt).toLocaleString()}</small></div>}</section><p className="field-alert">Status tracking shows workflow state only. It never exposes household members, income, car ownership or address details.</p></main>
}
