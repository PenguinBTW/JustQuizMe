const express = require('express');
const path = require('path');
const config = require('./config');

const QuizService = require('./services/quiz-service');
const SaveService = require('./services/save-service');

const createApiRouter = require('./routes/api');
const createCsRouter = require('./routes/cs');
const createMathsRouter = require('./routes/maths');
const createPhysicsRouter = require('./routes/physics');

const app = express();

// Lightweight CORS middleware (Zero external dependencies)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json({ limit: '5mb' }));

// 1. Initialize Subject Services
const services = {
  cs: {
    quizService: new QuizService(config.SUBJECTS.cs),
    saveService: new SaveService('cs', config.SUBJECTS.cs.dataDir, path.join(__dirname, '../../Computer Science/app/data'))
  },
  maths: {
    quizService: new QuizService(config.SUBJECTS.maths),
    saveService: new SaveService('maths', config.SUBJECTS.maths.dataDir, path.join(__dirname, '../../Maths/app/data'))
  },
  physics: {
    quizService: new QuizService(config.SUBJECTS.physics),
    saveService: new SaveService('physics', config.SUBJECTS.physics.dataDir, path.join(__dirname, '../../Physics/Quiz system/app/data'))
  }
};

// 2. Question Bank Past-Paper Image Static Assets
app.use('/physics/images/past-paper', express.static(path.join(config.SUBJECTS.physics.questionsDir, 'past-paper')));
app.use('/cs/images/past-paper', express.static(path.join(config.SUBJECTS.cs.questionsDir, 'past-paper')));
app.use('/maths/images/past-paper', express.static(path.join(config.SUBJECTS.maths.questionsDir, 'past-paper')));
// Universal fallback for relative images
app.use('/images/past-paper', express.static(path.join(config.SUBJECTS.physics.questionsDir, 'past-paper')));

// 3. Mount API Routers (both /api/{subj} and /{subj}/api for bulletproof compatibility)
const csRouter = createCsRouter(services.cs.quizService, services.cs.saveService);
const mathsRouter = createMathsRouter(services.maths.quizService, services.maths.saveService);
const physicsRouter = createPhysicsRouter(services.physics.quizService, services.physics.saveService);
const apiRouter = createApiRouter(services);

app.use('/api', apiRouter);

app.use('/api/cs', csRouter);
app.use('/cs/api', csRouter);

app.use('/api/maths', mathsRouter);
app.use('/maths/api', mathsRouter);

app.use('/api/physics', physicsRouter);
app.use('/physics/api', physicsRouter);

// 4. Mount Static Frontend Applications
app.use('/shared', express.static(path.join(config.PUBLIC_DIR, 'shared')));
app.use('/cs', express.static(path.join(config.PUBLIC_DIR, 'cs')));
app.use('/maths', express.static(path.join(config.PUBLIC_DIR, 'maths')));
app.use('/physics', express.static(path.join(config.PUBLIC_DIR, 'physics')));
app.use('/', express.static(path.join(config.PUBLIC_DIR, 'home')));

// 5. HTML Entrypoint Routes
app.get(['/cs', '/cs/*'], (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'cs', 'index.html')));
app.get(['/maths', '/maths/*'], (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'maths', 'index.html')));
app.get(['/physics', '/physics/*'], (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'physics', 'index.html')));
app.get('*', (req, res) => res.sendFile(path.join(config.PUBLIC_DIR, 'home', 'index.html')));

// 6. Start Unified Server
app.listen(config.PORT, () => {
  console.log(`\n======================================================`);
  console.log(`   JustQuizMe Unified Master Suite is LIVE!`);
  console.log(`   URL: http://localhost:${config.PORT}`);
  console.log(`   --------------------------------------------------`);
  console.log(`   Master Launchpad: http://localhost:${config.PORT}/`);
  console.log(`   Computer Science: http://localhost:${config.PORT}/cs`);
  console.log(`   Mathematics:      http://localhost:${config.PORT}/maths`);
  console.log(`   Physics:          http://localhost:${config.PORT}/physics`);
  console.log(`======================================================\n`);
});
