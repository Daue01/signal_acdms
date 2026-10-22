'use client';

import {useState} from 'react';
import type {Individual,IndividualField} from '@/lib/validation';
import type {HouseholdCensusResponses, IndividualCensusResponses} from '@/lib/censusQuestionnaire';
import {questionnaireLanguages,translateQuestionnaire,type QuestionnaireLanguage} from '@/lib/npc01Translations';

type ResponseValue=string|number|boolean|undefined;
type PersonValue=string|number|undefined;
type Props={
 people:Individual[];
 householdResponses:HouseholdCensusResponses;
 inputClass:string;
 onPersonChange:(index:number,key:IndividualField,value:PersonValue)=>void;
 onPersonResponseChange:<K extends keyof IndividualCensusResponses>(index:number,key:K,value:IndividualCensusResponses[K]|undefined)=>void;
 onHouseholdResponseChange:<K extends keyof HouseholdCensusResponses>(key:K,value:HouseholdCensusResponses[K]|undefined)=>void;
 onAddPerson:()=>void;
 onRemovePerson:(index:number)=>void;
};

const educationOptions:Array<[string,string]>=[['none','No formal schooling'],['primary','Primary'],['junior_secondary','Junior secondary'],['senior_secondary','Senior secondary'],['vocational','Technical or vocational'],['post_secondary','Post-secondary']];
const responseOptions:Array<[string,string]>=[['none','No difficulty'],['some','Some difficulty'],['a_lot','A lot of difficulty'],['cannot_do','Cannot do at all']];
const difficultyQuestions=[
 ['seeing','Seeing, even with glasses'],
 ['hearing','Hearing, even with a hearing aid'],
 ['walking','Walking or climbing steps'],
 ['remembering','Remembering or concentrating'],
 ['self_care','Washing or dressing'],
 ['communication','Communicating in the person’s usual language'],
] as const;
const input='border border-gray-300 p-2 rounded w-full bg-white';
function completedAge(dateOfBirth:string){
 const birth=new Date(dateOfBirth);
 const today=new Date();
 return today.getFullYear()-birth.getFullYear()-(
  today.getMonth()<birth.getMonth()||
  (today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate())?1:0
 );
}

function selectValue(value:string|undefined,options:Array<[string,string]>,placeholder:string,onChange:(value:string|undefined)=>void){
 return <select className={input} value={value??''} onChange={event=>onChange(event.target.value||undefined)}>
  <option value="">{placeholder}</option>{options.map(([option,label])=><option key={option} value={option}>{label}</option>)}
 </select>;
}

function numberValue(value:number|undefined,onChange:(value:number|undefined)=>void){
 return <input className={input} type="number" min="0" max="1000" value={value??''} onChange={event=>onChange(event.target.value===''?undefined:Number(event.target.value))}/>;
}

