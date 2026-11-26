// ============================================================
// Application Patterns & ATS Definitions
// Supports Workday, Greenhouse, Lever, SmartRecruiters, Ashby,
// iCIMS, Jobvite, Taleo, BambooHR, Workable, LinkedIn, Direct & all companies.
// ============================================================

// ── Known ATS Sender Patterns ─────────────────────────────────
export const WORKDAY_SENDER_PATTERNS: RegExp[] = [
  /workday\.com/i,
  /myworkdayjobs\.com/i,
  /myworkday\.com/i,
  /wd\d+\.myworkdayjobs\.com/i,
  /noreply@.*workday/i,
  /recruiting@.*workday/i,
  /careers@.*workday/i,
  /no-reply@.*wd\d/i,
  /pgworkdaysystem/i,
];

export const ATS_SENDER_PATTERNS: RegExp[] = [
  ...WORKDAY_SENDER_PATTERNS,
  /greenhouse\.io/i,
  /greenhouse-mail\.io/i,
  /boards\.greenhouse\.io/i,
  /gh\.io/i,
  /lever\.co/i,
  /jobs\.lever\.co/i,
  /smartrecruiters\.com/i,
  /ashbyhq\.com/i,
  /jobs\.ashbyhq\.com/i,
  /icims\.com/i,
  /jobvite\.com/i,
  /taleo\.net/i,
  /oraclecloud\.com/i,
  /bamboohr\.com/i,
  /breezy\.hr/i,
  /workable\.com/i,
  /workablemail\.com/i,
  /successfactors\.com/i,
  /successfactors\.eu/i,
  /brassring\.com/i,
  /ripplematch\.com/i,
  /joinhandshake\.com/i,
  /joinwayup\.com/i,
  /hirevue\.com/i,
  /codility\.com/i,
  /hackerrank\.com/i,
  /jobs-noreply@linkedin\.com/i,
  /careers-noreply@linkedin\.com/i,
  /indeedmail\.com/i,
  /hirepro\.in/i,
  /hackerrankforwork\.com/i,
  /zohorecruit\./i,
];

