import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';

const querySchema=z.object({state_id:z.coerce.number().int().positive(),lga_id:z.coerce.number().int().positive().optional()});
type GeoRow={state:string;lga:string;ward:string};

function ascii(value:string){return value.normalize('NFKD').replace(/[^\x20-\x7e]/g,'?')}
function pdfText(value:string){return ascii(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)')}

function makePdf(title:string,rows:GeoRow[]){
 const lines=[title,'Source: ACDMS geography register','Edition: current database snapshot','', 'State | LGA | Ward', ...rows.map(row=>`${row.state} | ${row.lga} | ${row.ward}`)];
 const pageSize=46;const pages:string[][]=[];for(let i=0;i<lines.length;i+=pageSize)pages.push(lines.slice(i,i+pageSize));
 const catalog=1,pagesObject=2,font=3;const pageIds=pages.map((_,index)=>4+index);const contentIds=pages.map((_,index)=>4+pages.length+index);const objects=new Map<number,string>();
 objects.set(catalog,`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`);
 objects.set(pagesObject,`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pages.length} >>`);
 objects.set(font,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 pages.forEach((page,index)=>{
  const stream=['BT','/F1 10 Tf','40 750 Td',...page.map((line,lineIndex)=>`${lineIndex?'0 -15 Td ':''}(${pdfText(line)}) Tj`),'ET'].join('\n');
  objects.set(pageIds[index],`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentIds[index]} 0 R >>`);
  objects.set(contentIds[index],`<< /Length ${Buffer.byteLength(stream,'ascii')} >>\nstream\n${stream}\nendstream`);
 });
 const chunks=[Buffer.from('%PDF-1.4\n','ascii')];const offsets:number[]=[0];let offset=chunks[0].length;const maxId=Math.max(...objects.keys());
 for(let id=1;id<=maxId;id++){const body=objects.get(id)??'';const chunk=Buffer.from(`${id} 0 obj\n${body}\nendobj\n`,'ascii');offsets[id]=offset;chunks.push(chunk);offset+=chunk.length}
 const xrefOffset=offset;let xref=`xref\n0 ${maxId+1}\n0000000000 65535 f \n`;for(let id=1;id<=maxId;id++)xref+=`${String(offsets[id]).padStart(10,'0')} 00000 n \n`;xref+=`trailer\n<< /Size ${maxId+1} /Root ${catalog} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;chunks.push(Buffer.from(xref,'ascii'));return Buffer.concat(chunks);
}

export async function GET(request:NextRequest){
 const parsed=querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));if(!parsed.success)return NextResponse.json({error:'A valid state_id is required.'},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return NextResponse.json({error:'Supabase is not configured'},{status:503});
 const client=createClient(url,key);const stateQuery=await client.from('states').select('state_id,name').eq('state_id',parsed.data.state_id).maybeSingle();if(stateQuery.error)return NextResponse.json({error:stateQuery.error.message},{status:500});const state=stateQuery.data;if(!state)return NextResponse.json({error:'State not found.'},{status:404});
 let lgaQuery=client.from('lgas').select('lga_id,name').eq('state_id',parsed.data.state_id);if(parsed.data.lga_id)lgaQuery=lgaQuery.eq('lga_id',parsed.data.lga_id);const lgas=await lgaQuery.order('name');if(lgas.error)return NextResponse.json({error:lgas.error.message},{status:500});if(parsed.data.lga_id&&!lgas.data?.length)return NextResponse.json({error:'LGA does not belong to the selected state.'},{status:400});
 const lgaIds=(lgas.data??[]).map(row=>row.lga_id);if(!lgaIds.length)return NextResponse.json({error:'No LGAs are imported for this state.'},{status:404});const wards=await client.from('wards').select('lga_id,name').in('lga_id',lgaIds).order('name');if(wards.error)return NextResponse.json({error:wards.error.message},{status:500});if(!wards.data?.length)return NextResponse.json({error:'Wards are not yet imported for this state.'},{status:404});
 const lgaName=new Map((lgas.data??[]).map(row=>[row.lga_id,row.name]));const rows=(wards.data??[]).map(row=>({state:state.name,lga:lgaName.get(row.lga_id)??'',ward:row.name}));const title=`ACDMS geography - ${state.name}${parsed.data.lga_id?` / ${lgaName.get(parsed.data.lga_id)??''}`:''}`;const pdf=makePdf(title,rows);
 return new NextResponse(pdf,{status:200,headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="acdms-geography-${state.name.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.pdf"`,'Cache-Control':'no-store'}});
}
