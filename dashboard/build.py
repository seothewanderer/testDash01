"""Build a self-contained review dashboard using only Python's standard library."""
import base64
import csv
import gzip
import hashlib
import json
import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent
AS_OF = '2026-09-26'
SELECTED = {
    'Industry_Size_Annual_Trends': '산업 규모와 조사 한계를 먼저 이해',
    'Public_Agency_Drone_Use_Cases': '실제 활용 목적에서 현장 업무로 연결',
    'NTIS_National_RnD_Project_Master': '연구 주제로 기술·학습 관심을 발견',
    'DAPA_Drone_Contracts': '방산의 납품·정비·용역 업무 맥락',
    'Defense_Drone_Tech_Standard': '국방 응용 기술을 설명',
    'Technology_Job_Mapping': '국방 기술에서 직무와 기초 학습으로 연결',
    'Drone_Job_Classification': '관심 직무와 실제 업무를 탐색하는 중심 사전',
    'Required_Skills_By_Job_Long': '직무별 준비 역량과 개인 학습 차이',
    'Actual_Job_Posting_Evidence': '직무 사전과 직접 연결된 수집 공고 사례',
    'Job_Posting_Analysis_Data': '지역·경력·학력 등 확인된 공고 조건 비교',
    'Job_Posting_Keyword_Frequency': '전체 표본의 키워드 참고; 개별 공고 연결 금지',
    'Training_Course_Master': '직무와 연관된 과정 후보·시간·비용 확인',
    'Training_Session_Analysis': '과정의 지역·일정·원문을 확인',
    'Annual_Certification_Issuance': '자격 취득 현황과 채용 언급을 구분',
    'Company_Organization_Master': '기업명과 방산 분류의 원래 근거',
    'Company_Business_Area_Links_Verified': '기업 사업 분야를 지원 후보 탐색에 활용',
    'Company_Defense_Evidence_Verified': '방산 관련 근거의 강도·시점·주의점 확인',
}


def read_data():
    datasets, catalog = {}, []
    for path in sorted((ROOT / 'data/raw').glob('*.csv')):
        with path.open(encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream)
            rows = list(reader)
            columns = reader.fieldnames
        datasets[path.stem] = rows
        catalog.append(dict(name=path.stem, rows=len(rows), columns=columns,
                            missing={k: sum(not r[k].strip() for r in rows) for k in columns},
                            sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    return datasets, catalog


def salary_range(row):
    """Only re-extract explicitly annual salary, keeping the original row intact."""
    if row['salary_type'] != '연봉':
        return None
    text = row['salary_raw'].replace(',', '')
    match = re.search(r'(\d+)\s*[~～\-]\s*(\d+)\s*만', text)
    if match:
        return dict(min=int(match[1]), max=int(match[2]), basis=row['salary_raw'], rule='연봉 원문 범위 재추출')
    match = re.search(r'(\d+)\s*만', text)
    if match:
        return dict(min=int(match[1]), max=None, basis=row['salary_raw'], rule='연봉 원문 단일 금액; 상한 미확인')
    return dict(min=None, max=None, basis=row['salary_raw'], rule='원문 수동 확인 필요')


def make_audit(d):
    jobs = d['Job_Posting_Analysis_Data']
    companies = {r['company_name_normalized']: r for r in d['Company_Organization_Master']}
    courses = d['Training_Course_Master']
    sessions = d['Training_Session_Analysis']
    company_links = [dict(posting_id=r['posting_id'], source_name=r['employer_name'],
                          company_id=companies.get(r['employer_name'], {}).get('company_id'),
                          basis='기업명 정확 일치' if r['employer_name'] in companies else '기업정보 미연결',
                          rule_version='exact-name-v1') for r in jobs]
    issues = [r['course_id'] for r in courses if
              float(r['actual_training_cost_won']) - float(r['government_subsidy_won']) != float(r['expected_out_of_pocket_won'])]
    statuses = Counter('종료' if r['end_date'] < AS_OF else '시작 예정' if r['start_date'] > AS_OF else '진행' for r in sessions)
    return dict(as_of=AS_OF, company_links=company_links, salary={r['posting_id']: salary_range(r) for r in jobs if salary_range(r)},
                cost_issue_ids=issues, schedule_status=dict(statuses),
                counts=dict(files=len(d), postings=len({r['posting_id'] for r in jobs}), roles=len(d['Drone_Job_Classification']),
                            courses=len(courses), sessions=len(sessions), companies=len(companies),
                            linked_postings=sum(bool(r['company_id']) for r in company_links),
                            high_confidence_projects=sum(r['ranking_inclusion_flag'] == '1' for r in d['NTIS_National_RnD_Project_Master']),
                            bid_items=len(d['PPS_Drone_Bids']), bids=len({r['bid_no'] for r in d['PPS_Drone_Bids']}),
                            contract_rows=len(d['DAPA_Drone_Contracts']), contracts=len({r['contract_no'] for r in d['DAPA_Drone_Contracts']})))


def build():
    d, catalog = read_data()
    audit = make_audit(d)
    for entry in catalog:
        entry['selected'] = entry['name'] in SELECTED
        entry['purpose'] = SELECTED.get(entry['name'], '이번 핵심 진로 흐름에서 직접 사용하지 않음. 원본 보존; 필요 시 후속 검토.')
    # Only sources serving the career journey are embedded; unselected data is catalogued, not visualized.
    payload = json.dumps(dict(datasets={k: d[k] for k in SELECTED}, catalog=catalog, audit=audit), ensure_ascii=False, separators=(',', ':')).encode()
    packed = base64.b64encode(gzip.compress(payload, mtime=0)).decode()
    html = (ROOT / 'src/index.html').read_text(encoding='utf-8')
    html = html.replace('/*__STYLE__*/', (ROOT / 'src/style.css').read_text(encoding='utf-8'))
    script = 'const EVIDENCE = ' + (ROOT / 'src/evidence.json').read_text(encoding='utf-8') + ';\n'
    script += (ROOT / 'src/app.js').read_text(encoding='utf-8') + '\n'
    script += (ROOT / 'src/charts.js').read_text(encoding='utf-8') + '\n'
    script += (ROOT / 'src/views.js').read_text(encoding='utf-8') + '\nboot();'
    html = html.replace('/*__APP__*/', script)
    html = html.replace('__PAYLOAD__', packed)
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist/index.html').write_text(html, encoding='utf-8')
    (ROOT / 'data/audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'data/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(dict(output=str(ROOT / 'dist/index.html'), bytes=len(html.encode()), counts=audit['counts']), ensure_ascii=False))


if __name__ == '__main__':
    build()
