// UI verification only; the dashboard itself has no Node dependency.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),out=path.join(root,'test-output');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(pathToFileURL(path.join(root,'dist/index.html')).href);
 await page.locator('#app').waitFor({state:'visible'});
 await page.screenshot({path:path.join(out,'01-industry.png'),fullPage:true});
 const data=await page.evaluate(()=>({counts:AUDIT.counts,selected:CATALOG.filter(x=>x.selected).length,modules:Object.keys(modules).length}));
 assert.equal(data.selected,17);assert.equal(data.counts.postings,135);
 for(let i=0;i<6;i++){
  await page.locator(`#nav [data-page="${i}"]`).click();
  assert.equal(await page.locator('[data-module]').evaluateAll(ns=>ns.filter(n=>!n.querySelector('.evidence')).length),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'desktop overflow '+i);
 }
 const aiId=await page.evaluate(()=>rows('T').find(r=>roleMap(r)?.id==='AI').job_id);
 await page.selectOption('#role',aiId);await page.locator('#nav [data-page="2"]').click();
 assert.ok(await page.locator('[data-course]').count()>0);
 await page.locator('[data-skill]').first().check();await page.locator('[data-course]').first().click();await page.locator('[data-project]').check();
 await page.locator('#nav [data-page="3"]').click();assert.ok(await page.locator('[data-posting]').count()>0);
 await page.locator('[data-posting]').first().click();await page.locator('#nav [data-page="4"]').click();
 await page.selectOption('[data-state="education"]','대졸');await page.selectOption('[data-state="experience"]','신입');
 assert.match(await page.locator('[data-module="condition-match"]').innerText(),/미확인/);
 assert.match(await page.locator('[data-module="action-plan"]').innerText(),/보고서/);
 await page.screenshot({path:path.join(out,'05-roadmap.png'),fullPage:true});
 const comparison=await page.evaluate(()=>{
  const old={...state};state.education='';state.experience='경력';state.years='2';state.region='';
  const missing=conditionCompare({education_normalized:'불명',career_type:'불명',province_name:''});
  const bounded=conditionCompare({education_normalized:'대졸',career_type:'경력',career_min_years:'3',career_max_years:'5',province_name:'서울'});
  state={...old};return {missing,bounded};
 });
 assert.equal(comparison.missing[0][2],'미확인');assert.equal(comparison.missing[1][2],'미확인');assert.equal(comparison.bounded[1][2],'불일치');
 await page.locator('#nav [data-page="2"]').click();await page.locator('[data-module="courses"] > details > summary').click();
 await page.locator('[data-module="courses"] [data-raw="Training_Course_Master"]').click();
 await page.locator('#rawSearch').fill('AIOT');await page.locator('#rawSearchButton').click();
 assert.match(await page.locator('#rawBody').innerText(),/AIOT 기반 드론 영상/);
 await page.selectOption('#rawDataset','Training_Session_Analysis');await page.locator('[data-raw-page="1"]').click();
 assert.match(await page.locator('#rawBody').innerText(),/2 \/ 64페이지/);await page.locator('#closeRaw').click();
 await page.locator('[data-review="courses"][data-review-field="decision"]').selectOption('수정');
 await page.locator('[data-review="courses"][data-review-field="note"]').fill('검토 테스트: 커리큘럼 수집 우선 <안전한 텍스트>');
 const promise=page.waitForEvent('download');await page.locator('#save').click();
 const saved=await promise,savedPath=path.join(out,'export-review.html');await saved.saveAs(savedPath);
 const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));
 await offline.route('http://**/*',r=>r.abort());await offline.route('https://**/*',r=>r.abort());
 await offline.goto(pathToFileURL(savedPath).href);await offline.locator('#app').waitFor({state:'visible'});
 assert.equal(await offline.locator('#role').inputValue(),aiId);
 const restored=await offline.evaluate(()=>state);
 assert.equal(restored.reviews.courses.decision,'수정');assert.match(restored.reviews.courses.note,/<안전한 텍스트>/);assert.ok(restored.course);assert.ok(restored.posting);await offline.close();
 await page.locator('#nav [data-page="3"]').click();await page.selectOption('#region','제주');
 assert.match(await page.locator('[data-module="postings"]').innerText(),/관측 공고 0건/);
 await page.selectOption('#role','DJ-001');
 assert.deepEqual(await page.evaluate(()=>({course:state.course,posting:state.posting,project:state.project})),{course:'',posting:'',project:false});
 await page.locator('#reset').click();assert.equal(await page.evaluate(()=>rows('J').filter(p=>!companyFor(p)).length),83);
 // Field-operation path: newcomer conditions remain distinct from experience-unspecified.
 await page.locator('#nav [data-page="1"]').click();await page.locator('[data-activity="현장"]').click();
 assert.ok(await page.locator('[data-role]').count()>0);
 const ops=await page.evaluate(()=>rows('T').find(r=>roleMap(r)?.id==='OPS').job_id);
 await page.selectOption('#role',ops);await page.locator('#nav [data-page="3"]').click();
 await page.selectOption('[data-state="career"]','신입');
 assert.equal(await page.evaluate(()=>filteredPostings().every(p=>p.career_type==='신입')),true);
 await page.selectOption('[data-state="career"]','무관');
 assert.equal(await page.evaluate(()=>filteredPostings().every(p=>p.career_type==='무관')),true);
 // Defense linkage stays tied to technology/learning and preserves unknown employer groups.
 await page.locator('#reset').click();await page.locator('#nav [data-page="0"]').click();
 await page.selectOption('[data-state="tech"]','DT06');await page.locator('[data-tech-roles="DT06"]').click();
 assert.ok(await page.locator('[data-role]').count()>0);
 await page.locator('[data-role]').first().click();await page.locator('#nav [data-page="2"]').click();
 assert.match(await page.locator('[data-module="skills"]').innerText(),/국방 응용/);
 await page.locator('#reset').click();await page.locator('#nav [data-page="3"]').click();
 assert.match(await page.locator('[data-module="defense-comparison"]').innerText(),/기업정보 미연결/);
 await page.locator('[data-module="companies"] > details > summary').click();
 await page.screenshot({path:path.join(out,'04-defense-evidence.png'),fullPage:true});
 const missingIds=new Set();
 for(let i=0;i<6;i++){
  await page.locator(`#nav [data-page="${i}"]`).click();
  for(const id of await page.locator('[data-module^="missing-"]').evaluateAll(ns=>ns.map(n=>n.dataset.module)))missingIds.add(id);
  assert.equal(await page.locator('[data-module^="missing-"] .empty').count(),await page.locator('[data-module^="missing-"]').count());
 }
 assert.equal(missingIds.size,7);await page.screenshot({path:path.join(out,'06-review.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 for(let i=0;i<6;i++){
  await page.locator(`#nav [data-page="${i}"]`).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow '+i);
 }
 await page.locator('#nav [data-page="0"]').click();await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>document.documentElement.style.fontSize='32px');
 for(let i=0;i<6;i++){
  await page.locator(`#nav [data-page="${i}"]`).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'200% text overflow '+i);
 }
 assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(requests.filter(r=>/^https?:/.test(r)).length,0);
 const summary={status:'PASS',data,checks:['6 pages and evidence panels','AI role → skill → course → posting → roadmap','field operation / new vs unspecified experience','defense technology → role → learning','three-state conditions','source search/pagination','HTML export and offline restore','region empty state','role reset','unmatched companies retained','7 empty future datasets','desktop/mobile/200% text overflow','no external requests or console errors']};
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