// ── Subject Patterns → Event Type & Status Hint ──────────────
export const SUBJECT_PATTERNS: Array<{ pattern: RegExp; eventType: string; statusHint?: string }> = [
  // Application received / confirmation
  { pattern: /thank.?you.{0,25}(apply|applying|application|interest)/i,     eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /thanks.{0,25}(apply|applying|application|interest)/i,        eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /application.{0,20}(received|submitted|confirmation|success)/i, eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /we.{0,15}received.{0,20}application/i,                       eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /your application.{0,25}(confirm|received|submitted|sent)/i,  eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /applied\s+(?:to|for)\s+/i,                                  eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /job application.{0,20}(received|submitted|confirmation)/i,  eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /confirmation of (?:your )?application/i,                    eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /receipt of (?:your )?application/i,                         eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /application acknowledgment/i,                               eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /successfully submitted application/i,                       eventType: 'acknowledged',    statusHint: 'applied' },
  { pattern: /confirming your .{0,20}application/i,                       eventType: 'acknowledged',    statusHint: 'applied' },

  // Under review / Screening
  { pattern: /application.{0,20}under.{0,10}review/i,                     eventType: 'status_change',   statusHint: 'under_review' },
  { pattern: /reviewing.{0,20}application/i,                              eventType: 'status_change',   statusHint: 'under_review' },
  { pattern: /next steps.{0,20}(application|role|position)/i,             eventType: 'status_change',   statusHint: 'under_review' },
  { pattern: /recruiter.{0,15}(phone|screening|call)/i,                   eventType: 'interview',       statusHint: 'screening' },
  { pattern: /progress update/i,                                          eventType: 'status_change',   statusHint: 'under_review' },

  // Interview
  { pattern: /interview.{0,25}(invite|invitation|schedule|request|confirm)/i, eventType: 'interview',  statusHint: 'interview' },
  { pattern: /invitation to (?:an? )?interview/i,                         eventType: 'interview',       statusHint: 'interview' },
  { pattern: /(?:schedule|book).{0,20}interview/i,                        eventType: 'interview',       statusHint: 'interview' },
  { pattern: /time to schedule your interview/i,                          eventType: 'interview',       statusHint: 'interview' },
  { pattern: /looking forward to your interview/i,                        eventType: 'interview',       statusHint: 'interview' },
  { pattern: /phone.{0,15}(screen|interview|conversation)/i,              eventType: 'interview',       statusHint: 'interview' },
  { pattern: /video.{0,15}(interview|call|screen)/i,                      eventType: 'interview',       statusHint: 'interview' },
  { pattern: /meet.{0,15}with.{0,15}(team|recruiter|manager)/i,           eventType: 'interview',       statusHint: 'interview' },
  { pattern: /technical.{0,15}(interview|discussion|call)/i,              eventType: 'interview',       statusHint: 'interview' },
  { pattern: /onsite.{0,15}(interview|visit)/i,                           eventType: 'interview',       statusHint: 'interview' },
  { pattern: /final round.{0,15}interview/i,                              eventType: 'interview',       statusHint: 'interview' },
  { pattern: /shortlisted for (?:the )?(?:[\w,]+ ){0,8}?(?:role|position|interview|next round)/i, eventType: 'interview', statusHint: 'interview' },
  { pattern: /interview (?:is |has been )?(?:complete|completed|submitted)/i, eventType: 'interview',    statusHint: 'interview' },
  { pattern: /complete your (?:ai |video |online )?interview/i,           eventType: 'interview',       statusHint: 'interview' },

  // Assessment
  { pattern: /assessment.{0,20}(invite|invitation|test|link|request)/i,    eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /online assessment/i,                                        eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /shl assessment/i,                                           eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /coding.{0,15}(test|challenge|assessment)/i,                 eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /technical.{0,15}(test|assessment|challenge)/i,              eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /hackerrank.{0,60}(?:test|invitation|challenge)/i,         eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /codility/i,                                                  eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /hirevue/i,                                                   eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /pymetrics/i,                                                 eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /take.?home.{0,15}(test|assignment|project|challenge)/i,     eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /assessment completed/i,                                     eventType: 'assessment',      statusHint: 'assessment' },
  { pattern: /result of your assessment/i,                                eventType: 'assessment',      statusHint: 'assessment' },

  // Offer
  { pattern: /offer.{0,25}(letter|extended|congratul|attached)/i,         eventType: 'offer',           statusHint: 'offer' },
  { pattern: /congratulations.{0,30}offer/i,                               eventType: 'offer',           statusHint: 'offer' },
  { pattern: /pleased.{0,20}offer/i,                                       eventType: 'offer',           statusHint: 'offer' },
  { pattern: /job.{0,15}offer/i,                                           eventType: 'offer',           statusHint: 'offer' },
  { pattern: /employment offer/i,                                         eventType: 'offer',           statusHint: 'offer' },

  // Rejection
  { pattern: /not.{0,20}moving.{0,15}forward/i,                            eventType: 'rejected',        statusHint: 'rejected' },
  { pattern: /decided.{0,20}not.{0,15}to.{0,10}proceed/i,                  eventType: 'rejected',        statusHint: 'rejected' },
  { pattern: /chosen.{0,20}(other|another).{0,15}candidate/i,              eventType: 'rejected',        statusHint: 'rejected' },
  { pattern: /decided to (?:pursue|move forward with) (?:other|another)/i, eventType: 'rejected',        statusHint: 'rejected' },
  { pattern: /unfortunately.{0,30}(application|position|not selected|cannot)/i, eventType: 'rejected', statusHint: 'rejected' },
  { pattern: /regret.{0,25}inform/i,                                       eventType: 'rejected',        statusHint: 'rejected' },
  { pattern: /application.{0,20}(not selected|unsuccessful)/i,             eventType: 'rejected',        statusHint: 'rejected' },
  { pattern: /position.{0,25}(filled|has been filled|closed|cancelled)/i,  eventType: 'position_filled', statusHint: 'position_filled' },
  { pattern: /will not be (?:moving|proceeding)/i,                        eventType: 'rejected',        statusHint: 'rejected' },

  // Document requests & tasks
  { pattern: /document.{0,15}required/i,                                   eventType: 'document_request', statusHint: undefined },
  { pattern: /pending tasks/i,                                             eventType: 'document_request', statusHint: undefined },
  { pattern: /action required/i,                                           eventType: 'document_request', statusHint: undefined },
  { pattern: /please.{0,15}(upload|provide|submit).{0,20}(document|form|resume|transcript)/i, eventType: 'document_request', statusHint: undefined },
  { pattern: /background.{0,15}check/i,                                    eventType: 'document_request', statusHint: undefined },
  { pattern: /reference.{0,15}(check|request)/i,                           eventType: 'document_request', statusHint: undefined },

  // Generic status update
  { pattern: /application update/i,                                        eventType: 'status_change',   statusHint: undefined },
  { pattern: /update.{0,20}(regarding|on|about).{0,20}application/i,      eventType: 'status_change',   statusHint: undefined },
  { pattern: /application.{0,20}status/i,                                  eventType: 'status_change',   statusHint: undefined },
  { pattern: /regarding your application/i,                               eventType: 'status_change',   statusHint: undefined },
];

