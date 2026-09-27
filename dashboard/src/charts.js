// SVG and semantic HTML charts, bundled into the standalone HTML with no CDN.
const COLORS=['#247aca','#12a89d','#ee9954','#8f79c4','#d9798a','#647c92','#b5a266','#7eb6d1'];
const attrs=(action,value)=>action?`data-${action}="${esc(value)}"`:'';
function chartTable(headers,data){return `<details class="chart-table"><summary>차트 수치 보기</summary>${table(headers,data.map(r=>r.map(esc)))}</details>`;}
function svgFrame(content,w,h,label){return `<svg class="data-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${content}</svg>`;}
function lineChart(records,key,unit,color=COLORS[0]){
 const w=360,h=165,p=30,max=Math.max(1,...records.map(r=>Number(r[key]))),x=i=>p+i*(w-p*2)/Math.max(1,records.length-1),y=v=>h-35-Number(v)/max*(h-65);
 const points=records.map((r,i)=>`${x(i)},${y(r[key])}`).join(' ');
 return `<div class="line-chart">${svgFrame([0,.5,1].map(t=>`<line x1="${p}" x2="${w-p}" y1="${y(max*t)}" y2="${y(max*t)}" class="chart-grid"/>`).join('')+`<path d="M${p},${h-35} L${points.replaceAll(' ',' L')} L${w-p},${h-35} Z" fill="${color}" opacity=".08"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="3"/>`+records.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r[key])}" r="4" fill="${color}"><title>${esc(r.reference_year)}: ${num(r[key])}${unit}</title></circle><text x="${x(i)}" y="${y(r[key])-12}" text-anchor="middle">${num(r[key])}</text><text x="${x(i)}" y="${h-10}" text-anchor="middle" class="axis-label">${esc(r.reference_year)}</text>`).join(''),w,h,`연도별 ${key}, 단위 ${unit}; 축 0부터`)}<span class="chart-unit">단위 ${esc(unit)} · 세로축 0부터</span></div>`;
}
function hBars(entries,{unit='건',action='',selected='',color='',denominator=null}={}){
 const max=Math.max(1,...entries.map(r=>Number(r[1])));
 return `<div class="hbars" data-chart="bar">${entries.map(([label,value],i)=>`<${action?'button':'div'} class="hbar ${selected===label?'chosen':''}" ${attrs(action,label)} ${action?`aria-pressed="${selected===label}"`:''} title="${esc(label)}: ${num(value)} ${unit}"><span class="bar-name">${esc(label)}</span><span class="bar-track"><span style="width:${value/max*100}%;background:${color||COLORS[i%COLORS.length]}"></span></span><strong>${num(value)}<small>${esc(unit)}${denominator===null?'':' · '+num(value/Math.max(denominator,1)*100)+'%'}</small></strong></${action?'button':'div'}>`).join('')}</div>`;
}
function stacked(entries,{denominator,unit='건',action='',selected=''}={}){
 const total=denominator??entries.reduce((s,[,v])=>s+Number(v),0);
 if(!total)return empty('선택 범위에서 관측 0건');
 return `<div class="stack-chart" data-chart="stack"><div class="stack-strip">${entries.filter(x=>x[1]).map(([label,value],i)=>`<${action?'button':'span'} ${attrs(action,label)} style="flex:${value};background:${COLORS[i%COLORS.length]}" title="${esc(label)} ${value}/${total} ${unit}" ${action?`aria-label="${esc(label)} ${value} ${unit}"`:''}></${action?'button':'span'}>`).join('')}</div><div class="chart-legend">${entries.map(([label,value],i)=>`<${action?'button':'span'} class="legend-row ${label===selected?'chosen':''}" ${attrs(action,label)}><i style="background:${COLORS[i%COLORS.length]}"></i>${esc(label)}<strong>${num(value)} <small>${num(value/total*100)}%</small></strong></${action?'button':'span'}>`).join('')}</div><p class="chart-caption">분모 ${num(total)}${unit} · 범주별 관측 수, 미확인 포함</p></div>`;
}
const REGION_POS=[['서울',1,1],['인천',0,1],['경기',1,2],['강원',2,1],['충북',2,2],['충남',0,3],['세종',1,3],['대전',1,4],['경북',3,3],['대구',3,4],['전북',0,4],['전남',0,6],['광주',0,5],['경남',2,5],['울산',4,4],['부산',3,5],['제주',0,7]];
function regionTiles(records,key,unit,action='region'){
 const counts=Object.fromEntries(count(records,key)),max=Math.max(1,...Object.values(counts));
 return `<div class="region-layout"><div class="tile-map" data-chart="region" aria-label="${esc(unit)}의 시도 타일 도식, 실제 면적·위치와 다름">${REGION_POS.map(([name,x,y])=>{const n=counts[name]||0;return `<button class="map-tile ${state.region===name?'chosen':''}" ${attrs(action,name)} style="grid-column:${x+1};grid-row:${y};--level:${n/max};background:rgba(36,122,202,${.06+n/max*.72});color:${n/max>.55?'white':'#263f55'}" aria-label="${name} ${n}${unit}"><span>${name}</span><strong>${n}</strong></button>`;}).join('')}</div><div class="map-key"><strong>${state.region||'전국 분포'}</strong><span class="color-scale"></span><small>적음 ← 표본 수 → 많음</small><button data-region="">전체 지역</button><p>타일 선택 → 같은 지역의 목록<br>0 = 첨부 표본에서 관측 없음</p></div></div>`;
}
function columns(entries,{unit='회차',color=COLORS[0]}={}){
 const max=Math.max(1,...entries.map(x=>Number(x[1])));
 return `<div class="column-chart" data-chart="columns">${entries.map(([label,value])=>`<div class="column"><strong>${num(value)}</strong><div class="column-rail"><span style="height:${value/max*100}%;background:${color}"></span></div><small>${esc(label)}</small></div>`).join('')}</div><span class="chart-unit">단위 ${esc(unit)} · 세로축 0부터</span>`;
}
function heatmap(rowNames,colNames,values,{action='',rowLabel=''}={}){
 const max=Math.max(1,...values.flat());
 return `<div class="heat-wrap" data-chart="heatmap"><table class="heatmap"><thead><tr><th>${esc(rowLabel)}</th>${colNames.map(n=>`<th>${esc(n)}</th>`).join('')}</tr></thead><tbody>${rowNames.map((r,i)=>`<tr><th>${action?`<button ${attrs(action,r)}>${esc(r)}</button>`:esc(r)}</th>${values[i].map((v,j)=>`<td style="background:${v?'rgba(36,122,202,'+(.12+.7*v/max)+')':'#f1f4f7'};color:${v/max>.6?'white':'#31465b'}" title="${esc(r)} × ${esc(colNames[j])}: ${v}">${v||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pathDiagram(nodes,{kind='connection'}={}){
 return `<div class="path-diagram ${kind}" data-chart="flow">${nodes.map((n,i)=>`<div class="path-node ${n.active?'active':''}"><span class="node-step">${String(i+1).padStart(2,'0')} ${esc(n.label)}</span><strong>${esc(n.value)}</strong>${n.note?`<small>${esc(n.note)}</small>`:''}${n.page!==undefined?next(n.page,'살펴보기'):''}</div>${i<nodes.length-1?'<span class="path-arrow" aria-hidden="true">→</span>':''}`).join('')}</div>`;
}
function metric(label,value,unit,note,color=''){return `<div class="metric" ${color?`style="--metric:${color}"`:''}><span>${esc(label)}</span><strong>${num(value)}<small>${esc(unit)}</small></strong><small>${esc(note)}</small></div>`;}
function vCard(id,title,body,scope,extra={}){const base=EVIDENCE[id];return card(id,title,extra.kind||base.kind,body,{...base,...extra,scope},!!extra.wide);}
function fold(label,body){return `<details class="support"><summary>${esc(label)}</summary>${body}</details>`;}
function strip(text){return `<p class="chart-caption">${esc(text)}</p>`;}

function courseScatter(pool){
 if(!pool.length)return empty('표시할 교육 후보가 없습니다.');
 const w=600,h=240,left=48,bottom=35,maxX=Math.max(1,...pool.map(x=>Number(x.c.total_training_hours))),maxY=Math.max(1,...pool.map(x=>x.sessions.length));
 const x=v=>left+Number(v)/maxX*(w-left-20),y=v=>h-bottom-v/maxY*(h-bottom-20);
 return svgFrame([0,.5,1].map(t=>`<line x1="${left}" y1="${y(t*maxY)}" x2="${w-20}" y2="${y(t*maxY)}" class="chart-grid"/><text x="${left-8}" y="${y(t*maxY)+4}" text-anchor="end">${num(t*maxY)}</text><text x="${x(t*maxX)}" y="${h-15}" text-anchor="middle">${num(t*maxX)}</text>`).join('')+pool.map(({c,sessions})=>`<circle data-course="${c.course_id}" data-chart-action tabindex="0" role="button" aria-label="${esc(c.course_name)} · ${c.total_training_hours}시간, ${sessions.length}회차" cx="${x(c.total_training_hours)}" cy="${y(sessions.length)}" r="${state.course===c.course_id?8:5}" fill="${state.course===c.course_id?COLORS[2]:c.remote_mode==='원격'?COLORS[1]:COLORS[0]}" opacity=".7" stroke="white" stroke-width="1.5"><title>${esc(c.course_name)}\n${num(c.total_training_hours)}시간 / 선택 범위 ${sessions.length}회차</title></circle>`).join(''),w,h,'과정별 총 훈련시간과 보유 회차 수; 점을 선택하면 로드맵에 반영')+strip('가로: 총 훈련시간 · 세로: 보유 회차 수 · 파랑 현장/기타, 청록 원격 · 겹친 점은 목록에서 선택');
}
function postingFlow(posts){
 if(!posts.length)return empty('관측 공고가 없어 연결을 그리지 않습니다.');
 const leftNames=count(posts.map(p=>({relation:defenseClass(p)})),'relation').map(x=>x[0]);
 const top=count(posts,'job_major_category').slice(0,6).map(x=>x[0]),bucket=p=>top.includes(p.job_major_category)?p.job_major_category:'기타 직무';
 const rightNames=uniq(posts.map(bucket)).sort((a,b)=>posts.filter(p=>bucket(p)===b).length-posts.filter(p=>bucket(p)===a).length);
 const matrix=leftNames.map(a=>rightNames.map(b=>posts.filter(p=>defenseClass(p)===a&&bucket(p)===b).length));
 const h=390,gap=16,scale=(h-40-gap*(Math.max(leftNames.length,rightNames.length)-1))/posts.length;
 let ly=18,ry=18;
 const left=leftNames.map((name,i)=>{const n=matrix[i].reduce((a,b)=>a+b,0),node={name,n,y:ly,height:n*scale};ly+=node.height+gap;return node;});
 const right=rightNames.map((name,j)=>{const n=matrix.reduce((a,r)=>a+r[j],0),node={name,n,y:ry,height:n*scale};ry+=node.height+gap;return node;});
 const lo=left.map(()=>0),ro=right.map(()=>0);let lines='';
 matrix.forEach((row,i)=>row.forEach((value,j)=>{if(!value)return;const width=value*scale,a=left[i].y+lo[i]+width/2,b=right[j].y+ro[j]+width/2;lo[i]+=width;ro[j]+=width;lines+=`<path d="M225,${a} C345,${a} 380,${b} 485,${b}" fill="none" stroke="${COLORS[i%COLORS.length]}" stroke-width="${width}" opacity=".26"><title>${esc(left[i].name)} → ${esc(right[j].name)}: ${value}개 공고</title></path>`;}));
 const nodes=left.map((n,i)=>`<rect x="214" y="${n.y}" width="11" height="${n.height}" fill="${COLORS[i%COLORS.length]}"/><text x="205" y="${n.y+n.height/2+4}" text-anchor="end">${esc(n.name)} · ${n.n}</text>`).join('')+right.map(n=>`<rect x="485" y="${n.y}" width="11" height="${n.height}" fill="#7b9caf"/><text x="506" y="${n.y+n.height/2+4}">${esc(n.name)} · ${n.n}</text>`).join('');
 return `<div data-chart="sankey" data-flow-total="${posts.length}">${svgFrame(lines+nodes,715,h,'기업 방산 근거 집단에서 직무 분류로 이어지는 수집 공고 수')}${chartTable(['기업 근거','직무 분류','공고 수'],matrix.flatMap((row,i)=>row.flatMap((n,j)=>n?[[leftNames[i],rightNames[j],n]]:[])))}</div>`;
}

function industry(){
 const i=rows('I'),last=i.at(-1),tech=rows('DT').find(x=>x.technology_id===state.tech),tm=rows('TM').find(x=>x.technology_id===state.tech);
 const research=rows('R').filter(r=>(state.researchScope==='all'||r.ranking_inclusion_flag==='1')&&(!state.field||r[FIELD_FLAGS[state.field]]==='1'));
 const fieldCounts=Object.keys(FIELD_FLAGS).map(f=>[f,rows('R').filter(r=>r.ranking_inclusion_flag==='1'&&r[FIELD_FLAGS[f]]==='1').length]);
 const techNames=[['AI·자율비행','ai_autonomous_flight_flag'],['항법·비행제어','flight_control_navigation_flag'],['통신·C2','communications_c2_flag'],['플랫폼·기체','platform_airframe_flag'],['군집·유무인','swarm_manned_unmanned_teaming_flag'],['안티드론','counter_uas_flag']];
 const agencies=uniq(rows('D').map(r=>r.contract_agency)).map(a=>[a,uniq(rows('D').filter(r=>r.contract_agency===a).map(r=>r.contract_no)).length]).sort((a,b)=>b[1]-a[1]);
 return heading('산업의 변화에서, 나의 직무로','활용 분야와 기술을 눌러 다음 탐색 범위를 정하세요.')+
 vCard('industry-size','산업 규모 · 2021–2024',`<div class="metric-grid">${metric('조사상 사업체',last.company_total,'개','2024년 산업 전체')}${metric('세부표 기준 매출',last.revenue_total_100m_krw,'억원','2024년 · 요약문 불일치 주의')}${metric('산업 종사자',last.employees_total,'명','채용 인원과 다름')}</div><div class="trend-grid">${[['company_total','업체 수','개'],['revenue_total_100m_krw','매출','억원'],['employees_total','종사자','명']].map(([key,label,unit],idx)=>`<div><h4>${label}</h4>${lineChart(i,key,unit,COLORS[idx])}</div>`).join('')}</div>${strip('연도별 조사 표본·정의 차이 주의. 그래프 변화만으로 경기나 취업난의 원인을 판단하지 않습니다.')}${fold('연도별 조사 주석',table(['연도','표본','원문 주석'],i.map(r=>[r.reference_year,num(r.valid_sample_total),esc(r.quality_note)])))}`,'산업 전체 참고 · 개인 필터 미적용',{wide:true})+
 `<div class="dashboard-grid">`+
 vCard('applications','관심 활용 분야',hBars(fieldCounts,{unit:'과제',action:'field',selected:state.field})+strip('기존 고신뢰 연구 2,936개 안의 다중 활용 태그 · 클릭하여 분야 선택')+fold('실제 공공 활용 사례',table(['활용 업무','보유 기관 자료 시점'],uniq(rows('U').map(r=>r.purpose_raw)).slice(0,6).map(t=>[esc(t),'2022-07-31'])))+`<div class="next">${next(1,'분야 속 직무 보기')}</div>`,'고신뢰 연구 태그별 고유 project_id · 분야 간 중복 있음',{sources:['R','U','T'],rule:'기존 고신뢰 과제의 원본 활용 flag별 고유 과제 수. 분야들은 다중 태그라 합산하지 않음. 클릭은 분야 탐색 범위만 선택.',limit:'시장 매출·채용 수요 순위가 아님. 측량은 건설·인프라, 영상은 교육·콘텐츠 태그를 넓은 후보로 사용.'})+
 vCard('research','이 분야에서 다루는 기술',`<div class="chart-toolbar"><select aria-label="연구 범위" data-state="researchScope"><option value="high" ${state.researchScope==='high'?'selected':''}>고신뢰 분류</option><option value="all" ${state.researchScope==='all'?'selected':''}>전체 연구 포함</option></select><span>${num(research.length)}개 과제</span></div>`+hBars(techNames.map(([label,key])=>[label,research.filter(r=>r[key]==='1').length]),{unit:'과제',color:COLORS[1]})+strip('과제는 여러 기술에 중복 포함됩니다. 기술의 채용 빈도가 아닙니다.')+fold('연구 문제와 원문 사례',research.filter(r=>/드론|무인|UAV/i.test(r.project_title)).slice(0,5).map(r=>`<article class="item"><strong>${esc(r.project_title)}</strong><p>${esc(r.lead_institution)} · ${r.representative_start_year}</p><p>${esc(r.research_objective_summary)}</p></article>`).join('')),'선택 활용 분야 적용 · 직무·지역 미적용',{rule:'선택 연구 범위에서 원본 기술 flag별 고유 project_id를 집계. 다중 태그. 사례는 제목에 드론·무인·UAV가 명시된 원본 순서 앞 5개.'})+
 vCard('defense-tech','국방 기술 → 직무 → 기초 학습',`<label class="sr-only" for="techChoice">국방 응용 기술</label><select id="techChoice" data-state="tech">${rows('DT').map(t=>`<option value="${t.technology_id}" ${state.tech===t.technology_id?'selected':''}>${esc(t.technology_category)}</option>`).join('')}</select>`+pathDiagram([{label:'국방 응용',value:tech.defense_use_case},{label:'연결 직무',value:tm.example_roles},{label:'기초 학습',value:tm.learning_topics}],{kind:'defense-path'})+`<div class="chips">${chips(tm.job_keywords.split(', '))}</div><button class="primary" data-tech-roles="${tech.technology_id}">이 기술을 쓰는 직무 탐색 →</button>`,'12개 기술의 분석용 매핑 · 현재 채용 요구와 구분',{wide:true})+
 vCard('defense-contracts','국방 계약은 어떤 기관의 업무로 나타날까?',hBars(agencies.slice(0,7),{unit:'계약',color:COLORS[2]})+strip('기관별 고유 계약번호 · 계약 금액을 합산하거나 일자리 수로 환산하지 않음')+fold('납품·정비·용역 사례',table(['계약명','기관','일자'],rows('D').slice(0,6).map(r=>[esc(r.contract_title),esc(r.contract_agency),r.contract_date]))),`${rows('D').length}행 / ${uniq(rows('D').map(r=>r.contract_no)).length}개 계약번호 · 상위 7기관`,{rule:'contract_agency별 고유 contract_no 개수. 수정·변경의 금액을 합산하지 않음. 전체 계약은 원문 탐색.'})+
 `</div>`;
}
