const {chromium}=require('playwright');
const fs=require('fs');
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true});const p=await b.newPage();
 await p.goto('file:///C:/Workspaces/testDash01/dashboard/dist/index.html');await p.locator('#app').waitFor({state:'visible'});
 const result=await p.evaluate(()=>{[industry,rolesPage,preparation,postingsPage,roadmap,reviewPage].forEach(f=>f());return {modules,sources:SOURCES,missing:MISSING,rules:ROLE_RULES.map(r=>({...r,pattern:String(r.pattern)})),flags:FIELD_FLAGS};});
 fs.writeFileSync('document_work/runtime-evidence.json',JSON.stringify(result,null,2));console.log(JSON.stringify({moduleCount:Object.keys(result.modules).length,sources:result.sources,missing:result.missing}));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
