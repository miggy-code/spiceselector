/** Validate through the application's actual resolver, not a Python imitation. */
import {writeFileSync} from 'fs';
import {toTaxonomyId} from '../src/lib/spice-id-map';
import taxonomy from '../src/data/spice-taxonomy.json';
import profiles from './generated_profiles.json';
const leaves: {id:string;name:string}[]=[];
function walk(n: {id:string;name:string;level:string;children?:any[]}) {if(n.level==='spice')leaves.push(n);n.children?.forEach(walk)}
walk(taxonomy);
const matches = new Map<string,string[]>(); const unmapped:string[]=[];
for(const p of Object.values(profiles)){const id=toTaxonomyId(p.id,p.name);if(!id)unmapped.push(p.name);else matches.set(id,[...(matches.get(id)??[]),p.name]);}
const report={total:leaves.length,covered:matches.size,missing:leaves.filter(s=>!matches.has(s.id)),duplicates:[...matches].filter(([,v])=>v.length!==1),unmapped};
writeFileSync('ingestion/profile-coverage.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
if(report.duplicates.length||unmapped.length)process.exitCode=1;
if(process.argv.includes('--strict')&&report.missing.length)process.exitCode=1;
