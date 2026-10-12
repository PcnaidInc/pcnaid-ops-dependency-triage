import semver from '../../vendor/semver/index.js';
import {assert} from '../shared/data.mjs';
import {getJSON} from '../shared/network.mjs';
export async function collectReleases({repository,packageName,from,to,token=null,maxPages=5}){
  assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),'Repository must be owner/name');assert(semver.valid(from)&&semver.valid(to)&&semver.gt(to,from),'Use exact ascending semantic versions');assert(Number.isInteger(maxPages)&&maxPages>0&&maxPages<=10,'maxPages must be 1–10');
  const notes=[];let complete=false;
  for(let page=1;page<=maxPages;page++){
    const {data}=await getJSON(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,{allowedHosts:['api.github.com'],token,headers:{'X-GitHub-Api-Version':'2022-11-28'}});assert(Array.isArray(data),'Unexpected GitHub release response');
    for(const r of data){if(r.draft)continue;const tag=String(r.tag_name??''),v=semver.valid(tag)||semver.valid(tag.startsWith(packageName+'@')?tag.slice(packageName.length+1):'');if(v&&semver.gt(v,from)&&semver.lte(v,to)&&r.body)notes.push({package:packageName,version:v,text:r.body,url:r.html_url,source:'github_api'});}
    if(data.length<100){complete=true;break;}
  }
  return {notes,coverage:complete?'available_github_releases_scanned':'page_limit_reached',warnings:['Published GitHub releases need not cover every package version or all migration details. Verify changelog completeness separately.',...(!complete?['Pagination cap reached; additional releases were not retrieved.']:[])]};
}
