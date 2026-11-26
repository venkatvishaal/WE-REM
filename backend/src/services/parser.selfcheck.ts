// Self-check for email parsing + application matching. Uses a throwaway in-memory Postgres (PGlite).
// Run: npx ts-node --transpile-only src/services/parser.selfcheck.ts
import * as assert from 'assert';
process.env.DATABASE_URL = ''; // never touch a real database (an empty value also stops dotenv filling it)
process.env.TELEGRAM_BOT_TOKEN = '';

/* eslint-disable @typescript-eslint/no-var-requires */
const { initDb, dbAll, closeDb } = require('../db/database');
const { parseEmail, upsertApplication } = require('./parser.service');
const { upsertUser } = require('./user.service');
let userId = '';

let n = 0;
const msg = (subject: string, sender: string, receivedAt: string, bodyText = '') => ({
  id: `m${++n}`, threadId: '', subject, sender, receivedAt, bodyText, bodyHtml: '', labelIds: [],
});
const apply = (m: ReturnType<typeof msg>) => {
  const p = parseEmail(m);
  assert.ok(p, `should parse: ${m.subject}`);
  return upsertApplication(userId, p, m.id);
};

(async () => {
  await initDb('memory://');
  userId = await upsertUser('selfcheck@example.com');

  // Workday ack -> tenant company
  assert.strictEqual(parseEmail(msg('Thank you for Applying', 'GE Aerospace Workday Notifications <geaerospace@myworkday.com>', '2026-01-01T00:00:00Z')).companyName, 'GE Aerospace');

  // Greenhouse sender -> company from subject, never "Greenhouse Mail"
  assert.strictEqual(parseEmail(msg('Thank you for applying to Stripe', 'no-reply@us.greenhouse-mail.io', '2026-01-01T00:00:00Z')).companyName, 'Stripe');

  // Account verification is not an application
  assert.strictEqual(parseEmail(msg('Verify your candidate account', 'iqvia@otp.workday.com', '2026-01-01T00:00:00Z')), null);

  // Friendly subject, rejection body -> rejected (no-reply senders included)
  const st = (s: string, from: string, body: string) => parseEmail(msg(s, from, '2026-01-01T00:00:00Z', body))?.status;
  assert.strictEqual(st('Thank you for your interest', 'walmart@myworkday.com', 'At this time we have decided not to move forward with your application.'), 'rejected');
  assert.strictEqual(st('Your Application with Danfoss', 'Danfoss Careers <NoReplyHR@danfoss.com>', 'The role has now been filled, and we are closing the process.'), 'position_filled');
  assert.strictEqual(st('Regarding your Honeywell Application for Intern', 'Human Resources <hr@honeywell.com>', 'We will not be pursuing your candidacy for this position.'), 'rejected');
  // Acks with cautious wording stay "applied"
  assert.strictEqual(st('Thanks for your application!', 'haier@myworkday.com', 'Your application is given careful consideration.'), 'applied');
  assert.strictEqual(st('We have received your Application', 'no-reply@hackerrankcareers.com', 'If you do not hear from us within 2 weeks, it means we are unable to proceed with your application at this time.'), 'applied');
  // The user's own reply is ignored
  assert.strictEqual(parseEmail(msg('Re: Regarding your Honeywell Application', 'Venkat <me@gmail.com>', '2026-01-01T00:00:00Z', 'We will not be pursuing your candidacy')), null);

  // Company names: recruiter names, domain casing, missing display name
  const co = (s: string, from: string, body = '') => parseEmail(msg(s, from, '2026-01-01T00:00:00Z', body))?.companyName;
  assert.strictEqual(co('Thank you for your interest in The Nielsen Company', 'Ruth Moniz from The Nielsen Company <notifications@recruiting.example.com>'), 'Nielsen Company');
  assert.strictEqual(co('Update on Your Application: SHL - Research Intern Role', 'Tania Goyal <Tania.Goyal@shl.com>'), 'SHL');
  assert.strictEqual(co('Employment Application for Hyland', 'Payal Ramtake <hyland+email+x@talent.icims.com>', 'Thank you for applying to Hyland.'), 'Hyland');
  assert.strictEqual(co('Thanks for applying to MongoDB!', 'no-reply@mongodb.com'), 'MongoDB');
  assert.strictEqual(co('Your Application for SRE Intern with Red Hat', 'redhat@myworkday.com'), 'Red Hat');
  assert.strictEqual(co('Software Engineer Intern - Digital Technology at Cargill', '<donotreply@cargill.com>', 'Thank you for applying.'), 'Cargill');
  assert.strictEqual(co('We received your Stripe Application', 'no-reply@us.greenhouse-mail.io'), 'Stripe');
  assert.strictEqual(co('Thank You for Your Application', 'SQ1 Security Technology Private Limited Private Limited <x@zoho.com>'), 'SQ1 Security Technology');
  assert.strictEqual(co('Your application for Data Science Intern', 'NO REPLY - BNP Paribas Recruitment <recruitment@bwelcome.hr>', 'Thank you for applying.'), 'BNP Paribas');
  // Sentence fragments are not job titles
  assert.strictEqual(parseEmail(msg('Thank you for applying', 'thermofisher@myworkday.com', '2026-01-01T00:00:00Z', 'Thank you for applying to the following position: x.'))?.jobTitle, 'Position Applied');

  // Interviews in their many forms
  assert.strictEqual(st('Thanks for taking the Customer Experience Engineer 1 - Bangalore (Hybrid)', 'HackerRank Inc Hiring Team <support@hackerrankforwork.com>', 'Your interview is complete. Thanks for completing it.'), 'interview');
  assert.strictEqual(st('You are shortlisted for the Customer Experience Engineer I role at HackerRank', 'HackerRank Inc Hiring Team <support@hackerrankforwork.com>', 'Thank you for taking the next step in your interview process.'), 'interview');
  assert.strictEqual(st('Your Software Engineer - Backend Application is Moving Forward – Complete Your Interview', 'support <support@micro1.ai>', 'Thanks for applying. The next step of the application process is to complete your AI Interview.'), 'interview');
  assert.strictEqual(st('AI interview is complete', 'micro1 <support@micro1.io>', 'Congrats on finishing the AI Interview.'), 'interview');
  assert.strictEqual(co('AI interview is complete', 'micro1 <support@micro1.io>', 'Congrats on finishing the AI Interview.'), 'micro1');
  assert.strictEqual(co('Thanks for taking the Customer Experience Engineer 1', 'HackerRank Inc Hiring Team <support@hackerrankforwork.com>', 'Your interview is complete.'), 'HackerRank');
  const title = (s: string, from: string, body = '') => parseEmail(msg(s, from, '2026-01-01T00:00:00Z', body))?.jobTitle;
  assert.strictEqual(title('Thanks for taking the Customer Experience Engineer 1 - Bangalore (Hybrid)', 'HackerRank Inc Hiring Team <support@hackerrankforwork.com>', 'Your interview is complete.'), 'Customer Experience Engineer 1');
  assert.strictEqual(title('Thanks for taking the AI TA Screen - Software Development Engineer Intern - Bangalore (Onsite)', 'HackerRank Inc Hiring Team <support@hackerrankforwork.com>', 'Your interview is complete.'), 'Software Development Engineer Intern');
  assert.strictEqual(title('Exciting News: We have received your Application || Software Development Engineer Intern ||', 'no-reply@hackerrankcareers.com'), 'Software Development Engineer Intern');
  // Hackathon / programme "shortlists" are not interviews
  assert.notStrictEqual(st('Congratulations! You Have Been Shortlisted for HackVega 2.0', 'MyCareernet <alerts@mycareernet.co>', 'Round 2 starts soon.'), 'interview');
  assert.strictEqual(st('LTM Early Career Hiring | Shortlisted for Online Assessment', 'ECH <ech@ltm.com>', 'Please take the online assessment.'), 'assessment');
  // A test confirmation is not an interview
  assert.notStrictEqual(st('Thanks for taking the Sample Test', 'HackerRank Hiring Team <support@hackerrankforwork.com>', 'Solving code challenges is a great way to keep your skills sharp for interviews.'), 'interview');
  assert.strictEqual(co('Thank you for your interest in HackerRank || Customer Experience Engineer, L1', 'no-reply@hackerrank.com'), 'HackerRank');

  // Same role re-applied 45 days later -> new application
  const r1 = await apply(msg('Exciting News: We have received your Application || Software Development Engineer Intern', 'no-reply@hackerrankcareers.com', '2026-10-05T00:00:00Z', 'Application received for the position of Software Development Engineer Intern.'));
  const r2 = await apply(msg('Exciting News: We have received your Application || Software Development Engineer Intern', 'no-reply@hackerrankcareers.com', '2026-11-20T00:00:00Z', 'Application received for the position of Software Development Engineer Intern.'));
  assert.ok(r2.isNew && r2.applicationId !== r1.applicationId, 're-application is a new row');

  // Response tracking: ack (day 0) -> assessment (day 5) -> interview (day 12) -> rejection (day 20)
  const respApp = async () => (await dbAll('SELECT first_response_at f, last_response_type t FROM applications WHERE company_name = ?', ['Globex']))[0] as any;
  await apply(msg('Thank you for applying to Globex', 'Globex Careers <jobs@globex.com>', '2026-03-01T00:00:00Z'));
  assert.strictEqual((await respApp()).f, null, 'an ack alone is not a response');
  assert.strictEqual((await respApp()).t, null);
  await apply(msg('Globex online assessment invitation', 'Globex Careers <jobs@globex.com>', '2026-03-06T00:00:00Z', 'Please complete the online assessment.'));
  await apply(msg('Interview invitation from Globex', 'Globex Careers <jobs@globex.com>', '2026-03-13T00:00:00Z', 'We would like to invite you to an interview.'));
  await apply(msg('Update on your application', 'Globex Careers <jobs@globex.com>', '2026-03-21T00:00:00Z', 'We have decided not to move forward with your application.'));
  assert.strictEqual((await respApp()).f, '2026-03-06T00:00:00Z', 'first reply = assessment date');
  assert.strictEqual((await respApp()).t, 'rejected', 'latest reply = rejection');
  // An older email processed late doesn't overwrite the latest response
  await apply(msg('Interview invitation from Globex', 'Globex Careers <jobs@globex.com>', '2026-03-10T00:00:00Z', 'We would like to invite you to an interview.'));
  assert.strictEqual((await respApp()).t, 'rejected');

  // Candidate-portal links (real shapes from the user's emails)
  const { candidatePortalUrl } = require('../utils/workday-patterns');
  assert.strictEqual(candidatePortalUrl('see https://micron.wd1.myworkdayjobs.com/External/login?Job_Application_ID=3b96c1'), 'https://micron.wd1.myworkdayjobs.com/External/userHome');
  assert.strictEqual(candidatePortalUrl('<a href="https://statestreet.wd1.myworkdayjobs.com/en-US/Global/userHome">'), 'https://statestreet.wd1.myworkdayjobs.com/Global/userHome');
  assert.strictEqual(candidatePortalUrl('https://iqvia.wd1.myworkdayjobs.com/IQVIA'), 'https://iqvia.wd1.myworkdayjobs.com/IQVIA/userHome');
  assert.strictEqual(candidatePortalUrl('no portal here'), undefined);

  // Portal status text
  const { portalStatusFromText, matchStatusesOnPage } = require('./portal.service');
  assert.strictEqual(portalStatusFromText('Not Selected'), 'rejected');
  assert.strictEqual(portalStatusFromText('No Longer Under Consideration'), 'rejected');
  assert.strictEqual(portalStatusFromText('Not offered'), 'rejected');
  assert.strictEqual(portalStatusFromText('In Consideration'), 'under_review');
  assert.strictEqual(portalStatusFromText('Submitted'), null);
  const page = 'My Applications Active Inactive Intern - Cybersecurity R5033608 Not Selected Submitted 05/05/2026 Data Science Intern R5040001 In Consideration';
  const m = matchStatusesOnPage(page, [
    { id: 'a1', job_title: 'Intern-Cybersecurity', requisition_id: 'R5033608', status: 'applied', portal_url: '' },
    { id: 'a2', job_title: 'Data Science Intern', requisition_id: null, status: 'applied', portal_url: '' },
  ]);
  assert.strictEqual(m.get('a1')?.status, 'rejected');
  assert.strictEqual(m.get('a2')?.status, 'under_review');

  // Telegram alert text + flood guard (no network)
  const { jobAlertText, shouldAlert } = require('./notification.service');
  const alert = jobAlertText('HackerRank', 'Customer Experience Engineer I', 'interview', 'You are shortlisted', '2026-11-26T10:00:00Z');
  assert.strictEqual(alert, '[INTERVIEW] HackerRank\nCustomer Experience Engineer I\n"You are shortlisted"\n26 Nov 2026');
  assert.ok(jobAlertText('Walmart', 'Position Applied', 'rejected', 's', '2026-11-26T10:00:00Z').startsWith('[REJECTED] Walmart\n"s"'), 'generic title omitted');
  assert.ok(jobAlertText('Acme', 'Intern', 'acknowledged', 's', '2026-11-26T10:00:00Z').startsWith('[APPLICATION RECEIVED] Acme'));
  const now = Date.parse('2026-11-26T12:00:00Z');
  assert.ok(shouldAlert('2026-11-25T12:00:00Z', now), 'a 1-day-old email alerts');
  assert.ok(!shouldAlert('2026-11-20T12:00:00Z', now), 'a 6-day-old email does not');

  // Two acks from the same company, a week apart, different roles -> two applications
  const a = await apply(msg('Thanks for applying to the Backend Intern at Acme', 'Acme Recruiting <jobs@acme.com>', '2026-01-01T00:00:00Z'));
  const b = await apply(msg('Thanks for applying to the Data Intern at Acme', 'Acme Recruiting <jobs@acme.com>', '2026-01-15T00:00:00Z'));
  assert.ok(a.isNew && b.isNew && a.applicationId !== b.applicationId, 'second role must be a new row');

  // Duplicate confirmation the same day -> merged
  const c = await apply(msg('Thank you for your application', 'Acme Recruiting <jobs@acme.com>', '2026-01-15T05:00:00Z'));
  assert.strictEqual(c.applicationId, b.applicationId, 'same-day duplicate ack merges');

  // Rejection updates the most recently active open application
  const rejection = msg('Update on your application', 'Acme Recruiting <jobs@acme.com>', '2026-01-20T00:00:00Z', 'Unfortunately, we will not be moving forward with your application.');
  const r = await apply(rejection);
  assert.strictEqual(r.applicationId, b.applicationId);
  assert.ok(r.statusChanged);

  // Reprocessing the same email adds no timeline event
  const before = (await dbAll('SELECT id FROM timeline_events')).length;
  await apply(rejection);
  assert.strictEqual((await dbAll('SELECT id FROM timeline_events')).length, before, 'timeline deduped');

  await closeDb();
  console.log('parser self-check: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
