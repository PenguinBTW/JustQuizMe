"""Seed schema-valid multi-question banks into the external question dirs so
integration flows have enough material (mock series needs 8+ pooled questions).
Run once per environment: python3 test/integration/seed_banks.py
Idempotent — overwrites the same seed files.
"""
import json, os, uuid as uu

def mcq(i, topic, sub):
    return {
        "id": f"q{i}", "marks": 1, "type": "multiple-choice", "topic": topic, "subtopic": sub,
        "prompt": f"Which statement about {sub.lower()} is correct?",
        "options": [
            {"text": f"Correct statement about {sub}", "feedback": "Right — this is the defining property."},
            {"text": "Plausible but wrong distractor", "feedback": "Common misconception — check the definition."},
            {"text": "Clearly wrong option", "feedback": "This contradicts the basic model."},
            {"text": "Second wrong option", "feedback": "Not applicable here."}
        ],
        "correctIndex": 0
    }

def written(i, topic, sub, marks=4):
    return {
        "id": f"q{i}", "marks": marks, "type": "written", "topic": topic, "subtopic": sub,
        "prompt": f"Explain how {sub.lower()} applies in this scenario. [{marks} marks]",
        "guidance": "Use correct technical terminology.",
        "markScheme": [{"text": f"States the core principle of {sub}", "marks": 1}, {"text": "Applies it to the scenario", "marks": marks - 1}]
    }

def calc(i, topic, sub):
    return {
        "id": f"q{i}", "marks": 3, "type": "calculation", "topic": topic, "subtopic": sub,
        "prompt": f"Calculate the value for this {sub.lower()} problem. Give your answer to 3 significant figures.",
        "answer": 42.0, "tolerance": 0.5, "unit": "units"
    }

def bank(subject, spec, title, topics_map, kind_types):
    qs, i = [], 1
    for topic, subs in topics_map.items():
        for sub in subs:
            for t in kind_types:
                qs.append({'mcq': mcq, 'written': written, 'calc': calc}[t](i, topic, sub))
                i += 1
    return {"uuid": str(uu.uuid4()), "version": 1, "title": title, "subject": subject,
            "specCode": spec, "topics": list(topics_map.keys()), "timeLimitMinutes": None, "questions": qs}

CS1 = {"Systems Architecture": ["CPU structure", "Pipelining"], "Software & Development": ["Algorithms", "Data types"]}
CS2 = {"Exchanging Data": ["Networks", "Protocols"], "Data Types & Structures": ["Arrays", "Records"]}
MATHS = {"Algebra, Polynomials & Proof": ["Factor theorem", "Proof by contradiction"], "Vectors": ["Vector geometry", "Scalar product"]}
PHYS = {"Mechanics": ["SUVAT", "Newton's laws"], "Electricity": ["Circuits", "Resistivity"]}

def build():
    b1 = bank('cs', 'H446/01', 'Seed Paper Comp 01', CS1, ['mcq', 'written']); b1['component'] = '01'
    b2 = bank('cs', 'H446/02', 'Seed Paper Comp 02', CS2, ['mcq', 'written', 'calc']); b2['component'] = '02'
    mb = bank('maths', 'H240/01', 'Seed Pure Mathematics', MATHS, ['mcq', 'written', 'calc'])
    pb = bank('physics', '7408/1', 'Seed Physics Paper', PHYS, ['mcq', 'written', 'calc'])
    return b1, b2, mb, pb

def seed():
    b1, b2, mb, pb = build()
    targets = [
        (os.path.expanduser('~/repos/Computer Science/questions/normal/seed-comp01.json'), b1),
        (os.path.expanduser('~/repos/Computer Science/questions/normal/seed-comp02.json'), b2),
        (os.path.expanduser('~/repos/Computer Science/questions/past-paper/seed-past01.json'), b1),
        (os.path.expanduser('~/repos/Maths/questions/normal/seed-pure.json'), mb),
        (os.path.expanduser('~/repos/Maths/questions/past-paper/seed-past.json'), mb),
        (os.path.expanduser('~/repos/Physics/Quiz system/questions/normal/seed-physics.json'), pb),
        (os.path.expanduser('~/repos/Physics/Quiz system/questions/past-paper/seed-past.json'), pb),
    ]
    for path, b in targets:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        json.dump(b, open(path, 'w'), indent=1)
        print('seeded', path, len(b['questions']), 'questions')

if __name__ == '__main__':
    seed()