// ── Body-level outcome phrases ────────────────────────────────
// Rejections often arrive with friendly subjects ("Thank you for your interest"),
// so the body wins. Phrases are specific to avoid acks ("we give careful consideration...").
export const POSITION_FILLED_BODY_PATTERN =
  /(?:position|role|requisition|opening) has (?:now |since )?been (?:filled|closed|canceled|cancelled)|no longer recruiting for this (?:role|position)/i;
export const REJECTION_BODY_PATTERN = new RegExp(
  [
    /did not select you/,
    /(?:decided|chosen|elected) not to (?:move forward|proceed|progress|pursue)/,
    /(?:decided|chosen|elected) to (?:move forward|proceed|go) with (?:other|another) candidate/,
    /(?:moving forward|progressed|proceeding) with (?:other|another) candidates?/,
    /pursue other candidates/,
    /(?:will not|won't|are not|not be|no longer be) (?:be )?(?:moving forward|proceeding|progressing|advancing|pursuing)(?: with| in)? your (?:application|candidacy)/,
    /regret to inform/,
    /not (?:been )?selected (?:for|to)/,
    /not able to offer you/,
  ].map((r) => r.source).join('|'),
  'i',
);

// Interview invites/completions whose subject may only say "Thanks for applying" / "Thanks for taking"
export const INTERVIEW_BODY_PATTERN = new RegExp(
  [
    /your interview (?:is complete|has been submitted|has been (?:successfully )?scheduled)/,
    /thank you for completing your interview/,
    /finishing the ai interview/,
    /next step in your interview process/,
    /next step (?:of|in) (?:the|your) application process is to complete your (?:ai )?interview/,
    /(?:like|pleased|happy) to invite you (?:to|for) an? (?:\w+ )?interview/,
    /shortlisted for (?:the )?(?:next round|an? interview|interview)/,
  ].map((r) => r.source).join('|'),
  'i',
);

/** Normalizes curly quotes and drops conditional "if you don't hear from us..." sentences. */
export function outcomeText(body: string): string {
  return body
    .slice(0, 6000)
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/if you (?:do not|don't) hear[^.]*\./gi, '');
}

// ── Portal URL Patterns ───────────────────────────────────────
export const PORTAL_URL_PATTERNS = [
  {
    platform: 'Workday',
    regex: /https?:\/\/([a-z0-9\-]+\.wd\d+\.myworkdayjobs\.com|[a-z0-9\-]+\.myworkdayjobs\.com)[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'Greenhouse',
    regex: /https?:\/\/boards(?:\.eu)?\.greenhouse\.io\/([a-z0-9\-_]+)[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'Lever',
    regex: /https?:\/\/jobs\.lever\.co\/([a-z0-9\-_]+)[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'SmartRecruiters',
    regex: /https?:\/\/jobs\.smartrecruiters\.com\/([a-z0-9\-_]+)[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'Ashby',
    regex: /https?:\/\/jobs\.ashbyhq\.com\/([a-z0-9\-_]+)[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'iCIMS',
    regex: /https?:\/\/([a-z0-9\-]+)\.icims\.com[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'Jobvite',
    regex: /https?:\/\/jobs\.jobvite\.com\/([a-z0-9\-_]+)[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'Taleo',
    regex: /https?:\/\/([a-z0-9\-]+)\.taleo\.net[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'BambooHR',
    regex: /https?:\/\/([a-z0-9\-]+)\.bamboohr\.com[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'Workable',
    regex: /https?:\/\/apply\.workable\.com\/([a-z0-9\-_]+)[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
  {
    platform: 'Breezy',
    regex: /https?:\/\/([a-z0-9\-]+)\.breezy\.hr[^\s"'>]*/i,
    extractTenant: (m: RegExpMatchArray) => m[1],
  },
];

// Backwards-compatible regex for Workday
export const PORTAL_URL_PATTERN = /https?:\/\/([a-z0-9\-]+\.wd\d+\.myworkdayjobs\.com|[a-z0-9\-]+\.myworkdayjobs\.com)[^\s"'>]*/gi;

// ── Company Name Extraction Patterns ───────────────────────────
export const COMPANY_EXTRACTION_PATTERNS: RegExp[] = [
  /thank\s+you\s+for\s+(?:applying|your\s+application)\s+(?:to|at|with)\s+([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,35}?)(?:\s+for|\s+as|\s*[-–!:|]|\s*$)/i,
  /thanks\s+for\s+(?:applying|your\s+application)\s+(?:to|at|with)\s+([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,35}?)(?:\s+for|\s+as|\s*[-–!:|]|\s*$)/i,
  /thank\s+you\s+for\s+your\s+interest\s+in\s+([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,35}?)(?:\s*[-–!:\.|]|\s*$)/i,
  /your\s+(?:job\s+)?application\s+(?:to|at|with)\s+([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,35}?)(?:\s+for|\s*[-–!:]|\s*$)/i,
  /interview\s+with\s+([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,35}?)(?:\s+for|\s+on|\s*[-–!:]|\s*$)/i,
  /welcome\s+to\s+the\s+([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,35}?)\s+(?:team|family|candidate)/i,
  /\[([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,30})\]\s+(?:application|job|careers)/i,
  /^([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,30})\s+(?:Careers|Recruiting|Jobs|Talent)\s*[-–:]/i,
  /confirming your ([A-Z0-9][A-Za-z0-9\s&,\.\-]{1,30}) job application/i,
  /received your ([A-Z][A-Za-z0-9&.]+(?: [A-Z][A-Za-z0-9&.]+)?) [Aa]pplication/,
  /^([A-Z][A-Za-z0-9&.\s]{1,30}?)\s*\|\|/,
];

// ── Job Title Extraction Patterns ─────────────────────────────
export const JOB_TITLE_PATTERNS: RegExp[] = [
  // Patterns from subjects with high precision
  /application for (?:the\s+)?([A-Za-z0-9\s\-_/&]+?)\s+(?:position|role|opening)/i,
  /thanks for taking the (?:AI TA Screen\s*-\s*)?([A-Za-z0-9 ,]+?)(?:\s+-\s+|\s*$)/i,
  /shortlisted for the\s+([A-Za-z0-9 ,\-]+?)\s+role/i,
  /^your\s+([A-Za-z0-9 ,\-]+?)\s+application is moving forward/i,
  /\|\|\s*([A-Za-z0-9 ,\-]+?)\s*(?:\|\||$)/,
  /^([A-Za-z0-9 ,]+?)\s+-\s+[A-Za-z]+\s*\((?:Onsite|Hybrid|Remote)\)\s+at\s+/i,
  /applying to [A-Za-z0-9&.]+\s+[-–]\s+([A-Za-z0-9 ,\-]+)$/i,
  /application (?:received|submitted)\s+for\s+(?:[A-Z0-9\-_]+\s+)?([A-Za-z0-9\s\-_/&]+?)(?:\s*\(|\s*$)/i,
  /job application to [^:]+:\s*([A-Za-z0-9\s\-_/&]+)/i,
  /job application to [^-–]+[-–]\s*([A-Za-z0-9\s\-_/&]+)/i,
  /application status update for\s+([A-Za-z0-9\s\-_/&]+?)(?:[-–]|\(|$)/i,
  /job application update:\s*(?:[A-Z0-9\-_]+\s+)?([A-Za-z0-9\s\-_/&]+?)(?:\s*\(|\s*$)/i,
  /thanks for applying to (?:the\s+)?([A-Za-z0-9\s\-_/&]+?)(?:\s*[-–]\s*[A-Z0-9\-_]+)?\s+at\s+/i,
  /update on your application for\s+([A-Za-z0-9\s\-_/&]+?)\s+at\s+/i,
  /interview (?:for|regarding)\s+(?:the\s+)?([A-Za-z0-9\s\-_/&]+?)(?:\s+position|\s+role|\s+at|\s*$)/i,
  /for the\s+([A-Za-z0-9\s\-_/&]+?)\s+(?:position|role|opening)/i,

  // Body patterns
  /(?:role|job title|position):\s*([A-Za-z0-9\s,\-\/\.]{2,50})/i,
  /(?:position|role|job|opportunity)\s+(?:of|for|as)\s*(?:a\s+|an\s+)?([A-Z][A-Za-z0-9\s,\-\/\.]{2,50}?)(?:\s+at|\s+\(|\.|\n|,)/i,
];

// ── Requisition ID Extraction Patterns ─────────────────────────
export const REQUISITION_ID_PATTERNS: RegExp[] = [
  /\b(?:req(?:uisition)?|job|position|reference)\s*(?:#|id|number|no\.?)\s*:?\s*([A-Z0-9\-_]*\d[A-Z0-9\-_]*)/i,
  /\b(R-?\d{5,})\b/i,
  /\b(JR-?\d{4,})\b/i,
  /\b([A-Z]{2,5}-\d{4,})\b/,
  /\bReq\s*(\d{4,12})\b/i,
];

// ── Workday REST API path helper ──────────────────────────────
export const WORKDAY_REST_BASE = (tenant: string): string =>
  `https://${tenant}/wday/cxs/${tenant.split('.')[0]}/jobs`;

// ── Status FSM: allowed transitions ──────────────────────────
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  applied:         ['acknowledged', 'under_review', 'screening', 'interview', 'assessment', 'offer', 'position_filled', 'rejected', 'withdrawn'],
  acknowledged:    ['under_review', 'screening', 'interview', 'assessment', 'offer', 'position_filled', 'rejected', 'withdrawn'],
  under_review:    ['screening', 'interview', 'assessment', 'offer', 'position_filled', 'rejected', 'withdrawn'],
  screening:       ['interview', 'assessment', 'offer', 'position_filled', 'rejected', 'withdrawn'],
  interview:       ['interview', 'assessment', 'offer', 'position_filled', 'rejected', 'withdrawn'],
  assessment:      ['interview', 'offer', 'position_filled', 'rejected', 'withdrawn'],
  offer:           ['withdrawn'],
  position_filled: [],
  rejected:        [],
  withdrawn:       [],
};

// ── Status display labels ─────────────────────────────────────
export const STATUS_LABELS: Record<string, string> = {
  applied:         'Applied',
  acknowledged:    'Acknowledged',
  under_review:    'Under Review',
  screening:       'Screening',
  interview:       'Interview',
  assessment:      'Assessment',
  offer:           'Offer',
  position_filled: 'Position Filled',
  rejected:        'Rejected',
  withdrawn:       'Withdrawn',
};

// ── Status CSS color classes ──────────────────────────────────
export const STATUS_COLORS: Record<string, string> = {
  applied:         'status-applied',
  acknowledged:    'status-acknowledged',
  under_review:    'status-review',
  screening:       'status-review',
  interview:       'status-interview',
  assessment:      'status-assessment',
  offer:           'status-offer',
  position_filled: 'status-filled',
  rejected:        'status-rejected',
  withdrawn:       'status-withdrawn',
};

// ── Platform identification & extraction helpers ──────────────
export interface ExtractedPortal {
  url: string;
  tenant: string;
  platform: string;
}

/**
 * Candidate-portal page that lists the user's applications and their status.
 * Workday: any https://{tenant}.wdN.myworkdayjobs.com/{locale?}/{site}/... link -> https://{host}/{site}/userHome
 * SmartRecruiters: https://jobs.smartrecruiters.com/my-applications/... as-is.
 */
export function candidatePortalUrl(text: string): string | undefined {
  const sr = text.match(/https:\/\/jobs\.smartrecruiters\.com\/my-applications\/[^\s"'<>]+/i);
  if (sr) return sr[0];
  const re = /https?:\/\/([a-z0-9-]+\.wd\d+\.myworkdayjobs\.com)\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/g;
  for (const m of text.matchAll(re)) {
    if (!/^(?:wday|login|userHome|job|details)$/i.test(m[2])) return `https://${m[1].toLowerCase()}/${m[2]}/userHome`;
  }
  return undefined;
}

export function extractPortalInfo(text: string): ExtractedPortal | undefined {
  for (const item of PORTAL_URL_PATTERNS) {
    const match = text.match(item.regex);
    if (match) {
      return {
        url: match[0],
        tenant: item.extractTenant(match),
        platform: item.platform,
      };
    }
  }
  return undefined;
}

const KNOWN_TENANTS: Record<string, string> = {
  walmart: 'Walmart',
  nvidia: 'NVIDIA',
  geaerospace: 'GE Aerospace',
  gehc: 'GE HealthCare',
  mastercard: 'Mastercard',
  philips: 'Philips',
  accenture: 'Accenture',
  dentsuaegis: 'Dentsu',
  pwc: 'PwC',
  magna: 'Magna International',
  db: 'Deutsche Bank',
  lseg: 'LSEG',
  statestreet: 'State Street',
  fluenceenergy: 'Fluence Energy',
  qualcomm: 'Qualcomm',
  salesforce: 'Salesforce',
  silabs: 'Silicon Labs',
  revvity: 'Revvity',
  baxter: 'Baxter',
  cat: 'Caterpillar Inc.',
  micron: 'Micron',
  haier: 'Haier',
  unisys: 'Unisys',
  hpe: 'Hewlett Packard Enterprise',
  pitneybowes: 'Pitney Bowes',
  iqvia: 'IQVIA',
  geappliances: 'GE Appliances',
  freighttiger: 'Freight Tiger',
  advicemedia: 'Advice Media',
  pg: 'Procter & Gamble (P&G)',
  shl: 'SHL',
  hackerrank: 'HackerRank',
  hackerrankcareers: 'HackerRank',
  micro1: 'micro1',
  hp: 'HP',
  ea: 'Electronic Arts',
  pgworkdaysystem: 'Procter & Gamble (P&G)',
  astreya: 'Astreya',
};

export function knownTenant(tenant: string): string | undefined {
  return KNOWN_TENANTS[tenant.split('.')[0].toLowerCase()];
}

export function formatTenantName(tenant: string): string {
  const raw = tenant.split('.')[0].toLowerCase();
  if (KNOWN_TENANTS[raw]) return KNOWN_TENANTS[raw];

  const spaced = raw.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
  return spaced.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

export function isWorkdaySender(sender: string): boolean {
  return WORKDAY_SENDER_PATTERNS.some((p) => p.test(sender));
}

export function isAtsSender(sender: string): boolean {
  return ATS_SENDER_PATTERNS.some((p) => p.test(sender));
}

export function isWorkdayRelated(subject: string, body: string): boolean {
  const text = `${subject} ${body}`;
  PORTAL_URL_PATTERN.lastIndex = 0;
  return (
    PORTAL_URL_PATTERN.test(text) ||
    /myworkdayjobs|myworkday|workday\.com/i.test(text)
  );
}

export function isJobApplicationRelated(subject: string, bodyText: string, sender: string): boolean {
  // Filter out OTPs, password resets, verification codes
  if (
    /verification code|one-time passcode|security code|verify your email|reset your password|password reset|login verification|account verification|\botp\b/i.test(subject) ||
    /job alert|jobs matching your preferences|new jobs posted|recommended jobs|jobs you may be interested in|daily job alert/i.test(subject) ||
    /submit your projects by|new jobs in|practice could lead to/i.test(subject) ||
    /we have new opportunities you may be interested in/i.test(subject)
  ) {
    return false;
  }

  // Known ATS sender
  if (isAtsSender(sender)) return true;

  // Known portal URL in email
  if (extractPortalInfo(`${subject} ${bodyText}`)) return true;

  // Matching subject patterns
  for (const { pattern } of SUBJECT_PATTERNS) {
    if (pattern.test(subject)) return true;
  }

  // Strong body indicators
  if (
    /thank you for (?:your )?applying|thank you for your application|we have received your application|we received your application/i.test(bodyText) ||
    /your application has been received|confirmation of your application/i.test(bodyText) ||
    /regarding your application|status of your application|update on your application/i.test(bodyText) ||
    REJECTION_BODY_PATTERN.test(outcomeText(bodyText)) ||
    POSITION_FILLED_BODY_PATTERN.test(outcomeText(bodyText)) ||
    INTERVIEW_BODY_PATTERN.test(outcomeText(bodyText)) ||
    /\byour (?:[A-Za-z&]+ )?application (?:with|to|at|for)\b|\byour [A-Za-z&]+ application\b/i.test(subject)
  ) {
    return true;
  }

  return false;
}

export function canTransitionStatus(from: string, to: string): boolean {
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}
