"""Data safeguards that protect the dashboard's interpretation."""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build import read_data, make_audit, salary_range, SELECTED


class DataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d, cls.catalog = read_data()
        cls.a = make_audit(cls.d)

    def test_source_inventory_and_scope(self):
        self.assertEqual(len(self.d), 54)
        self.assertEqual(len(SELECTED), 17)
        self.assertTrue(set(SELECTED).issubset(self.d))

    def test_primary_ids_unique(self):
        for name, key in [('Drone_Job_Classification','job_id'), ('Job_Posting_Analysis_Data','posting_id'),
                          ('Training_Course_Master','course_id'), ('Company_Organization_Master','company_id'),
                          ('NTIS_National_RnD_Project_Master','project_id')]:
            with self.subTest(name=name):
                self.assertEqual(len(self.d[name]), len({r[key] for r in self.d[name]}))

    def test_foreign_keys(self):
        for master, key, detail in [('Drone_Job_Classification','job_id','Required_Skills_By_Job_Long'),
                                     ('Drone_Job_Classification','job_id','Actual_Job_Posting_Evidence'),
                                     ('Training_Course_Master','course_id','Training_Session_Analysis'),
                                     ('Company_Organization_Master','company_id','Company_Defense_Evidence_Verified')]:
            self.assertTrue({r[key] for r in self.d[detail]}.issubset({r[key] for r in self.d[master]}))

    def test_company_join_retains_unmatched(self):
        self.assertEqual(len(self.a['company_links']), 135)
        self.assertEqual(sum(bool(x['company_id']) for x in self.a['company_links']), 52)

    def test_cost_and_schedule_are_not_misrepresented(self):
        self.assertEqual(len(self.a['cost_issue_ids']), 147)
        self.assertEqual(self.a['schedule_status'], {'종료':916, '진행':129, '시작 예정':217})

    def test_salary_corrections_from_source(self):
        for pid, expected in [('JOB_49893527',(5000,8000)), ('JOB_49994334',(2600,5000))]:
            p = next(r for r in self.d['Job_Posting_Analysis_Data'] if r['posting_id'] == pid)
            parsed = salary_range(p)
            self.assertEqual((parsed['min'],parsed['max']),expected)
        self.assertEqual(len(self.a['salary']), 9)
        self.assertIsNone(salary_range({'salary_type':'불명'}))

    def test_observation_units(self):
        self.assertEqual(self.a['counts']['high_confidence_projects'],2936)
        self.assertEqual(self.a['counts']['contracts'],367)
        self.assertEqual(self.a['counts']['contract_rows'],416)
        self.assertEqual(sum(int(r['posting_count']) for r in self.d['Job_Posting_Keyword_Frequency']),622)


if __name__ == '__main__':
    unittest.main(verbosity=2)
