require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/User');
const Project  = require('../models/Project');
const WeeklyReport = require('../models/WeeklyReport');
const { getWeekKey, getWeekStart } = require('./weekUtils');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/rag_tracker');
  console.log('Connected to MongoDB — seeding...');

  // ── Clear existing data ──────────────────────────────────────────────────
  await Promise.all([User.deleteMany(), Project.deleteMany(), WeeklyReport.deleteMany()]);

  // ── Users ────────────────────────────────────────────────────────────────
  const hashedAdmin = await bcrypt.hash('admin123', 12);
  const hashedPM    = await bcrypt.hash('pm123', 12);
  const hashedExec  = await bcrypt.hash('exec123', 12);

  const users = await User.insertMany([
    { name: 'Admin',          email: 'admin@ee.com',   password: hashedAdmin, role: 'admin' },
    { name: 'Jasmine Hakim',  email: 'jasmine@ee.com', password: hashedPM,    role: 'pm' },
    { name: 'Hina Mundhwa',   email: 'hina@ee.com',    password: hashedPM,    role: 'pm' },
    { name: 'Ronnit Samuel',  email: 'ronnit@ee.com',  password: hashedPM,    role: 'pm' },
    { name: 'Karan Mehta',    email: 'karan@ee.com',   password: hashedPM,    role: 'pm' },
    { name: 'Executive',      email: 'exec@ee.com',    password: hashedExec,  role: 'exec' },
  ]);

  const [, jasmine, hina, ronnit, karan] = users;

  // ── Projects ─────────────────────────────────────────────────────────────
  const projects = await Project.insertMany([
    { name: 'SBQ-Odoo Integration', client: 'SBQ',             type: 'T & Material', pm: jasmine._id },
    { name: 'Weloka',               client: 'Weloka BV',       type: 'T & Material', pm: jasmine._id },
    { name: 'BAS',                  client: 'BAS Group',       type: 'T & Material', pm: jasmine._id },
    { name: 'EE_DirectWonen',       client: 'DirectWonen',     type: 'T & Material', pm: hina._id },
    { name: 'ACSI_DevOps',          client: 'ACSI Group',      type: 'Fixed Price',  pm: hina._id },
    { name: 'EE - MediaArtists',    client: 'MediaArtists',    type: 'Retainer',     pm: hina._id },
    { name: 'viewonIT',             client: 'ViewOnIT',        type: 'T & Material', pm: ronnit._id },
    { name: 'easy2coach',           client: 'Easy2Coach',      type: 'Retainer',     pm: ronnit._id },
    { name: 'ACSI_Wordpress',       client: 'ACSI Group',      type: 'T & Material', pm: karan._id },
    { name: 'Meininger',            client: 'Meininger Hotels',type: 'Fixed Price',  pm: karan._id },
  ]);

  // ── Weekly Reports — seed 6 months of data ──────────────────────────────
  const ragHistory = ['Green', 'Green', 'Amber', 'Green', 'Red', 'Amber', 'Green'];
  const reports = [];
  const now = new Date();

  for (const proj of projects) {
    for (let weeksBack = 26; weeksBack >= 0; weeksBack--) {
      const date = new Date(now);
      date.setDate(date.getDate() - weeksBack * 7);
      const weekStart = getWeekStart(date);
      const weekKey   = getWeekKey(date);

      // Skip future weeks
      if (weekStart > now) continue;

      const ragIdx = (weeksBack + proj.name.length) % ragHistory.length;
      const rag    = ragHistory[ragIdx];
      const prevRagIdx = (weeksBack + proj.name.length + 1) % ragHistory.length;
      const prevRag = weeksBack === 26 ? 'NA' : ragHistory[prevRagIdx];

      reports.push({
        project:    proj._id,
        pm:         proj.pm,
        weekKey,
        weekStartDate: weekStart,
        rag,
        prevRag,
        reasonForRag:  rag !== 'Green' ? `Sample ${rag} issue for week ${weekKey}` : '',
        pathToGreen:   rag === 'Red' ? 'Action items identified — resolution in progress.' : '',
        teamSize:      '2 Dev + 1 QA',
        billingCount:  2,
        currentBillableCount: 2,
        submittedAt:   weekStart,
        lastEditedAt:  weekStart,
        deliverables: [
          { type: 'Story', task: `Sprint task — ${weekKey}`, owner: 'Dev', eta: new Date(weekStart.getTime() + 5*86400000), status: rag === 'Red' ? 'Delayed' : 'Completed' },
        ],
        attrition:   [],
        escalations: [],
      });
    }
  }

  await WeeklyReport.insertMany(reports);

  console.log(`✅ Seeded: ${users.length} users, ${projects.length} projects, ${reports.length} weekly reports`);
  console.log('\nDemo credentials:');
  console.log('  Admin:    admin@ee.com   / admin123');
  console.log('  PM:       jasmine@ee.com / pm123');
  console.log('  Exec:     exec@ee.com    / exec123');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
