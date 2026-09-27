'use strict';
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(v).toLocaleString('ko-KR', {maximumFractionDigits:2});
const uniq = a => [...new Set(a)];
const count = (a,k) => Object.entries(a.reduce((o,r)=>(o[r[k] || '미확인']=(o[r[k] || '미확인']||0)+1,o),{})).sort((a,b)=>b[1]-a[1]);
const SOURCES = {I:'Industry_Size_Annual_Trends',U:'Public_Agency_Drone_Use_Cases',R:'NTIS_National_RnD_Project_Master',D:'DAPA_Drone_Contracts',DT:'Defense_Drone_Tech_Standard',TM:'Technology_Job_Mapping',T:'Drone_Job_Classification',TS:'Required_Skills_By_Job_Long',TE:'Actual_Job_Posting_Evidence',J:'Job_Posting_Analysis_Data',K:'Job_Posting_Keyword_Frequency',E:'Training_Course_Master',ES:'Training_Session_Analysis',Q:'Annual_Certification_Issuance',C:'Company_Organization_Master',CB:'Company_Business_Area_Links_Verified',CD:'Company_Defense_Evidence_Verified'};
const PAGES = ['산업 이해','직무 탐색','준비 역량','수집 채용 공고','준비 로드맵','제작자 검토'];
const FIELD_RULES = {'국방·방산':/국방|방산|군용|군집|정찰|감시|안티드론|전자전|항재밍|요격/,'농업·방제':/농업|방제|산림/,'측량·공간정보':/측량|GIS|공간정보|맵핑|매핑/,'점검·재난':/점검|재난|안전|구조|소방/,'영상·콘텐츠':/촬영|영상|콘텐츠/,'물류·운송':/물류|배송|운송/};
const FIELD_FLAGS = {'국방·방산':'defense_flag','농업·방제':'agriculture_forestry_flag','측량·공간정보':'construction_infrastructure_flag','점검·재난':'disaster_safety_fire_flag','영상·콘텐츠':'education_content_flag','물류·운송':'logistics_transport_flag'};
let DATA, AUDIT, CATALOG, modules = {}, state = {page:0,role:'',major:'',field:'',region:'',activity:[],roleQuery:'',career:'',group:'',defense:'',skills:[],education:'',experience:'',years:'',course:'',posting:'',project:false,checks:{},reviews:{},rawName:SOURCES.T,rawQuery:'',rawPage:0,tech:'DT01',researchScope:'high'};
const rows = code => DATA[SOURCES[code] || code] || [];
const role = () => rows('T').find(r=>r.job_id===state.role);
const skillsFor = id => uniq(rows('TS').filter(r=>r.job_id===id).map(r=>r.skill_keyword));
function link(url,label='원문 확인') {return /^https?:\/\//i.test(url || '') ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : '<span class="muted">원문 URL 미수집</span>';}
function rawButton(code,label) {const name=SOURCES[code]||code;return `<button data-raw="${esc(name)}">${esc(label||name+'.csv')}</button>`;}
function badge(kind) {return `<span class="badge ${{'직접':'direct','부분':'partial','파생':'derived','없음':'missing'}[kind]}">${kind==='없음'?'추가 수집 필요':kind}</span>`;}
function bars(entries,unit='건') {const max=Math.max(1,...entries.map(x=>Number(x[1])));return `<div class="bars">${entries.map(([label,value])=>`<div class="bar-row"><span>${esc(label)}</span><span class="track"><span class="fill" style="display:block;width:${Number(value)/max*100}%"></span></span><span class="number">${num(value)} ${esc(unit)}</span></div>`).join('')}</div>`;}
function table(headers,body) {return `<div class="table-wrap"><table><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${body.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function chips(values) {return `<div class="chips">${values.map(v=>`<span class="chip">${esc(v)}</span>`).join('')}</div>`;}
function empty(title,body='현재 자료에서 확인할 수 없습니다.') {return `<div class="empty"><strong>${esc(title)}</strong>${esc(body)}</div>`;}
function next(page,label) {return `<button data-page="${page}">${esc(label||PAGES[page]+'으로 이어가기')} →</button>`;}
function evidence(id,m) {const review=state.reviews[id]||{};return `<details class="evidence"><summary>더보기 · 사용 데이터 / 연결 흐름 / 목적 / 기대효과 / 검토</summary><dl><dt>설계 근거</dt><dd>${esc(m.design||'설계서 4장 화면 구성 · 기획서 5~7절')}</dd><dt>사용 데이터</dt><dd><div class="chips">${(m.sources||[]).map(s=>rawButton(s)).join('')||'신규 데이터셋 필요 · 관측 결과 미수집'}</div></dd><dt>연결 흐름</dt><dd>${esc(m.flow)}</dd><dt>활용 목적</dt><dd>${esc(m.purpose)}</dd><dt>기대효과</dt><dd>${esc(m.effect)}</dd><dt>계산·연결 규칙</dt><dd>${esc(m.rule)}</dd><dt>해석 한계</dt><dd>${esc(m.limit)}</dd>${m.need?`<dt>수집 권장</dt><dd>${esc(m.need)}</dd>`:''}</dl><div class="review-inputs"><label>콘텐츠 판단<select data-review="${id}" data-review-field="decision">${['미검토','유지','수정','제외'].map(x=>`<option ${review.decision===x?'selected':''}>${x}</option>`).join('')}</select></label><label>제작자 메모<textarea data-review="${id}" data-review-field="note" placeholder="관련성, 연결 개선점, 추가 수집 의견">${esc(review.note||'')}</textarea></label></div><p class="muted">검토는 이 세션에 유지됩니다. 팀원에게 전달하려면 상단의 HTML 저장을 사용하세요.</p></details>`;}
function card(id,title,kind,body,m,wide=false) {
 if(id==='research')m={...m,rule:m.rule+' 예시는 제목에 드론·무인·UAV가 명시된 과제 우선 정렬. 성과·중요도 순위가 아님.'};
 modules[id]={...m,title,kind};
 const detail=evidence(id,m);
 return `<section class="card ${wide?'wide':''}" data-module="${id}"><div class="card-top"><h3>${esc(title)}</h3>${badge(kind)}</div>${body}<div class="meta">${esc(m.scope||'첨부 자료 기준 · 원문 최신 상태 재검증 없음')}</div>${kind==='직접'&&!(m.sources||[]).length?detail.replace('신규 데이터셋 필요 · 관측 결과 미수집','사용자가 직접 입력한 콘텐츠 판단·검토 메모'):detail}</section>`;
}
function heading(title,description){return `<div class="page-title"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div><span class="badge">기준일 ${AUDIT.as_of}</span></div>`;}
const MISSING = {
 live:{title:'현재 지원 가능한 공고',design:'설계서 N03 · 실제 지원 행동으로 연결',fields:'posting_id, 게시일, 마감일, 모집 상태, 원문 URL, 최종 확인 시각',flow:'선택 직무 → 수집 공고(posting_id) → 최신 모집 상태 → 지원 여부 확인',purpose:'과거 공고 탐색을 실제 지원 행동으로 이어가기',effect:'마감된 공고에 대한 반복 확인을 줄이고 지금 확인할 대상을 좁힘',method:'기존 공고에 상태 스냅샷을 연결하고 확인 시각·마감일 기준으로 목록을 표시',collection:'공고 원문·기업 채용 페이지에서 상태와 시각을 함께 수집. 삭제·접근불가도 별도 상태로 보존',priority:'우선 1'},
 keywords:{title:'선택 직무의 실제 요구 기술 빈도',design:'설계서 N01/N02 · 역량과 채용의 연결',fields:'posting_id, 표준 기술명, 원문 표현, 필수/우대, 요구/업무 구분, 근거 문장, 수집일',flow:'직무 사전 → 직무–공고 매핑 → 공고별 기술 → 보유 역량·교육 비교',purpose:'사전 기준 역량과 실제 공고 요구를 분리해 비교',effect:'기술 학습 우선순위를 관측된 요구로 검토할 수 있음',method:'공고별 중복을 제거한 기술 언급을 직무별 유효 공고 수와 함께 집계',collection:'기존 키워드 추출 관계표 복구 우선. 없으면 상세 공고 원문에서 확인. 전체 빈도표 K로 역산 금지',priority:'우선 1'},
 curriculum:{title:'이 과정에서 부족한 기술을 실제로 배우는가?',design:'설계서 N06/N07 · 교육과 학습 차이의 연결',fields:'course_id, 모듈명, 표준 기술, 실습 내용, 선수지식, 수준, 산출물, 비용 정의, 출처·확인일',flow:'부족 역량(TS) → 교육 모듈(course_id) → 미포함 기술 → 보완 프로젝트',purpose:'과정명에 기반한 후보를 실제 커리큘럼으로 검증',effect:'이름만 비슷한 과정 선택을 줄이고 보완 학습을 구체화',method:'기술별 확인/미포함/미확인 표를 만들고 실제 확인한 모듈 문장을 제시',collection:'개발·AI 등 소수 후보 과정부터 교육기관 공개 커리큘럼·비용 설명 수집',priority:'우선 1'},
 interview:{title:'이 직무의 하루 업무와 협업은?',design:'설계서 N11 · 직무 선택의 질적 근거',fields:'job_id, 인터뷰 일자, 업종, 업무, 협업 상대, 어려움, 시간 배분, 출처·공개 동의',flow:'관심 직무 → 현직자 사례 → 필요한 업무 습관 → 학습·프로젝트',purpose:'직무 설명만으로 보기 어려운 일의 맥락 이해',effect:'관심과 실제 활동의 차이를 비교해 직무 선택을 도움',method:'인터뷰 사례 카드를 해당 직무에 연결. 관측값이 생기기 전 시간 배분 차트는 비워 둠',collection:'공개 현직자 인터뷰 또는 동의 기반 인터뷰. 한 사례를 전체 직무 평균으로 일반화하지 않음',priority:'후속 2'},
 defense:{title:'방산 업무에서 추가로 확인할 지원 조건',design:'설계서 N02/N09 · 기업 성격과 공고 조건 분리',fields:'posting_id, 프로젝트 성격, 조건 종류, 필수/우대, 국적·보안·군 경력 원문, 근거 URL·확인일',flow:'방산 관련 기업 근거 → 개별 공고의 확인 조건 → 개인 준비 항목',purpose:'기업의 방산 관계를 개인의 지원 자격으로 오해하지 않고 실제 조건 확인',effect:'확인할 조건을 명확히 하여 근거 없는 진로 배제를 방지',method:'공고에 명시된 특수 조건만 3상태 비교에 추가. 기업 분류에서 조건을 추론하지 않음',collection:'해당 공고 원문에서 직접 확인. 병역 문구 일부를 국적·보안심사·군 경력 우대로 확대하지 않음',priority:'후속 2'},
 outcomes:{title:'교육·자격 이후 관련 직무 취업 현황',design:'설계서 N13/N15 · 준비 경로의 실제 성과 검토',fields:'course_id/자격명, 코호트, 수료·취득 수, 관련 직무 취업 수, 관측 기간, 분모 정의, 추적 방법',flow:'교육·자격 선택 → 동일 코호트의 관련 취업 현황 → 준비 경로 재검토',purpose:'과정 선택 후 관측된 진로 결과를 확인',effect:'학습 경로의 적합성을 검토할 추가 근거 확보',method:'분모와 기간이 같은 관측치만 비교. 개인 합격확률이나 교육의 인과효과로 표시하지 않음',collection:'공개 성과자료 또는 비식별 추적조사. 서로 다른 조사 코호트를 억지 결합하지 않음',priority:'후속 3'},
 mobility:{title:'드론에서 인접 분야로의 실제 경력 이동',design:'설계서 N14 · 범용 역량과 경력 확장',fields:'이전/이후 직무·산업, 공통 기술, 추가 학습, 이동 시점, 출처·동의',flow:'보유 역량 → 공통 기술 → 실제 전환 사례 → 추가 학습',purpose:'기술 겹침과 실제 경력 이동 사례를 구분',effect:'진입·전환 준비를 사례에 근거해 구체화',method:'소수 사례부터 직무·기술에 연결. 전체 성공률·이직률 차트는 모집단 자료 확보 전 비움',collection:'공개 경력 인터뷰 또는 동의 기반 사례 수집',priority:'후속 3'}
};
function missingCard(key){
 const m=MISSING[key];
 return card('missing-'+key,m.title,'없음',`<div class="empty missing-preview"><b>—</b><span>결과 비워 둠 · 데이터 미수집</span></div><p class="chart-caption"><strong>수집 후 연결</strong> ${esc(m.flow)}</p><p class="chart-caption"><strong>목적</strong> ${esc(m.purpose)}<br><strong>기대효과</strong> ${esc(m.effect)}</p>${fold('필요 데이터 항목과 활용 방식',`<p>${esc(m.fields)}</p><p>${esc(m.method)}</p>`)}`,{design:m.design,sources:[],flow:m.flow,purpose:m.purpose,effect:m.effect,rule:m.method,limit:'현재 결과값·순위·가상 그래프를 생성하지 않음.',need:m.fields+' / '+m.collection,scope:m.priority+' · 추후 데이터 수집 권장 · 관측 0건이 아닌 미수집 상태'});
}

function render(){
 $('#nav').innerHTML=PAGES.map((p,i)=>`<button data-page="${i}" class="${state.page===i?'active':''}" aria-current="${state.page===i?'step':'false'}">${i<5?'0'+(i+1)+' · ':''}${p}</button>`).join('');
 $('#role').value=state.role;$('#field').value=state.field;$('#region').value=state.region;
 $('#scope').textContent=`관심 직무: ${role()?.job_title_ko||'선택 전'} · 분야: ${state.field||'전체'} · 근무지역: ${state.region||'전체'} | 산업 통계·전체 키워드의 범위는 필터에 따라 바뀌지 않습니다.`;
 $('#main').innerHTML=[industry,rolesPage,preparation,postingsPage,roadmap,reviewPage][state.page]();
}
const ROLE_RULES = [
 {id:'AI',pattern:/인공지능|컴퓨터비전|영상처리|객체|딥러닝|머신러닝|AI |AI·/,groups:['AI/컴퓨터비전'],terms:['AI','인공지능','영상관제','파이썬'],tech:['DT01','DT12'],project:'공개 영상의 인식 결과와 오탐·누락 사례, 처리시간을 정리한 실험 보고서'},
 {id:'NAV',pattern:/자율비행|비행제어|항법|경로|군집|시뮬레이터|SITL|GNC|SLAM|GNSS|위치추정/,groups:['비행제어/자율비행'],terms:['자율비행','제어','픽스호크','아두파일럿'],tech:['DT02','DT03'],project:'모의환경에서 경로 수행·실패 조건을 재현하고 결과를 비교한 시험 보고서'},
 {id:'EMB',pattern:/임베디드|펌웨어|실시간|비행컴퓨터/,groups:['임베디드/펌웨어'],terms:['임베디드','아두이노','제어'],tech:['DT04'],project:'모의 센서 입력을 처리하는 작은 프로그램과 지연·오류 처리 시험 기록'},
 {id:'GIS',pattern:/GIS|측량|공간정보|지도|맵핑|매핑|지리정보/,groups:['GIS/측량/공간정보'],terms:['측량','공간정보','맵핑','매핑'],tech:[],project:'공개 공간자료를 이용한 지도 결과물과 좌표·품질 한계를 설명하는 보고서'},
 {id:'RF',pattern:/통신|데이터링크|RF |안테나|전자전|레이더|안티드론/,groups:['HW/전자'],terms:['통신','전자','신호'],tech:['DT06','DT10'],project:'공개·합성 데이터의 신호 품질을 비교하고 측정 조건과 한계를 정리한 보고서'},
 {id:'HW',pattern:/항전|센서|회로|전자|전력|배터리|전원|추진|모터/,groups:['HW/전자'],terms:['전자','아두이노','제어'],tech:['DT04','DT05','DT08'],project:'센서 또는 전원 구성의 요구조건·인터페이스와 검증 방법을 정리한 설계 설명서'},
 {id:'MECH',pattern:/기체|구조|공력|복합재|기구|기계|설계|CAD/,groups:['기구/기계설계'],terms:['설계','제작','솔리드웍스','카티아','3D'],tech:['DT09'],project:'부품 설계와 조립·유지보수 고려사항을 정리한 도면 및 설계 설명서'},
 {id:'SW',pattern:/소프트웨어|SW |플랫폼|관제|데이터|클라우드|개발자|시스템통합/,groups:['SW개발'],terms:['SW','소프트웨어','개발','관제','코딩','파이썬'],tech:['DT07','DT12'],project:'모의 비행 상태·이벤트를 표시하는 관제 화면과 동작 검증 기록'},
 {id:'FILM',pattern:/촬영|콘텐츠|영상|방송|편집/,groups:['영상/촬영'],terms:['촬영','영상','콘텐츠','편집'],tech:[],project:'촬영 계획과 공개·직접 제작 영상의 편집 결과를 연결한 작업 설명서'},
 {id:'REPAIR',pattern:/정비|수리|유지보수/,groups:['정비'],terms:['정비','수리','제어'],tech:['DT09'],project:'모의 고장 시나리오의 점검 순서·판단 근거·후속 조치를 기록한 정비 보고서'},
 {id:'MFG',pattern:/생산|제조|제작|조립|품질/,groups:['생산/제조'],terms:['제작','설계','정비'],tech:['DT09'],project:'제작 공정의 점검표와 불량 원인·개선 검증을 정리한 품질 보고서'},
 {id:'OPS',pattern:/조종|운용|운항|방제|점검|재난|배송|물류|안전|시험/,groups:['드론조종/운영'],terms:['조종','운용','활용','방제','안전'],tech:['DT07'],project:'모의 임무 계획·안전 점검·관측 결과·후속 조치를 정리한 운용 보고서'},
 {id:'SALES',pattern:/영업|마케팅|고객|판매/,groups:['영업/사업개발'],terms:['사업','컨설팅'],tech:[],project:'한 활용 사례의 사용자 요구와 솔루션 적용 범위·한계를 정리한 제안서'},
 {id:'PM',pattern:/기획|사업|체계종합|요구도|프로젝트|PM/,groups:['PM/기획','영업/사업개발'],terms:['컨설팅','사업'],tech:['DT07'],project:'공개 활용 사례를 바탕으로 요구사항과 검증 기준을 추적하는 문서'},
 {id:'RD',pattern:/연구|정책|교육/,groups:['연구개발'],terms:['기초','이론'],tech:[],project:'관심 업무의 공개 사례를 조사하고 질문·방법·한계를 설명한 탐구 보고서'}
];
function roleMap(r){if(!r)return null;const found=ROLE_RULES.find(m=>m.pattern.test(r.job_title_ko))||ROLE_RULES.find(m=>m.pattern.test(r.major_category));return found?{...found,evidence:r.job_title_ko+' / '+r.major_category}:null;}
function roleActivities(r){const t=r.job_title_ko+' '+r.core_duties+' '+r.skills_raw;return Object.entries({'코딩':/SW|소프트웨어|개발|프로그래밍|Python|C\+\+/i,'AI·데이터':/AI|인공지능|데이터|영상처리|학습|비전/i,'기계·전자':/설계|기계|전자|회로|구조|제조|전원/,'현장':/운용|조종|정비|점검|현장|방제/,'영상·콘텐츠':/촬영|콘텐츠|영상편집|방송/,'연구':/연구|시험|분석|실험/}).filter(([,re])=>re.test(t)).map(([k])=>k);}
function matchingRoles(){let result=rows('T').filter(r=>(!state.major||r.major_category===state.major)&&(!state.activity.length||roleActivities(r).some(a=>state.activity.includes(a)))&&(!state.field||FIELD_RULES[state.field].test(r.job_title_ko+' '+r.core_duties+' '+r.skills_raw))&&(!state.roleQuery||(r.job_title_ko+' '+r.core_duties+' '+r.skills_raw).toLowerCase().includes(state.roleQuery.toLowerCase())));if(state.techFocus){const m=rows('TM').find(x=>x.technology_id===state.techFocus);const words=m.job_keywords.split(', ').concat(m.learning_topics.split(', '));result=result.filter(r=>words.some(w=>(r.job_title_ko+' '+r.core_duties+' '+r.skills_raw).toLowerCase().includes(w.toLowerCase())));}return result;}
function selectedRoleIntro(){return role()?`<div class="note">선택 직무 · <strong>${esc(role().job_title_ko)}</strong><br>${esc(role().core_duties)}</div>`:empty('먼저 관심 직무를 선택해 주세요','상단 관심 직무 선택 또는 직무 탐색 화면에서 선택할 수 있습니다.')+next(1,'직무 탐색');}
function courseCandidates(ignoreRegion=false){const m=roleMap(role());if(!m)return [];return rows('E').map(c=>{const text=(c.course_name+' '+c.ncs_name+' '+c.related_certificate_raw).toLowerCase();const matches=m.terms.filter(t=>text.includes(t.toLowerCase()));const sessions=rows('ES').filter(s=>s.course_id===c.course_id&&(ignoreRegion||!state.region||s.province_name===state.region||s.remote_mode==='원격'));return {c,matches,sessions};}).filter(x=>x.matches.length&&x.sessions.length);}
function schedule(s){return s.end_date<AUDIT.as_of?'종료':s.start_date>AUDIT.as_of?'시작 예정':'진행';}
function companyFor(p){return rows('C').find(c=>c.company_name_normalized===p.employer_name);}
function defenseClass(p){return companyFor(p)?.defense_drone_relation_class||'기업정보 미연결';}
function filteredPostings(ignoreRegion=false){const m=roleMap(role());return rows('J').filter(p=>(state.group?p.job_major_category===state.group:!m||m.groups.includes(p.job_major_category))&&(ignoreRegion||!state.region||p.province_name===state.region)&&(!state.career||p.career_type===state.career)&&(!state.defense||defenseClass(p)===state.defense));}
function salaryText(p){const a=AUDIT.salary[p.posting_id];return a?`${a.min===null?'범위 미확인':num(a.min)+(a.max?'~'+num(a.max):' (상한 미확인)')+'만원'} · ${a.rule}`:'연봉 환산하지 않음';}
function postingItem(p){return `<article class="item ${state.posting===p.posting_id?'selected':''}"><span class="muted">${esc(p.employer_name)} · ${esc(p.job_major_category)} · ${esc(defenseClass(p))}</span><div class="item-title">${esc(p.title)}</div><p>${esc(p.province_name+' '+p.district_name)} · ${esc(p.career_type)} · ${esc(p.education_normalized)} · ${esc(p.employment_types)}</p><p class="small">현재 모집 상태 미확인 · 데이터 신뢰도 ${esc(p.data_confidence)}</p><div class="row">${link(p.primary_source_url)}<button data-posting="${p.posting_id}">${state.posting===p.posting_id?'로드맵에 선택됨':'조건 비교 대상으로 선택'}</button></div><details><summary>더보기 · 이 공고의 원문 조건과 누락</summary>${table(['항목','확인한 원문'],[['업무',esc(p.responsibilities||'미수집 · 업무 없음이 아님')],['경력',esc(p.career_requirement_raw||'미수집')],['학력',esc(p.education_raw||'미수집')],['전공',esc(p.major_requirement_raw||'미수집 · 전공 제한 없음이 아님')],['급여 원문',esc(p.salary_raw||'미수집')],['연봉 파생값',esc(salaryText(p))],['검증 주석',esc(p.verification_note)]])}<p class="muted">${p.posting_id} · 정확한 기업명 일치만 기업에 연결 · 나머지 조건은 원문 확인</p></details></article>`;}
function companyItem(c){const areas=rows('CB').filter(r=>r.company_id===c.company_id),ev=rows('CD').filter(r=>r.company_id===c.company_id);return `<article class="item"><div class="item-title">${esc(c.company_name_normalized)}</div><p>${esc(c.defense_drone_relation_class)} · ${esc(c.classification_basis)}</p>${chips(uniq(areas.map(r=>r.business_category)))}<p class="muted">공식 방산업체 지정: 미검증 · N을 '지정업체 아님'으로 해석하지 않음</p><details><summary>더보기 · 방산 근거 ${ev.length}행 / 종류·강도·시점</summary>${ev.length?table(['종류·강도','근거·기준일','주의점'],ev.map(r=>{const raw=JSON.parse(r.record_json);return [esc(r.evidence_type)+'<br>'+esc(r.evidence_strength),esc(raw.evidence_detail)+'<br>'+esc(raw.as_of_date)+'<br>'+esc(raw.source_file),esc(r.caveat)];})):empty('보유 자료에서 근거 미확인','민간 기업으로 확정하지 않습니다.')}<p class="muted">${c.company_id} · C–CB–CD는 company_id 직접 연결. 같은 계열 원본과 검증본을 합산하지 않음.</p></details></article>`;}
function conditionCompare(p){
 const educationLevels={'고졸':1,'초대졸':2,'대졸':3,'석사':4,'박사':5};
 let edu='미확인',exp='미확인',area=state.region?(p.province_name?state.region===p.province_name?'확인된 조건과 일치':'불일치':'미확인'):'미확인';
 if(p.education_normalized==='학력무관')edu='확인된 조건과 일치';
 else if(state.education&&educationLevels[p.education_normalized]&&educationLevels[state.education])edu=educationLevels[state.education]>=educationLevels[p.education_normalized]?'확인된 조건과 일치':'불일치';
 if(p.career_type==='무관')exp='확인된 조건과 일치';
 else if(state.experience==='신입')exp=['신입','신입·경력'].includes(p.career_type)?'확인된 조건과 일치':p.career_type==='경력'?'불일치':'미확인';
 else if(state.experience==='경력'){
  if(p.career_type==='신입')exp='불일치';
  if(['경력','신입·경력'].includes(p.career_type)){
   const hasMin=p.career_min_years!=='',hasMax=p.career_max_years!=='';
   if((hasMin||hasMax)&&state.years!=='')exp=(hasMin&&Number(state.years)<Number(p.career_min_years))||(hasMax&&Number(state.years)>Number(p.career_max_years))?'불일치':'확인된 조건과 일치';
   else if(!hasMin&&!hasMax)exp=p.career_type==='신입·경력'?'확인된 조건과 일치':'미확인';
  }
 }
 return [['학력',p.education_raw||p.education_normalized,edu],['경력',p.career_requirement_raw||p.career_type,exp],['근무지역',p.province_name,area],['전공·기술·기타 필수조건',p.major_requirement_raw||'전체 필수조건 미수집','미확인'],['현재 모집 여부','게시일·마감일·모집 상태 미수집','미확인']];
}
function reviewPage(){
 const selected=CATALOG.filter(x=>x.selected),decisions=Object.entries(state.reviews).filter(([,r])=>r.decision&&r.decision!=='미검토'||r.note);
 return heading('제작자 검토 · 필요한 연결을 남기고 선별하기','핵심 흐름에 채택한 데이터와 보류 자료를 구분하고, 빈 영역의 수집 우선순위를 검토합니다.')+`<div class="grid">`+
 card('data-selection','왜 이 데이터를 선택했는가?','직접',`<div class="stats"><div class="stat"><strong>${selected.length}</strong><span>화면에 채택한 원본</span></div><div class="stat"><strong>${CATALOG.length-selected.length}</strong><span>보류·중복·보조 원본</span></div></div><p>산업 맥락을 이해하고 직무·준비·관측 조건을 연결하는 데 필요한 데이터만 채택했습니다. 보류 파일을 활용하기 위한 차트는 만들지 않습니다.</p>${table(['채택 데이터','행 수','선택 목적','원문'],selected.map(x=>[esc(x.name),num(x.rows),esc(x.purpose),rawButton(x.name,'원문 탐색')]))}<details><summary>더보기 · 사용하지 않은 ${CATALOG.length-selected.length}개 원본</summary>${table(['파일','행 수','이번에 보류한 이유'],CATALOG.filter(x=>!x.selected).map(x=>[esc(x.name+'.csv'),num(x.rows),esc(omissionReason(x.name))]))}</details>`,{sources:['T','J','E','C'],flow:'기획 목적 → 데이터 채택 판단 → 핵심 화면 → 필요 시 확장',purpose:'모든 데이터 소진보다 진로 탐색에 필요한 자료 선별',effect:'불필요한 통계가 핵심 흐름을 가리지 않도록 검토',rule:'17개 원본은 독립 HTML에 내장. 37개 원본은 행 수·컬럼·해시·보류 이유만 기록. 전체 원본은 프로젝트 data/raw에 보존',limit:'보류는 데이터가 가치 없다는 판정이 아님. 후속 기획 목적에 맞으면 다시 검토',scope:'첨부 CSV 54개 파싱 · 시각화는 채택 데이터만'},true)+
 card('quality','데이터 연결·품질 점검','부분',table(['점검','실제 결과','처리'],[['공고 ↔ 기업 정확 일치',`${AUDIT.counts.linked_postings}/135개`,'미연결 83개 유지'],['교육 비용 불일치',`${AUDIT.cost_issue_ids.length}/148개`,'원본 필드 병렬 표시, 지원액 차감 금지'],['교육 일정 기준일',esc(JSON.stringify(AUDIT.schedule_status)),'모집 여부와 구분'],['연봉 원문',`${Object.keys(AUDIT.salary).length}개`,'연봉 명시만 재추출; 원본 보존'],['공고 키워드 관계','posting_id별 관계표 미수집','직무별 빈도 차트 빈칸'],['국방 계약','416행 / 367계약번호','계약액 합산하지 않음'],['R&D','고신뢰 2,936 / 전체 8,078','고유 과제 단위 유지'],['방산 지정','확인 원장 없음','N = 미검증, 미분류 ≠ 민간']])+`<details><summary>더보기 · 공고–기업 연결 원장</summary>${table(['공고 ID','원본 기업명','연결 ID','방법'],AUDIT.company_links.map(x=>[x.posting_id,esc(x.source_name),x.company_id||'미연결',esc(x.basis)]))}</details>`,{sources:['J','C','E','ES','K','D','R'],flow:'원본 → 단위·키·정의 점검 → 파생 연결 → 사용자 해석',purpose:'잘못된 합산·조인·결측 해석 예방',effect:'제작자가 숫자와 연결의 근거를 직접 확인',rule:'build.py로 원본을 별도 읽어 건수·고유키·산술관계 계산. 원본 CSV는 변경하지 않음',limit:'파일 내부 검증이며 외부 원문 최신성 재검증이 아님',scope:'기준일 '+AUDIT.as_of})+
 card('new-data-plan','빈 영역에 어떤 데이터가 추가되면 좋을까?','없음',table(['필요 데이터셋','우선순위','기존 데이터와 연결','기대효과'],Object.values(MISSING).map(m=>[esc(m.title)+'<br><span class="muted">'+esc(m.fields)+'</span>',m.priority,esc(m.flow),esc(m.effect)])),{sources:[],flow:'흐름에서 끊긴 질문 → 필요한 데이터셋 → 기존 ID 연결 → 새로운 판단',purpose:'추가 수집의 목적을 결과 화면과 함께 검토',effect:'데이터 수집 자체보다 사용자 흐름 개선에 우선순위 부여',rule:'현재 결과값은 모두 빈칸. 우선 1은 키워드 관계·커리큘럼·현재 모집 상태. 같은 빈 영역은 해당 단계에도 배치',limit:'추가 수집은 제안이며 현재 구현에 실측값이 존재하지 않음',need:'각 영역의 더보기에서 필드, 수집 경로, 한계 확인',scope:'신규 데이터셋 7개 제안 · 가상 수치 없음'})+
 card('review-decisions','콘텐츠별 검토 판단과 메모','직접',`<p>각 영역의 더보기에서 유지·수정·제외를 선택하고 이유를 적을 수 있습니다. ‘제외’는 검토 의견으로 남으며 화면을 즉시 삭제하지 않습니다.</p>${decisions.length?table(['영역','판단','메모'],decisions.map(([id,r])=>[esc(modules[id]?.title||id),esc(r.decision||'미검토'),esc(r.note||'')])):empty('아직 작성한 검토 메모가 없습니다.','각 데이터 활용 영역의 더보기를 펼쳐 검토해 주세요.')}<button id="saveReviews">검토 의견 JSON 저장</button>`,{sources:[],flow:'데이터 활용 영역 → 제작자 판단 → 팀 검토용 HTML·의견 파일',purpose:'실제 내용을 보고 활용할 부분을 선별',effect:'팀원에게 의도와 수정 의견을 함께 전달',rule:'사용자가 입력한 판단·메모를 해당 콘텐츠 ID에 연결. HTML 저장은 데이터·선택·검토를 모두 포함',limit:'자동 저장·서버 동기화 없음. 창을 닫기 전 저장 필요',scope:'제작자 입력 정보'},true)+`</div>`;
}
function omissionReason(name){if(/Verified|Ledger|Examples_By_Job|Workplace_Type/.test(name))return '채택한 같은 계열 원본·사전 필드와 중복되거나 보조 확인용. 별도 표본으로 더하지 않음.';if(/Patent|Export|Budget|Outlook|Supply_Demand/.test(name))return '거시·전망 맥락은 가능하지만 이번 직무→준비→공고 연결에 직접 필요하지 않아 보류.';if(/NTIS_|Keyword_Matrix|Keyword_Relations|Count_By|Company_Business/.test(name))return '보조 관계·집계 또는 다른 ID 체계. 핵심 흐름에 필요한 직접 연결만 우선 사용.';return '핵심 질문에 사용하는 채택 자료로 우선 구성. 추가 지표의 목적·연결을 검토한 뒤 확장.';}
function toast(text){$('#toast').textContent=text;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4200);}
async function boot(){
 try {
  const bytes=Uint8Array.from(atob($('#dataPayload').textContent.trim()),c=>c.charCodeAt(0));
  const payload=JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  DATA=payload.datasets;AUDIT=payload.audit;CATALOG=payload.catalog;
  state={...state,...JSON.parse($('#savedState').textContent)};
  $('#role').innerHTML='<option value="">관심 직무 선택 전</option>'+rows('T').map(r=>`<option value="${r.job_id}">${esc(r.job_title_ko)}</option>`).join('');
  $('#field').innerHTML='<option value="">전체 활용 분야</option>'+Object.keys(FIELD_RULES).map(f=>`<option>${f}</option>`).join('');
  $('#region').innerHTML='<option value="">전체 지역</option>'+uniq([...rows('J'),...rows('ES')].map(r=>r.province_name).filter(Boolean)).sort().map(r=>`<option>${esc(r)}</option>`).join('');
  [industry,rolesPage,preparation,postingsPage,roadmap,reviewPage].forEach(fn=>fn());
  ['role','field','region'].forEach(k=>$('#'+k).addEventListener('change',e=>{if(k==='role')selectRole(e.target.value);else{state[k]=e.target.value;if(k==='field')state.techFocus='';render();}}));
  $('#loading').hidden=true;$('#app').hidden=false;render();
 }catch(e){$('#loading').textContent='데이터 로딩에 실패했습니다. 최신 Chrome 또는 Edge에서 HTML을 다시 열어 주세요. '+e.message;console.error(e);}
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,[data-chart-action]');if(!b)return;
 if(b.dataset.page!==undefined){state.page=Number(b.dataset.page);render();window.scrollTo(0,0);}
 if(b.hasAttribute('data-region')){state.region=b.dataset.region;render();}
 if(b.hasAttribute('data-major')){state.major=state.major===b.dataset.major?'':b.dataset.major;render();}
 if(b.hasAttribute('data-career')){state.career=state.career===b.dataset.career?'':b.dataset.career;render();}
 if(b.hasAttribute('data-group')){state.group=state.group===b.dataset.group?'':b.dataset.group;render();}
 if(b.dataset.field){state.field=b.dataset.field;state.techFocus='';render();}
 if(b.dataset.raw){openRaw(b.dataset.raw);}
 if(b.dataset.role){selectRole(b.dataset.role);}
 if(b.dataset.activity){const a=b.dataset.activity;state.activity=state.activity.includes(a)?state.activity.filter(x=>x!==a):[...state.activity,a];render();}
 if(b.dataset.techRoles){state.techFocus=b.dataset.techRoles;state.major='';state.activity=[];state.roleQuery='';state.page=1;render();window.scrollTo(0,0);}
 if(b.id==='searchRoles'){state.roleQuery=$('#roleSearch').value;render();}
 if(b.id==='clearRoleFilters'){state.roleQuery='';state.field='';state.major='';state.activity=[];state.techFocus='';render();}
 if(b.dataset.course){state.course=b.dataset.course;state.checks.course=false;render();toast('교육 후보를 로드맵에 반영했습니다.');}
 if(b.dataset.posting){state.posting=b.dataset.posting;state.checks.posting=false;render();toast('선택 공고를 로드맵의 조건 비교 대상으로 반영했습니다.');}
 if(b.id==='rawSearchButton'){state.rawQuery=$('#rawSearch').value;state.rawPage=0;renderRaw();}
 if(b.dataset.rawPage!==undefined){state.rawPage=Number(b.dataset.rawPage);renderRaw();}
 if(b.id==='saveReviews'){download('드론_대시보드_검토의견.json',JSON.stringify({as_of:AUDIT.as_of,reviews:state.reviews,selection:{role:state.role,field:state.field,region:state.region,course:state.course,posting:state.posting}},null,2),'application/json');}
});
document.addEventListener('change',e=>{
 const key=e.target.dataset.state;if(key){state[key]=key==='years'&&e.target.value!==''?String(Math.max(0,Number(e.target.value))):e.target.value;render();}
 const id=e.target.dataset.review;if(id){state.reviews[id]={...state.reviews[id],[e.target.dataset.reviewField]:e.target.value};}
 if(e.target.dataset.skill!==undefined){const s=e.target.dataset.skill;state.skills=e.target.checked?uniq([...state.skills,s]):state.skills.filter(x=>x!==s);render();}
 if(e.target.hasAttribute('data-project'))state.project=e.target.checked;
 if(e.target.dataset.check)state.checks[e.target.dataset.check]=e.target.checked;
 if(e.target.id==='rawDataset'){state.rawName=e.target.value;state.rawQuery='';state.rawPage=0;renderRaw();}
});
document.addEventListener('input',e=>{if(e.target.dataset.review){state.reviews[e.target.dataset.review]={...state.reviews[e.target.dataset.review],[e.target.dataset.reviewField]:e.target.value};}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='roleSearch')$('#searchRoles').click();if(e.key==='Enter'&&e.target.id==='rawSearch')$('#rawSearchButton').click();if(['Enter',' '].includes(e.key)&&e.target.hasAttribute('data-chart-action')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
$('#expand').onclick=()=>{$('#main').querySelectorAll('details.evidence').forEach(d=>d.open=true);};
$('#closeRaw').onclick=()=>$('#rawDialog').close();
$('#reset').onclick=()=>{state.major='';state.field='';state.region='';state.activity=[];state.roleQuery='';state.techFocus='';state.group='';state.career='';state.defense='';state.course='';state.posting='';state.project=false;state.checks={};selectRole('');};
$('#save').onclick=()=>{
 $('#savedState').textContent=JSON.stringify(state).replace(/</g,'\\u003c');
 const clone=document.documentElement.cloneNode(true);clone.querySelector('#rawDialog').removeAttribute('open');clone.querySelector('#toast').style.display='none';
 const a=document.createElement('a');const url=URL.createObjectURL(new Blob(['<!doctype html>\n'+clone.outerHTML],{type:'text/html;charset=utf-8'}));a.href=url;a.download='드론_진로탐색_검토본.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('선택과 검토 메모가 포함된 독립 HTML을 저장했습니다.');
};
function selectRole(id){if(state.role!==id){state.course='';state.posting='';state.project=false;state.checks={};state.group='';state.career='';state.defense='';}state.role=id;render();}
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function openRaw(name){state.rawName=name;state.rawQuery='';state.rawPage=0;renderRaw();if(!$('#rawDialog').open)$('#rawDialog').showModal();}
function renderRaw(){const all=rows(state.rawName),cat=CATALOG.find(x=>x.name===state.rawName);const result=state.rawQuery?all.filter(r=>Object.values(r).some(v=>v.toLowerCase().includes(state.rawQuery.toLowerCase()))):all;const pages=Math.max(1,Math.ceil(result.length/20));state.rawPage=Math.min(state.rawPage,pages-1);const columns=cat.columns;
 $('#rawTitle').textContent='사용 데이터 원문 · '+state.rawName;
 $('#rawBody').innerHTML=`<p class="muted">${esc(cat.purpose)} · 원본 ${num(all.length)}행 · 검색 결과 ${num(result.length)}행<br>해시 SHA-256 ${cat.sha256}</p><div class="source-toolbar"><label>채택 데이터셋<select id="rawDataset">${CATALOG.filter(c=>c.selected).map(c=>`<option value="${c.name}" ${c.name===state.rawName?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><label>모든 원문 필드에서 검색<input id="rawSearch" value="${esc(state.rawQuery)}" placeholder="ID, 기업명, 기술명 등"></label><button id="rawSearchButton">검색</button></div><details><summary>더보기 · 원본 컬럼별 결측</summary>${table(['컬럼','빈 값 / 전체 행'],columns.map(c=>[esc(c),`${cat.missing[c]} / ${cat.rows}`]))}<p>빈 값은 0 또는 요구 없음으로 치환하지 않습니다.</p></details><div class="row"><button data-raw-page="${state.rawPage-1}" ${state.rawPage===0?'disabled':''}>이전 20행</button><span>${state.rawPage+1} / ${pages}페이지</span><button data-raw-page="${state.rawPage+1}" ${state.rawPage>=pages-1?'disabled':''}>다음 20행</button></div>${result.length?table(columns,result.slice(state.rawPage*20,state.rawPage*20+20).map(r=>columns.map(c=>c==='record_json'?`<details><summary>JSON 원문 펼치기</summary><pre>${esc(JSON.stringify(JSON.parse(r[c]),null,2))}</pre></details>`:c.endsWith('_url')&&r[c]?link(r[c],r[c]):`<div class="raw-cell">${esc(r[c]||'— 미수집')}</div>`))):empty('검색 결과 없음')}`;
}

