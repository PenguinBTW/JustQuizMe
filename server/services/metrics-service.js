const fs = require('fs');
const path = require('path');
const config = require('../config');

function getSubjectMetrics(quizService, subjectKey) {
  const subjConfig = config.SUBJECTS[subjectKey];
  const list = quizService.listQuizzes();
  const allQuizzes = [...list['past-paper'], ...list.normal];

  let totalQuestions = 0;
  let totalMarks = 0;
  const topicSet = new Set();

  allQuizzes.forEach(q => {
    totalQuestions += q.questionCount || 0;
    totalMarks += q.totalMarks || 0;
    (q.topics || []).forEach(t => topicSet.add(t));
  });

  return {
    name: subjConfig.name,
    spec: subjConfig.spec,
    accent: subjConfig.accent,
    papers: list['past-paper'].length,
    questions: totalQuestions,
    marks: totalMarks,
    topics: topicSet.size || (subjConfig.topics ? subjConfig.topics.length : 12)
  };
}

function calculateAllMetrics(services) {
  const out = {
    subjects: {},
    totals: {
      papers: 0,
      questions: 0,
      marks: 0,
      topics: 0
    }
  };

  for (const [key, svc] of Object.entries(services)) {
    const met = getSubjectMetrics(svc.quizService, key);
    out.subjects[key] = met;
    out.totals.papers += met.papers;
    out.totals.questions += met.questions;
    out.totals.marks += met.marks;
    out.totals.topics += met.topics;
  }

  return out;
}

module.exports = {
  calculateAllMetrics
};
