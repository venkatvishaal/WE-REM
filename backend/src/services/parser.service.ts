import { RawGmailMessage } from './gmail.service';
import {
  isAtsSender,
  isJobApplicationRelated,
  SUBJECT_PATTERNS,
  COMPANY_EXTRACTION_PATTERNS,
  JOB_TITLE_PATTERNS,
  REQUISITION_ID_PATTERNS,
  extractPortalInfo,
  candidatePortalUrl,
  formatTenantName,
  knownTenant,
  canTransitionStatus,
  REJECTION_BODY_PATTERN,
  INTERVIEW_BODY_PATTERN,
  POSITION_FILLED_BODY_PATTERN,
  outcomeText,
} from '../utils/workday-patterns';
import { dbRun, dbGet, dbAll } from '../db/database';
import { generateId } from '../utils/crypto';

export interface ParsedApplication {
  companyName: string;
  jobTitle: string;
  requisitionId?: string;
  portalUrl?: string;
  portalTenant?: string;
  status: string;
  statusHint?: string;
  eventType: string;
  appliedAt: string;
  rawEmailId: string;
  subject?: string;
}

// ── Text extraction helpers ────────────────────────────────────
export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractFirstMatch(text: string, patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return undefined;
}

function isNonApplicationEmail(subject: string, sender: string): boolean {
  if (
    /verification code|one-time passcode|security code|verify your email|reset your password|password reset|login verification|account verification|\botp\b/i.test(subject) ||
    /job alert|jobs matching your preferences|new jobs posted|recommended jobs|jobs you may be interested in|daily job alert/i.test(subject) ||
    /submit your projects by|new jobs in|practice could lead to/i.test(subject) ||
    /we have new opportunities you may be interested in/i.test(subject) ||
    /confirm your email address|two-step verification/i.test(subject) ||
    /verify your candidate account|create your candidate home/i.test(subject) ||
    /\bapply now\b/i.test(subject)
  ) {
    return true;
  }
  // The user's own replies/forwards from a personal mailbox
  if (/^(?:re|fwd?|fw):/i.test(subject) && /@(?:gmail|yahoo|outlook|hotmail)\./i.test(sender)) {
    return true;
  }
  return false;
}

// ── Classify event from subject/body ──────────────────────────
export interface ClassifiedEvent {
  eventType: string;
  statusHint?: string;
}

export function classifyEmail(subject: string, body: string): ClassifiedEvent {
  const outcome = outcomeText(body);
  if (POSITION_FILLED_BODY_PATTERN.test(outcome)) return { eventType: 'position_filled', statusHint: 'position_filled' };
  if (REJECTION_BODY_PATTERN.test(outcome)) return { eventType: 'rejected', statusHint: 'rejected' };

  const fromSubject = SUBJECT_PATTERNS.find(({ pattern }) => pattern.test(subject));
  // An interview mentioned in the body beats a plain "Thanks for applying" subject
  if (fromSubject?.statusHint && fromSubject.statusHint !== 'applied') return fromSubject;
  if (INTERVIEW_BODY_PATTERN.test(outcome)) return { eventType: 'interview', statusHint: 'interview' };
  if (fromSubject?.statusHint) return fromSubject;
  // Generic subjects ("Update on your application") carry no status; the body decides
  const head = body.slice(0, 3000);
  const fromBody = SUBJECT_PATTERNS.find(({ pattern, statusHint }) => statusHint && pattern.test(head));
  if (fromBody) return fromBody;
  return fromSubject || { eventType: 'status_change', statusHint: undefined };
}

// ── Smart Company Extraction ──────────────────────────────────
const INVALID_COMPANIES = new Set([
  'our', 'a', 'an', 'the', 'this', 'us', 'you', 'your', 'my', 'their',
  'position', 'role', 'job', 'application', 'candidate', 'home',
  'recruiting', 'careers', 'talent', 'team', 'workday', 'greenhouse',
  'lever', 'smartrecruiters', 'ashby', 'icims', 'jobvite', 'system',
  'admin', 'notifications', 'no reply', 'noreply', 'donotreply',
]);