export default function Npc01Questionnaire({people,householdResponses,inputClass,onPersonChange,onPersonResponseChange,onHouseholdResponseChange,onAddPerson,onRemovePerson}:Props){
 const[language,setLanguage]=useState<QuestionnaireLanguage>('en');
 const t=(text:string)=>translateQuestionnaire(language,text);
 const localizedOptions=(options:Array<[string,string]>)=>options.map(([value,label])=>[value,t(label)] as [string,string]);
 const localizedSelect=(value:string|undefined,options:Array<[string,string]>,placeholder:string,onChange:(value:string|undefined)=>void)=>
  selectValue(value,localizedOptions(options),t(placeholder),onChange);
 return <>
  <section className="capture-card npc-questionnaire">
   <div className="section-title"><h2>{t('NPC 01 · Household demographic and social characteristics')}</h2><span>{t('Complete one record per household member')}</span></div>
   <label className="field-label npc-language">{t('Questionnaire language')}<select className={inputClass} value={language} onChange={event=>setLanguage(event.target.value as QuestionnaireLanguage)}>{questionnaireLanguages.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
   <p className="npc-intro">{t('Sections follow the')} <a href="http://2023census.gov.ng/pages/census-questionaire" target="_blank" rel="noreferrer">{t('NPC instrument overview')}</a>. {t('These digital prompts are original adaptations, not a verbatim official questionnaire. Answer what you know; optional items may be left blank.')}</p>
   {people.map((person,index)=>{
    const personAge=person.age??(person.date_of_birth?completedAge(person.date_of_birth):undefined);
    const femaleOfFertileAge=person.sex==='female'&&personAge!==undefined&&personAge>=15;
    return <article className="person-card" key={index}>
     <div className="person-heading"><strong>{t('Person')} {index+1}</strong>{people.length>1&&<button type="button" onClick={()=>onRemovePerson(index)}>{t('Remove')}</button>}</div>
     <fieldset className="npc-section">
      <legend>{t('Demographic and social characteristics')}</legend>
      <div className="field-grid">
       <label className="field-label">{t('Surname')}<input className={inputClass} required value={person.surname} onChange={event=>onPersonChange(index,'surname',event.target.value)}/></label>
       <label className="field-label">{t('Given name(s)')}<input className={inputClass} required value={person.firstname} onChange={event=>onPersonChange(index,'firstname',event.target.value)}/></label>
       <label className="field-label">{t('Sex')}<select className={inputClass} required value={person.sex} onChange={event=>onPersonChange(index,'sex',event.target.value)}><option value="">{t('Select')}</option><option value="male">{t('Male')}</option><option value="female">{t('Female')}</option></select></label>
       <label className="field-label">{t('Age in completed years')}<input className={inputClass} type="number" min="0" max="120" value={person.age??''} onChange={event=>onPersonChange(index,'age',event.target.value===''?undefined:Number(event.target.value))}/></label>
       <label className="field-label">{t('Date of birth (if known)')}<input className={inputClass} type="date" value={person.date_of_birth??''} onChange={event=>onPersonChange(index,'date_of_birth',event.target.value||undefined)}/></label>
       <label className="field-label">{t('Relationship to household head')}<select className={inputClass} value={person.relationship_to_head??''} onChange={event=>onPersonChange(index,'relationship_to_head',event.target.value||undefined)}><option value="">{t('Select')}</option><option value="head">{t('Head')}</option><option value="spouse">{t('Spouse or partner')}</option><option value="child">{t('Son or daughter')}</option><option value="parent">{t('Parent')}</option><option value="sibling">{t('Brother or sister')}</option><option value="other_relative">{t('Other relative')}</option><option value="non_relative">{t('Unrelated person')}</option></select></label>
       <label className="field-label">{t('Religion')}{localizedSelect(person.census_responses.religion,[['christian','Christianity'],['muslim','Islam'],['traditional','Traditional or Indigenous religion'],['other','Other religion'],['prefer_not_to_say','Prefer not to answer']],'Not stated',value=>onPersonResponseChange(index,'religion',value as IndividualCensusResponses['religion']))}</label>
       <label className="field-label">{t('Ethnic group')}<input className={inputClass} maxLength={160} placeholder={t('Enter the person’s ethnic group')} value={person.census_responses.ethnicity??''} onChange={event=>onPersonResponseChange(index,'ethnicity',event.target.value||undefined)}/></label>
      </div>
     </fieldset>
     <fieldset className="npc-section">
      <legend>{t('Marital status')}</legend>
      <label className="field-label">{t('Current status')}{localizedSelect(person.census_responses.marital_status,[['never_married','Never married'],['married','Married or in union'],['separated','Separated'],['divorced','Divorced'],['widowed','Widowed']],'Select status',value=>onPersonResponseChange(index,'marital_status',value as IndividualCensusResponses['marital_status']))}</label>
     </fieldset>
     <fieldset className="npc-section">
      <legend>{t('Literacy')}</legend>
      <div className="field-grid">
       {(['can_read','can_write'] as const).map(key=><label className="field-label" key={key}>{t(key==='can_read'?'Can read a short message?':'Can write a short message?')}<select className={inputClass} value={person.census_responses[key]===undefined?'':String(person.census_responses[key])} onChange={event=>onPersonResponseChange(index,key,event.target.value===''?undefined:event.target.value==='true')}><option value="">{t('Not stated')}</option><option value="true">{t('Yes')}</option><option value="false">{t('No')}</option></select></label>)}
      </div>
     </fieldset>
     <fieldset className="npc-section">
      <legend>{t('Education')}</legend>
      <div className="field-grid">
       <label className="field-label">{t('Currently attending school or training?')}<select className={inputClass} value={person.census_responses.currently_attending_school===undefined?'':String(person.census_responses.currently_attending_school)} onChange={event=>onPersonResponseChange(index,'currently_attending_school',event.target.value===''?undefined:event.target.value==='true')}><option value="">{t('Not stated')}</option><option value="true">{t('Yes')}</option><option value="false">{t('No')}</option></select></label>
       <label className="field-label">{t('Highest level completed')}{localizedSelect(person.census_responses.highest_education_level,educationOptions,'Select level',value=>{onPersonResponseChange(index,'highest_education_level',value);onPersonChange(index,'education_level',value)})}</label>
      </div>
     </fieldset>
     <fieldset className="npc-section">
      <legend>{t('Economic characteristics')}</legend>
      <div className="field-grid">
       <label className="field-label">{t('Main work situation')}{localizedSelect(person.census_responses.employment_status,[['employed','Working for pay or profit'],['seeking_work','Looking for work'],['student','Student'],['homemaker','Home duties'],['retired','Retired'],['unable_to_work','Unable to work'],['other','Other']],'Select situation',value=>onPersonResponseChange(index,'employment_status',value as IndividualCensusResponses['employment_status']))}</label>
       <label className="field-label">{t('Main occupation')}<input className={inputClass} maxLength={160} value={person.census_responses.occupation??''} onChange={event=>{const value=event.target.value||undefined;onPersonResponseChange(index,'occupation',value);onPersonChange(index,'occupation',value)}}/></label>
       <label className="field-label">{t('Industry or type of work')}<input className={inputClass} maxLength={160} value={person.census_responses.industry??''} onChange={event=>onPersonResponseChange(index,'industry',event.target.value||undefined)}/></label>
      </div>
     </fieldset>
     <fieldset className="npc-section">
      <legend>{t('International and internal migration')}</legend>
      <div className="field-grid">
       <label className="field-label">{t('Country of birth')}<input className={inputClass} maxLength={160} value={person.census_responses.country_of_birth??''} onChange={event=>onPersonResponseChange(index,'country_of_birth',event.target.value||undefined)}/></label>
       <label className="field-label">{t('State of birth (if in Nigeria)')}<input className={inputClass} maxLength={160} value={person.census_responses.state_of_birth??''} onChange={event=>onPersonResponseChange(index,'state_of_birth',event.target.value||undefined)}/></label>
       <label className="field-label">{t('Previous usual place of residence')}<input className={inputClass} maxLength={160} value={person.census_responses.previous_residence??''} onChange={event=>onPersonResponseChange(index,'previous_residence',event.target.value||undefined)}/></label>
       <label className="field-label">{t('Years living in this locality')}<input className={inputClass} type="number" min="0" max="120" value={person.census_responses.years_in_current_residence??''} onChange={event=>onPersonResponseChange(index,'years_in_current_residence',event.target.value===''?undefined:Number(event.target.value))}/></label>
      </div>
     </fieldset>
     <fieldset className="npc-section">
      <legend>{t('Information and communication technology')}</legend>
      <div className="checks">{([
       ['owns_mobile_phone','Owns or uses a mobile phone'],
       ['uses_internet','Uses the internet'],
       ['uses_computer','Uses a computer or tablet'],
      ] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={person.census_responses[key]??false} onChange={event=>onPersonResponseChange(index,key,event.target.checked)}/>{t(label)}</label>)}</div>
     </fieldset>
     <fieldset className="npc-section">
      <legend>{t('Difficulty performing activities')}</legend>
      <p className="npc-intro">{t('For each activity, choose the response that best describes the person’s usual level of difficulty.')}</p>
      <div className="field-grid">{difficultyQuestions.map(([key,label])=><label className="field-label" key={key}>{t(label)}{localizedSelect(person.census_responses.functional_difficulties[key],responseOptions,'Not stated',value=>onPersonResponseChange(index,'functional_difficulties',{...person.census_responses.functional_difficulties,[key]:value as IndividualCensusResponses['functional_difficulties'][typeof key]}))}</label>)}</div>
     </fieldset>
     {femaleOfFertileAge&&<fieldset className="npc-section">
      <legend>{t('Fertility and child survival')}</legend>
      <p className="npc-intro">{t('These optional questions concern live births. You may skip any answer.')}</p>
      <div className="field-grid">
       <label className="field-label">{t('Children ever born alive')}{numberValue(person.census_responses.children_ever_born,value=>onPersonResponseChange(index,'children_ever_born',value))}</label>
       <label className="field-label">{t('Of these, how many are still alive?')}{numberValue(person.census_responses.children_still_alive,value=>onPersonResponseChange(index,'children_still_alive',value))}</label>
       <label className="field-label">{t('Live births in the past 12 months')}{numberValue(person.census_responses.births_last_12_months,value=>onPersonResponseChange(index,'births_last_12_months',value))}</label>
      </div>
     </fieldset>}
     {(femaleOfFertileAge&&(person.census_responses.children_ever_born??0)>0)&&<fieldset className="npc-section">
      <legend>{t('Survival status of the last child')}</legend>
      <label className="field-label">{t('Is the most recently born child still alive?')}<select className={inputClass} value={person.census_responses.last_child_survived===undefined?'':String(person.census_responses.last_child_survived)} onChange={event=>onPersonResponseChange(index,'last_child_survived',event.target.value===''?undefined:event.target.value==='true')}><option value="">{t('Not stated')}</option><option value="true">{t('Yes')}</option><option value="false">{t('No')}</option></select></label>
     </fieldset>}
    </article>;
   })}
   <button className="add-member" type="button" onClick={onAddPerson}>+ {t('Add household member')}</button>
  </section>
  <section className="capture-card npc-questionnaire">
   <div className="section-title"><h2>NPC 01 · {t('Mortality (household deaths)')}</h2><span>{t('Optional household-level questions')}</span></div>
   <div className="field-grid">
    <label className="field-label">{t('Has any usual household member died in the last 12 months?')}<select className={inputClass} value={householdResponses.household_death_in_last_year===undefined?'':String(householdResponses.household_death_in_last_year)} onChange={event=>onHouseholdResponseChange('household_death_in_last_year',event.target.value===''?undefined:event.target.value==='true')}><option value="">{t('Not stated')}</option><option value="true">{t('Yes')}</option><option value="false">{t('No')}</option></select></label>
    {householdResponses.household_death_in_last_year&&<label className="field-label">{t('Number of household deaths in that period')}{numberValue(householdResponses.household_deaths_count,value=>onHouseholdResponseChange('household_deaths_count',value))}</label>}
   </div>
  </section>
  <section className="capture-card npc-questionnaire">
   <div className="section-title"><h2>{t('NPC 01 · Housing characteristics and amenities')}</h2><span>{t('Optional household-level questions')}</span></div>
   <div className="field-grid">
    <label className="field-label">{t('Type of building')}{localizedSelect(householdResponses.building_type,[['detached','Detached house'],['semi_detached','Semi-detached house'],['flat','Flat or apartment'],['compound','Room in compound'],['temporary','Temporary or improvised dwelling'],['other','Other']],'Select type',value=>onHouseholdResponseChange('building_type',value))}</label>
    <label className="field-label">{t('Main wall material')}<input className={inputClass} maxLength={160} value={householdResponses.wall_material??''} onChange={event=>onHouseholdResponseChange('wall_material',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Main roof material')}<input className={inputClass} maxLength={160} value={householdResponses.roof_material??''} onChange={event=>onHouseholdResponseChange('roof_material',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Main floor material')}<input className={inputClass} maxLength={160} value={householdResponses.floor_material??''} onChange={event=>onHouseholdResponseChange('floor_material',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Number of rooms used for sleeping')}{numberValue(householdResponses.number_of_rooms,value=>onHouseholdResponseChange('number_of_rooms',value))}</label>
    <label className="field-label">{t('Household tenure')}{localizedSelect(householdResponses.tenure_status,[['owned','Owned by a household member'],['rented','Rented'],['rent_free','Occupied rent-free'],['other','Other']],'Select tenure',value=>onHouseholdResponseChange('tenure_status',value))}</label>
   </div>
  </section>
  <section className="capture-card npc-questionnaire">
   <div className="section-title"><h2>{t('NPC 01 · Housing sanitation')}</h2><span>{t('Optional household-level questions')}</span></div>
   <div className="field-grid">
    <label className="field-label">{t('Main source of drinking water')}<input className={inputClass} maxLength={160} value={householdResponses.main_drinking_water_source??''} onChange={event=>onHouseholdResponseChange('main_drinking_water_source',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Main toilet facility')}<input className={inputClass} maxLength={160} value={householdResponses.toilet_facility??''} onChange={event=>onHouseholdResponseChange('toilet_facility',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Wastewater disposal')}<input className={inputClass} maxLength={160} value={householdResponses.wastewater_disposal??''} onChange={event=>onHouseholdResponseChange('wastewater_disposal',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Solid waste disposal')}<input className={inputClass} maxLength={160} value={householdResponses.solid_waste_disposal??''} onChange={event=>onHouseholdResponseChange('solid_waste_disposal',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Main cooking fuel')}<input className={inputClass} maxLength={160} value={householdResponses.cooking_fuel??''} onChange={event=>onHouseholdResponseChange('cooking_fuel',event.target.value||undefined)}/></label>
    <label className="field-label">{t('Main source of lighting')}<input className={inputClass} maxLength={160} value={householdResponses.lighting_source??''} onChange={event=>onHouseholdResponseChange('lighting_source',event.target.value||undefined)}/></label>
   </div>
  </section>
 </>;
}
