'use client';

import {useEffect, useState} from 'react';
import {RequireRole} from '@/lib/guard';
import {supabase} from '@/lib/supabase';

type Submission={submission_id:string;reference_code:string;state:string;lga:string;ward:string;locality:string|null;address:string;payload:Record<string,unknown>;submitted_at:string;routing_reason:string|null};

function ReviewView(){
 const[items,setItems]=useState<Submission[]>([]);const[notes,setNotes]=useState<Record<string,string>>({});const[working,setWorking]=useState<string|null>(null);const[message,setMessage]=useState('');
 async function load(){const{data,error}=await supabase.from('citizen_submissions').select('submission_id,reference_code,state,lga,ward,locality,address,payload,submitted_at,routing_reason').eq('status','pending_enumerator').order('submitted_at',{ascending:false});if(error)setMessage(`Could not load assigned submissions: ${error.message}`);else setItems((data??[]) as Submission[])}
 useEffect(()=>{void load()},[]);
 async function review(item:Submission,action:'approve'|'reject'|'correction_requested'){setWorking(item.submission_id);setMessage('');const{error}=await supabase.rpc('review_citizen_submission',{p_submission_id:item.submission_id,p_action:action,p_review_note:notes[item.submission_id]??null});setMessage(error?.message??`Submission ${item.reference_code} marked ${action.replace(/_/g,' ')}.`);setWorking(null);if(!error)void load()}
 return <main className="field-page"><div className="field-header"><div><p className="eyebrow">Enumerator review</p><h1>Assigned citizen entries</h1><p>Only submissions routed to your assigned enumeration areas appear here.</p></div><a className="auth-home" href="/enumerator">← Enumerator capture</a></div>{message&&<p className="capture-message">{message}</p>}{items.length?items.map(item=><article className="capture-card" key={item.submission_id}><div className="section-title"><h2>{item.reference_code}</h2><span>{new Date(item.submitted_at).toLocaleString()}</span></div><p><strong>Location:</strong> {item.state} / {item.lga} / {item.ward}{item.locality?` / ${item.locality}`:''}</p><p><strong>Address:</strong> {item.address}</p><details><summary>{Array.isArray(item.payload?.individuals)?item.payload.individuals.length:0} household members</summary><pre>{JSON.stringify(item.payload?.individuals??[],null,2)}</pre></details><textarea className="auth-input" placeholder="Review note or rejection reason" value={notes[item.submission_id]??''} onChange={event=>setNotes(current=>({...current,[item.submission_id]:event.target.value}))}/><div className="hero-actions"><button className="button button-primary" disabled={working===item.submission_id} onClick={()=>void review(item,'approve')}>Approve</button><button className="button" disabled={working===item.submission_id} onClick={()=>void review(item,'correction_requested')}>Request correction</button><button className="button" disabled={working===item.submission_id} onClick={()=>void review(item,'reject')}>Reject</button></div></article>):!message&&<p className="empty-state">No citizen submissions are waiting for your review.</p>}</main>
}

export default function EnumeratorReview(){return <RequireRole allow={['enumerator']}><ReviewView/></RequireRole>}