function cleanCompanyName(raw: string): string {
  let cleaned = raw
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(?:no.?reply|info|admin|hello)\s*[-–:|]?\s+/i, '')
    .replace(/^(?:sincerely|warm regards|best regards|regards|from|the|at|with)\s*,?\s*/i, '')
    .replace(/\s*\b(?:careers?|recruiting|recruitment|resourcing|talent acquisition|talent team|talent|people team|people services|human resources|hr|hiring team|team|global|notifications?|system|support)\b.*/gi, '')
    .replace(/[^A-Za-z0-9\s&,\.\-]/g, '')
    .replace(/\s+icims$/i, '')
    .replace(/(?:[\s,]+(?:private|pvt\.?|limited|ltd\.?|llc\.?|inc\.?|corp\.?|corporation|gmbh|co\.?))+\.?$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Remove common trailing words
  cleaned = cleaned.replace(/\s+(?:via\s+[A-Za-z0-9]+)$/i, '').trim();

  if (cleaned.length < 2 || INVALID_COMPANIES.has(cleaned.toLowerCase())) return '';
  if (/\b(?:our|your|joining)\b/i.test(cleaned)) return ''; // sentence fragments
  return cleaned;
}

// "redhat" -> "Red Hat", "mongodb" -> "MongoDB" when the email spells it that way.
function nameFromSlug(slug: string, text: string): string {
  const known = knownTenant(slug);
  if (known) return known;
  const letters = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (letters.length >= 2) {
    const re = new RegExp(`\\b${letters.split('').join('[\\s.&-]?')}\\b`, 'i');
    const m = text.match(re);
    if (m && /[A-Z]/.test(m[0])) return m[0].trim();
  }
  return formatTenantName(slug);
}

// "Tania Goyal <tania.goyal@shl.com>": a recruiter's own name, not the company.
function looksLikePersonName(display: string, email: string): boolean {
  if (!/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(display)) return false;
  const local = email.split('@')[0];
  return display.toLowerCase().split(/\s+/).some((w) => w.length >= 3 && local.includes(w));
}

function extractCompanyFromSender(sender: string, text = ''): string | undefined {
  // Extract display name and email address
  const email = (sender.match(/<([^>]+)>/)?.[1] || sender).trim().toLowerCase();
  let display = sender.match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim() || '';

  // "Ruth Moniz from The Nielsen Company"
  const fromMatch = display.match(/\bfrom\s+(.+)$/i);
  if (fromMatch) display = fromMatch[1];

  // Check display name for Workday/system generic words
  const isGenericDisplay = !display || /workday|system|do-not-reply|donotreply|^no.?reply$|support|notifications|^human resources$|^hr$|^careers?$|^recruiting$|^talent acquisition$|interview.?schedul/i.test(display);

  // 1. If sender email is Workday: tenant@myworkday.com or tenant@otp.workday.com
  const workdayEmailMatch = email.match(/^([a-z0-9\-_]+)@(?:[a-z0-9\-]+\.)?(?:my)?workday\.com$/i);
  if (workdayEmailMatch) {
    const tenant = workdayEmailMatch[1].toLowerCase();
    if (!INVALID_COMPANIES.has(tenant)) {
      return nameFromSlug(tenant, text);
    }
  }

  // iCIMS: hyland+email+...@talent.icims.com
  // The display name is often a recruiter, so trust it only if it agrees with the slug.
  const icimsMatch = email.match(/^([a-z0-9]+)\+[^@]*@(?:[a-z0-9\-]+\.)*icims\.com$/i);
  if (icimsMatch) {
    const slug = icimsMatch[1].toLowerCase();
    const firstWord = display.split(/\s+/)[0]?.toLowerCase() || '';
    const fromDisplay = firstWord.length >= 3 && slug.includes(firstWord) ? cleanCompanyName(display) : '';
    return fromDisplay || nameFromSlug(slug, text);
  }

  // 2. "Company via ATS" or "Company Recruiting" in display name
  if (display && !isGenericDisplay && (fromMatch || !looksLikePersonName(display, email))) {
    const viaMatch = display.match(/^(.+?)\s+via\s+(?:Greenhouse|Lever|SmartRecruiters|Workday|Ashby|Workable)/i);
    if (viaMatch) {
      const c = cleanCompanyName(viaMatch[1]);
      if (c) return c;
    }

    const cleaned = cleanCompanyName(display);
    if (cleaned) return cleaned;
  }

  // 3. Sender email domain for direct company emails (e.g. careers@stripe.com, pgworkdaysystem.im@pg.com)
  const domainMatch = email.match(/@(?:[^@]+\.)?([a-z0-9\-]+)\.(?:com|org|io|net|co|in|edu|de|uk|fr|ai|global|jobs)$/i);
  if (domainMatch) {
    const sld = domainMatch[1].toLowerCase();
    if (sld === 'pg') return 'Procter & Gamble (P&G)';
    // ATS domains (greenhouse-mail.io, ashbyhq.com, ...) are never the employer
    if (isAtsSender(email)) return undefined;
    if (!INVALID_COMPANIES.has(sld) && !/^(?:gmail|yahoo|outlook|hotmail|workday|greenhouse|lever|smartrecruiters|ashby|icims|jobvite|taleo|bamboohr|workable)$/i.test(sld)) {
      return nameFromSlug(sld, text);
    }
  }

  return undefined;
}

// ── Smart Job Title Extraction ─────────────────────────────────
const INVALID_TITLE_PHRASES = [
  'time and energy',
  'matches your qualifications',
  'becomes available',
  'thank you',
  'sincerely',
  'invested in your application',
  'submitted application',
  'reviewing your',
  'pleased to',
  'welcome to',
  'received your',
  'candidate home',
  'online assessment',
];

function cleanJobTitle(title: string, companyName?: string): string {
  let cleaned = title
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/\s*\(Open\)/i, '')
    .replace(/\s*\(Closed\)/i, '')
    .replace(/\s*\(req(?:uisition)?\s*#?.*?\)/i, '')
    .replace(/\s*\([A-Z0-9\-_]{4,}\)/i, '')
    .replace(/\s+(?:at|with|-|–)\s+[A-Z].*$/i, '')
    .replace(/[,;:\.\-–]\s*$/, '')
    .trim();

  // Strip leading requisition IDs like "R5033608 Intern-Cybersecurity" -> "Intern-Cybersecurity"
  cleaned = cleaned.replace(/^(?:R-?\d{5,}|JR-?\d{4,}|REQ-?\d{4,})\s*[-–:]?\s*/i, '').trim();

  // Strip trailing requisition codes like "Intern - R00244571" -> "Intern"
  cleaned = cleaned.replace(/\s*[-–]\s*(?:R-?|JR-?|REQ-?)?\d+.*$/i, '').trim();

  // Real titles start with a capital or digit; "this", "following", "fer" are sentence fragments
  if (/^[a-z]/.test(cleaned)) return GENERIC_TITLE;

  const lower = cleaned.toLowerCase();
  for (const phrase of INVALID_TITLE_PHRASES) {
    if (lower.includes(phrase)) {
      return 'Position Applied';
    }
  }

  if (
    cleaned.length < 2 ||
    cleaned.length > 70 ||
    /^(?:the|a|an|position|role|job|opportunity|candidate|application|openings|update)$/i.test(cleaned) ||
    (companyName && lower === companyName.toLowerCase())
  ) {
    return 'Position Applied';
  }

  return cleaned;
}

// ── Google Forms receipts ("Send me a copy of my responses") ──
const GOOGLE_FORMS_SENDER = /forms-receipts-noreply@google\.com/i;
const FORM_JOB_WORDS = /\b(hiring|recruit\w*|internships?|interns?|jobs?|careers?|campus|placements?|off-campus|vacanc\w*|openings?|graduates?|freshers?|prescreening)\b/i;
const FORM_NOT_JOB_WORDS = /\b(training|workshop|webinar|feedback|scholarship|course|bootcamp|hackathon|event|whatsapp|seminar|quiz|survey|selection)\b/i;
// Words that end the company part of a form title ("Deloitte - Campus Hiring", "TCS 2027 batch hiring")
const FORM_TITLE_STOP = /^(?:x|only|regular|campus|off-campus|intern|interns|internship|hiring|graduate|batch|recruitment|drive|job|jobs|careers?|for|registration|application|freshers?|\d{4})$/i;

/** Company and role from a job-application Google Form receipt; null for trainings, workshops and other forms. */
export function googleFormApplication(subject: string, bodyText = ''): { companyName: string; jobTitle: string } | null {
  // Newer: "Thanks for filling out this form: <title>"; older: subject is the title, body says "Thanks for filling in <title>"
  const fromSubject = subject.match(/^thanks for filling (?:out|in) (?:this form:)?\s*(.+)$/i)?.[1];
  const fromBody = bodyText.match(/thanks for filling (?:out|in) (?:this form:)?\s*(.+?)(?:\s+here's what was received|\s+you're receiving|\n|$)/i)?.[1];
  const title = (fromSubject || fromBody || subject)
    .replace(/[^\p{L}\p{N}\s&.,'()\/|:–-]/gu, ' ') // emojis and symbols
    .replace(/\s+/g, ' ')
    .trim();
  if (!FORM_JOB_WORDS.test(title) || FORM_NOT_JOB_WORDS.test(title)) return null;

  const words = title.split(' ');
  const companyWords: string[] = [];
  for (const w of words) {
    if (/^[-–|:]$/.test(w) || FORM_TITLE_STOP.test(w)) break;
    companyWords.push(w.replace(/[-–|:,]+$/, ''));
    if (/[-–|:,]$/.test(w)) break;
  }
  // Not cleanCompanyName: the title is already cut at the company, and that would drop words like "Global"
  const companyName = companyWords.join(' ').trim();
  if (companyName.length < 2 || INVALID_COMPANIES.has(companyName.toLowerCase())) return null;
  const rest = title.slice(title.indexOf(companyWords[companyWords.length - 1]) + companyWords[companyWords.length - 1].length)
    .replace(/^[\s\-–|:,]+/, '')
    .replace(/^(?:only|x\s+\S+)\s+/i, '') // "Insight Global only Intern…", "IncuBrix x SASTRA 2027…"
    .trim();
  return { companyName, jobTitle: rest ? rest.slice(0, 80) : GENERIC_TITLE };
}

// ── Main parse function ────────────────────────────────────────
export function parseEmail(msg: RawGmailMessage): ParsedApplication | null {
  const bodyText = msg.bodyText || stripHtml(msg.bodyHtml || '');

  if (GOOGLE_FORMS_SENDER.test(msg.sender)) {
    const form = googleFormApplication(msg.subject, bodyText);
    if (!form) return null;
    return {
      ...form,
      status: 'applied',
      eventType: 'acknowledged',
      appliedAt: msg.receivedAt,
      rawEmailId: msg.id,
      subject: msg.subject,
    };
  }

  // Filter out OTP, verification codes, and job alert emails
  if (isNonApplicationEmail(msg.subject, msg.sender)) {
    return null;
  }

  // Must be job application related
  if (!isJobApplicationRelated(msg.subject, bodyText, msg.sender)) {
    return null;
  }

  const fullText = `${msg.subject}\n${bodyText}`;
  const portalInfo = extractPortalInfo(fullText);
  const { eventType, statusHint } = classifyEmail(msg.subject, bodyText);

  // Requisition ID
  const requisitionId = extractFirstMatch(fullText, REQUISITION_ID_PATTERNS);

  // ── Company Name Prioritization ──
  let companyName = '';

  // 1. Sender extraction (most accurate for Workday & corporate emails!)
  companyName = extractCompanyFromSender(msg.sender, fullText) || '';

  // 2. Check subject patterns (e.g. "Thank you for applying to Silicon Labs")
  if (!companyName || INVALID_COMPANIES.has(companyName.toLowerCase())) {
    const fromSubject = extractFirstMatch(msg.subject, COMPANY_EXTRACTION_PATTERNS);
    if (fromSubject) companyName = cleanCompanyName(fromSubject);
  }

  // 3. Check portal tenant / slug
  if ((!companyName || INVALID_COMPANIES.has(companyName.toLowerCase())) && portalInfo?.tenant) {
    companyName = formatTenantName(portalInfo.tenant);
  }

  // 4. Check body patterns
  if (!companyName || INVALID_COMPANIES.has(companyName.toLowerCase())) {
    const fromBody = extractFirstMatch(bodyText, COMPANY_EXTRACTION_PATTERNS);
    if (fromBody) companyName = cleanCompanyName(fromBody);
  }

  // Fallback
  if (!companyName || companyName.length < 2 || INVALID_COMPANIES.has(companyName.toLowerCase())) {
    companyName = 'Unknown Company';
  }

  // ── Job Title Prioritization ──
  let rawJobTitle =
    extractFirstMatch(msg.subject, [
      /update on your application for\s+([A-Za-z0-9\s\-_/&,]+?)(?:\s+at|\s*\(|\.|\s*$)/i,
      /application for (?:the\s+)?([A-Za-z0-9\s\-_/&,]+?)\s+(?:position|role|opening)/i,
      /application (?:received|submitted)\s+for\s+(?:[A-Z0-9\-_]+\s+)?([A-Za-z0-9\s\-_/&,]+?)(?:\s*\(|\s*$)/i,
      /job application to [^:]+:\s*([A-Za-z0-9\s\-_/&,]+)/i,
      /job application to [^-–]+[-–]\s*([A-Za-z0-9\s\-_/&,]+)/i,
      /job application update:\s*(?:[A-Z0-9\-_]+\s+)?([A-Za-z0-9\s\-_/&,]+?)(?:\s*\(|\s*$)/i,
      /thanks for applying to (?:the\s+)?([A-Za-z0-9\s\-_/&,]+?)(?:\s*[-–]\s*[A-Z0-9\-_]+)?\s+at\s+/i,
      /application status update for\s+([A-Za-z0-9\s\-_/&,]+?)(?:[-–]|\(|$)/i,
      /thank you for applying to\s+([A-Za-z0-9\s\-_/&,]+?)(?:\s+(?:at|with|-|–)\s+[A-Z]|\s*\(|\s*$)/i,
      /interview (?:for|regarding)\s+(?:the\s+)?([A-Za-z0-9\s\-_/&,]+?)(?:\s+position|\s+role|\s+at|\s*$)/i,
    ]) ||
    extractFirstMatch(msg.subject, JOB_TITLE_PATTERNS) ||
    extractFirstMatch(bodyText, JOB_TITLE_PATTERNS) ||
    'Position Applied';

  const jobTitle = cleanJobTitle(rawJobTitle, companyName);

  // Format portal tenant display
  let portalTenant = portalInfo?.tenant;
  if (portalInfo) {
    if (portalInfo.platform === 'Workday') {
      portalTenant = portalInfo.tenant;
    } else {
      portalTenant = `${portalInfo.platform}${portalInfo.tenant ? ` (${portalInfo.tenant})` : ''}`;
    }
  }

  return {
    companyName,
    jobTitle,
    requisitionId,
    // Links often exist only in the HTML part (plain-text copies drop the hrefs)
    portalUrl: candidatePortalUrl(`${fullText}
${msg.bodyHtml || ''}`) || portalInfo?.url,
    portalTenant,
    status: statusHint || 'applied',
    statusHint,
    eventType,
    appliedAt: msg.receivedAt,
    rawEmailId: msg.id,
    subject: msg.subject,
  };
}

// ── Upsert application + timeline event ───────────────────────
export interface UpsertResult {
  applicationId: string;
  isNew: boolean;
  statusChanged: boolean;
  previousStatus?: string;
}

const GENERIC_TITLE = 'Position Applied';
const FINAL_STATUSES = ['rejected', 'position_filled', 'withdrawn'];

export type ResponseType = 'accepted' | 'moved_forward' | 'interview' | 'rejected';
const RESPONSE_OF_EVENT: Record<string, ResponseType> = {
  offer: 'accepted',
  interview: 'interview',
  assessment: 'moved_forward',
  rejected: 'rejected',
  position_filled: 'rejected',
};

export function responseOf(p: Pick<ParsedApplication, 'eventType' | 'statusHint'>): ResponseType | undefined {
  if (RESPONSE_OF_EVENT[p.eventType]) return RESPONSE_OF_EVENT[p.eventType];
  if (p.eventType === 'status_change' && (p.statusHint === 'under_review' || p.statusHint === 'screening')) return 'moved_forward';
  return undefined;
}
const ACK_MERGE_WINDOW_MS = 7 * 24 * 3600 * 1000;
const REAPPLY_AFTER_MS = 30 * 24 * 3600 * 1000;

// Exact (case-insensitive) company match. A new acknowledgement is a new application
// unless it is a duplicate confirmation of one from the last 7 days; any other email
// (rejection, interview, ...) updates the company's most recently active open application.
async function findMatchingApplication(userId: string, parsed: ParsedApplication): Promise<Record<string, any> | undefined> {
  const apps = await dbAll<Record<string, any>>(
    `SELECT * FROM applications WHERE user_id = ? AND lower(company_name) = lower(?) ORDER BY last_activity_at DESC`,
    [userId, parsed.companyName],
  );
  if (apps.length === 0) return undefined;

  if (parsed.requisitionId) {
    const byReq = apps.find((a) => a.requisition_id === parsed.requisitionId);
    if (byReq) return byReq;
  }

  const hasTitle = parsed.jobTitle !== GENERIC_TITLE;
  if (hasTitle) {
    const isAck = parsed.eventType === 'acknowledged';
    const t = Date.parse(parsed.appliedAt);
    // A fresh acknowledgement for the same title >30 days later, or after a rejection, is a re-application
    const byTitle = apps.find(
      (a) =>
        String(a.job_title).toLowerCase() === parsed.jobTitle.toLowerCase() &&
        (!isAck || (!FINAL_STATUSES.includes(a.status) && Math.abs(Date.parse(a.applied_at) - t) <= REAPPLY_AFTER_MS)),
    );
    if (byTitle) return byTitle;
  }

  if (parsed.eventType === 'acknowledged') {
    const t = Date.parse(parsed.appliedAt);
    return apps.find(
      (a) =>
        Math.abs(Date.parse(a.applied_at) - t) <= ACK_MERGE_WINDOW_MS &&
        (!hasTitle || a.job_title === GENERIC_TITLE) &&
        !(parsed.requisitionId && a.requisition_id && a.requisition_id !== parsed.requisitionId),
    );
  }

  return apps.find((a) => !FINAL_STATUSES.includes(a.status)) || apps[0];
}

// Application IDs below always come from findMatchingApplication (already scoped to userId) or are new.
export async function upsertApplication(
  userId: string,
  parsed: ParsedApplication,
  emailMessageId: string,
): Promise<UpsertResult> {
  const now = new Date().toISOString();

  const existing = await findMatchingApplication(userId, parsed);

  let applicationId: string;
  let isNew = false;
  let statusChanged = false;
  let previousStatus: string | undefined;

  if (!existing) {
    applicationId = generateId();
    isNew = true;

    await dbRun(
      `INSERT INTO applications
        (id, user_id, company_name, job_title, requisition_id, portal_url, portal_tenant,
         status, applied_at, last_activity_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationId,
        userId,
        parsed.companyName,
        parsed.jobTitle,
        parsed.requisitionId || null,
        parsed.portalUrl || null,
        parsed.portalTenant || null,
        parsed.status,
        parsed.appliedAt,
        parsed.appliedAt,
        now,
        now,
      ],
    );
  } else {
    applicationId = existing.id;
    previousStatus = existing.status;

    // If existing had generic title and we now have a specific title, upgrade it
    if (existing.job_title === GENERIC_TITLE && parsed.jobTitle !== GENERIC_TITLE) {
      await dbRun(`UPDATE applications SET job_title = ? WHERE id = ?`, [parsed.jobTitle, applicationId]);
    }

    if (parsed.statusHint && parsed.status !== existing.status && canTransitionStatus(existing.status, parsed.status)) {
      statusChanged = true;
      await dbRun(
        `UPDATE applications SET status = ?, last_activity_at = GREATEST(last_activity_at, ?), updated_at = ? WHERE id = ?`,
        [parsed.status, parsed.appliedAt, now, applicationId],
      );
    } else {
      await dbRun(
        `UPDATE applications SET last_activity_at = GREATEST(last_activity_at, ?), updated_at = ? WHERE id = ?`,
        [parsed.appliedAt, now, applicationId],
      );
    }

    const isCandidateHome = (u?: string) => !!u && /\/userHome$|\/my-applications\//.test(u);
    if (parsed.portalUrl && (!existing.portal_url || (isCandidateHome(parsed.portalUrl) && !isCandidateHome(existing.portal_url)))) {
      await dbRun(`UPDATE applications SET portal_url = ?, portal_tenant = ? WHERE id = ?`, [parsed.portalUrl, parsed.portalTenant || null, applicationId]);
    }

    if (parsed.requisitionId && !existing.requisition_id) {
      await dbRun(`UPDATE applications SET requisition_id = ? WHERE id = ?`, [parsed.requisitionId, applicationId]);
    }
  }

  // Company reply (acknowledgements are automated, so they don't count)
  const response = responseOf(parsed);
  if (response) {
    await dbRun(
      `UPDATE applications SET
         first_response_at = CASE WHEN first_response_at IS NULL OR ? < first_response_at THEN ? ELSE first_response_at END,
         last_response_type = CASE WHEN last_response_at IS NULL OR ? >= last_response_at THEN ? ELSE last_response_type END,
         last_response_at = CASE WHEN last_response_at IS NULL OR ? >= last_response_at THEN ? ELSE last_response_at END
       WHERE id = ?`,
      [parsed.appliedAt, parsed.appliedAt, parsed.appliedAt, response, parsed.appliedAt, parsed.appliedAt, applicationId],
    );
  }

  // Add timeline event (once per email, so reprocessing never duplicates it)
  const metadata = JSON.stringify({ raw_email_id: emailMessageId, status_to: parsed.status });
  const alreadyLogged = await dbGet(
    `SELECT id FROM timeline_events WHERE application_id IN (SELECT id FROM applications WHERE user_id = ?)
       AND source = 'email' AND metadata LIKE ? LIMIT 1`,
    [userId, `%"raw_email_id":"${emailMessageId}"%`],
  );
  if (alreadyLogged) return { applicationId, isNew, statusChanged, previousStatus };

  await dbRun(
    `INSERT INTO timeline_events
      (id, application_id, event_type, source, title, description, metadata, occurred_at, created_at)
     VALUES (?, ?, ?, 'email', ?, ?, ?, ?, ?)`,
    [
      generateId(),
      applicationId,
      parsed.eventType,
      `${parsed.eventType.replace(/_/g, ' ').toUpperCase()}: ${parsed.jobTitle} at ${parsed.companyName}`,
      parsed.subject || `Email received regarding application for ${parsed.jobTitle}`,
      metadata,
      parsed.appliedAt,
      now,
    ],
  );

  return { applicationId, isNew, statusChanged, previousStatus };
}

// ── Reparse one user's stored emails ───────────────────────────
export async function reparseStoredEmails(userId: string, onlyUnparsed = false): Promise<{ total: number; parsed: number; appsCreated: number; appsUpdated: number }> {
  const emails = await dbAll<any>(
    `SELECT * FROM email_messages WHERE user_id = ? ${onlyUnparsed ? 'AND parsed = 0' : ''} ORDER BY received_at ASC`,
    [userId],
  );
  let parsedCount = 0;
  let appsCreated = 0;
  let appsUpdated = 0;

  for (const email of emails) {
    const rawMsg: RawGmailMessage = {
      id: email.gmail_message_id,
      threadId: '',
      subject: email.subject,
      sender: email.sender,
      receivedAt: email.received_at,
      bodyText: email.body_text || '',
      bodyHtml: '',
      labelIds: [],
    };

    const parsed = parseEmail(rawMsg);
    if (parsed) {
      parsedCount++;
      const result = await upsertApplication(userId, parsed, email.id);
      if (result.isNew) appsCreated++;
      else appsUpdated++;

      await dbRun('UPDATE email_messages SET parsed = 1, application_id = ? WHERE id = ? AND user_id = ?', [result.applicationId, email.id, userId]);
    } else {
      // parsed = 1 means "processed"; non-application emails are not retried every sync
      await dbRun('UPDATE email_messages SET parsed = 1 WHERE id = ? AND user_id = ?', [email.id, userId]);
    }
  }

  // Many emails carry no portal link; reuse one from another email of the same company
  await dbRun(
    `UPDATE applications SET portal_url = (
       SELECT b.portal_url FROM applications b
       WHERE b.user_id = applications.user_id AND b.company_name = applications.company_name AND b.portal_url LIKE '%/userHome' LIMIT 1)
     WHERE user_id = ? AND (portal_url IS NULL OR portal_url NOT LIKE '%/userHome')
       AND EXISTS (SELECT 1 FROM applications b WHERE b.user_id = applications.user_id AND b.company_name = applications.company_name AND b.portal_url LIKE '%/userHome')`,
    [userId],
  );

  return { total: emails.length, parsed: parsedCount, appsCreated, appsUpdated };
}

// ── Rebuild one user's email-derived applications from stored emails ──
// Keeps applications that have a manual timeline event (added or edited by hand).
export async function rebuildFromEmails(userId: string) {
  await dbRun(`DELETE FROM timeline_events WHERE source = 'email' AND application_id IN (SELECT id FROM applications WHERE user_id = ?)`, [userId]);
  await dbRun(
    `DELETE FROM applications WHERE user_id = ? AND id NOT IN
       (SELECT application_id FROM timeline_events WHERE source = 'manual')`,
    [userId],
  );
  await dbRun(`UPDATE applications SET first_response_at = NULL, last_response_type = NULL, last_response_at = NULL WHERE user_id = ?`, [userId]);
  await dbRun(`UPDATE email_messages SET parsed = 0, application_id = NULL WHERE user_id = ?`, [userId]);
  return reparseStoredEmails(userId);
}
