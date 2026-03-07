import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search, FileText, X, Folder, FolderOpen, Plus, Play, Pause,
  Headphones, AlignLeft, ChevronRight, ChevronDown, CircleCheck,
  Eye, Hash, Clock, List, Bold, Italic, Underline, Highlighter,
  Move, BookOpen, Volume2, VolumeX, Maximize2, Minimize2,
  SkipForward, SkipBack, ArrowLeft, Video, Menu, Zap,
  GripVertical, Settings, Play as PlayIcon, FileVideo,
} from 'lucide-react';

/* ── CSS injected once ── */
const KB_STYLE = `
  .kb-cscroll::-webkit-scrollbar{width:5px;height:5px;}
  .kb-cscroll::-webkit-scrollbar-track{background:transparent;}
  .kb-cscroll::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px;}
  .kb-cscroll::-webkit-scrollbar-thumb:hover{background:#94A3B8;}
  .kb-slide-up{animation:kbSlideUp .3s cubic-bezier(.22,1,.36,1);}
  @keyframes kbSlideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  .kb-fade{animation:kbOpac .2s ease;}
  @keyframes kbOpac{from{opacity:0;}to{opacity:1;}}
  .kb-card:hover{transform:translateY(-4px);box-shadow:0 20px 50px -10px rgba(99,102,241,.18);}
  .kb-card{transition:all .22s ease;}
  .kb-range{-webkit-appearance:none;appearance:none;height:4px;border-radius:99px;outline:none;cursor:pointer;}
  .kb-range::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff;cursor:pointer;box-shadow:0 0 0 3px rgba(99,102,241,.35),0 1px 3px rgba(0,0,0,.2);}
  .kb-prose-doc h1{font-size:1.65rem;font-weight:800;color:#1e293b;margin-bottom:.75rem;line-height:1.2;}
  .kb-prose-doc h2{font-size:1.2rem;font-weight:700;color:#334155;margin:1.6rem 0 .5rem;padding-bottom:.4rem;border-bottom:2px solid #e2e8f0;}
  .kb-prose-doc h3{font-size:1rem;font-weight:700;color:#475569;margin:1.2rem 0 .4rem;}
  .kb-prose-doc p{color:#475569;line-height:1.8;margin-bottom:.9rem;font-size:.9rem;}
  .kb-prose-doc ul,.kb-prose-doc ol{padding-left:1.4rem;color:#475569;margin-bottom:.9rem;font-size:.9rem;}
  .kb-prose-doc li{margin-bottom:.35rem;line-height:1.7;}
  .kb-prose-doc blockquote{border-left:4px solid #6366f1;background:#eef2ff;padding:.6rem 1rem;margin:1rem 0;border-radius:0 8px 8px 0;color:#4338ca;font-style:italic;font-size:.875rem;}
  .kb-prose-doc table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.8rem;}
  .kb-prose-doc th{background:#f1f5f9;padding:.5rem .9rem;text-align:left;font-weight:700;color:#334155;border:1px solid #e2e8f0;}
  .kb-prose-doc td{padding:.5rem .9rem;border:1px solid #e2e8f0;color:#475569;}
  .kb-prose-doc tr:nth-child(even) td{background:#f8fafc;}
  .kb-prose-view h1{font-size:2rem;font-weight:800;color:#0f172a;margin-bottom:1rem;line-height:1.25;}
  .kb-prose-view h2{font-size:1.35rem;font-weight:700;color:#1e293b;margin:1.6rem 0 .6rem;}
  .kb-prose-view h3{font-size:1.1rem;font-weight:700;color:#334155;margin:1.2rem 0 .5rem;}
  .kb-prose-view p{color:#475569;line-height:1.85;margin-bottom:1rem;}
  .kb-prose-view ul,.kb-prose-view ol{padding-left:1.4rem;color:#475569;margin-bottom:1rem;}
  .kb-prose-view li{margin-bottom:.4rem;line-height:1.75;}
  .kb-prose-view strong{color:#1e293b;}
  .kb-prose-view blockquote{border-left:4px solid #6366f1;padding:.6rem 1rem;background:#eef2ff;border-radius:0 8px 8px 0;margin:1rem 0;color:#4338ca;font-style:italic;}
  video::-webkit-media-controls-download-button{display:none!important;}
  video::-webkit-media-controls-enclosure{overflow:hidden;}
`;

const SPEEDS = [1.0, 1.1, 1.25, 1.5, 2.0, 2.25, 2.5, 3.0];
const fmt = (s) => {
  if (isNaN(s) || s === Infinity) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
};

/* ══════════════════════════════════════════════════
   MOCK DATA
══════════════════════════════════════════════════ */
const CATS = [
  { id: 'c1',  name: 'Company Policies',     parentId: null, order: 0 },
  { id: 'c1a', name: 'HR & Benefits',        parentId: 'c1', order: 0 },
  { id: 'c1b', name: 'IT Security',          parentId: 'c1', order: 1 },
  { id: 'c2',  name: 'Sales & Marketing',    parentId: null, order: 1 },
  { id: 'c2a', name: 'Cold Calling Scripts', parentId: 'c2', order: 0 },
  { id: 'c2b', name: 'Product Knowledge',    parentId: 'c2', order: 1 },
  { id: 'c3',  name: 'Software Tutorials',   parentId: null, order: 2 },
  { id: 'c4',  name: 'Compliance & Legal',   parentId: null, order: 3 },
  { id: 'c5',  name: 'Customer Support',     parentId: null, order: 4 },
  { id: 'c5a', name: 'Escalation Matrix',    parentId: 'c5', order: 0 },
];

const DOC_HR = `<h1>Employee Onboarding Handbook 2026</h1><p><strong>Effective:</strong> Jan 1, 2026 &nbsp;·&nbsp; <strong>Version:</strong> 3.2 &nbsp;·&nbsp; <strong>Approved by:</strong> HR Director</p><h2>1. Welcome & Overview</h2><p>Welcome to <strong>NextGen Corp</strong>! This handbook provides all information you need to get started. Our mission is to deliver exceptional value through innovation and teamwork.</p><h2>2. Working Hours</h2><ul><li>Standard hours: <strong>9:00 AM – 6:00 PM</strong>, Monday–Friday</li><li>Flexible shifts available after 3-month probation</li><li>Remote work: 2 days/week for eligible roles</li><li>3 late arrivals in a month triggers an HR review</li></ul><h2>3. Leave Policy</h2><table><tr><th>Leave Type</th><th>Entitlement</th><th>Notice</th></tr><tr><td>Annual Leave</td><td>21 Days</td><td>14 Days</td></tr><tr><td>Sick Leave</td><td>10 Days (with certificate)</td><td>Same day</td></tr><tr><td>Casual Leave</td><td>6 Days</td><td>1 Day prior</td></tr><tr><td>Maternity/Paternity</td><td>As per local law</td><td>30 Days</td></tr></table><h2>4. Code of Conduct</h2><ol><li>Treat every colleague, client, and vendor with respect</li><li>Maintain confidentiality of company data at all times</li><li>Avoid conflicts of interest — report any immediately</li><li>Adhere to all data privacy regulations applicable to your role</li></ol><h2>5. Performance Reviews</h2><p>Conducted <strong>bi-annually</strong> in June and December. OKRs should be set within first 30 days of joining. Your line manager will schedule a 1:1 meeting.</p>`;
const DOC_IT = `<h1>IT Security & Password Policy 2026</h1><p><strong>Classification:</strong> Internal | <strong>Dept:</strong> IT Operations | <strong>Review:</strong> Quarterly</p><h2>1. Password Requirements</h2><ul><li>Minimum <strong>12 characters</strong></li><li>Must include uppercase, lowercase, number, and special character</li><li>Cannot reuse last <strong>10 passwords</strong></li><li>Rotation every <strong>90 days</strong></li><li>MFA is <strong>mandatory</strong> on all systems</li></ul><h2>2. Prohibited Activities</h2><ul><li>Installing unauthorised software or browser extensions</li><li>Sharing login credentials with anyone — including colleagues</li><li>Connecting unknown external storage devices (USB, HDDs)</li><li>Using company devices on unsecured public Wi-Fi without VPN</li></ul><h2>3. Phishing Awareness</h2><p>Always verify sender's email before clicking any link. If you receive a suspicious email, forward to <strong>security@company.com</strong>. IT will <em>never</em> ask for your password via email.</p><h2>4. Incident Reporting</h2><p>Report all suspected security incidents within <strong>4 hours</strong>. Incidents include: phishing clicks, unauthorised access, lost/stolen devices, and unusual system behaviour.</p>`;
const DOC_SALES = `<h1>Cold Calling Script — Enterprise Tier v4.1</h1><p><strong>Market:</strong> B2B Enterprise &nbsp;·&nbsp; <strong>Team:</strong> Sales Development</p><h2>Opening (0–30 seconds)</h2><blockquote>"Hi [Name], this is [Your Name] from NextGen Corp. I know your time is valuable so I'll be quick — we've been helping [similar companies] reduce [pain point] by 30–40%. Does that sound worth a 10-minute conversation?"</blockquote><h2>Handling Objections</h2><table><tr><th>Objection</th><th>Response</th></tr><tr><td>"Not interested"</td><td>"I understand — most of our best clients said the same. May I ask — is [pain point] something your team actively wants to solve?"</td></tr><tr><td>"Send an email"</td><td>"Absolutely! To make it relevant — what's your biggest current challenge with [X]?"</td></tr><tr><td>"We have a vendor"</td><td>"Great! We actually complement existing vendors. What's the one thing your current setup doesn't do well?"</td></tr><tr><td>"Call next quarter"</td><td>"I'll note that — are you reviewing vendors in [month]? I'll schedule time for a proper conversation."</td></tr></table><h2>Closing</h2><blockquote>"What I'd suggest is a quick 15-min screen share next week — no slides, just me showing how we solved [problem] for [similar company]. Tuesday or Thursday?"</blockquote>`;
const DOC_GDPR = `<h1>GDPR & Data Privacy Handbook 2026</h1><p><strong>Legal Dept</strong> | Confidential — Internal Only</p><h2>1. Key GDPR Principles</h2><ul><li><strong>Lawfulness & transparency</strong> — process data legally</li><li><strong>Purpose limitation</strong> — collect only for specified purposes</li><li><strong>Data minimisation</strong> — collect only what is necessary</li><li><strong>Accuracy</strong> — keep personal data accurate and current</li><li><strong>Storage limitation</strong> — delete when no longer needed</li><li><strong>Integrity & confidentiality</strong> — protect with appropriate security</li></ul><h2>2. Data Subject Rights</h2><table><tr><th>Right</th><th>Description</th><th>Deadline</th></tr><tr><td>Right of Access</td><td>Individual can request copy of all data held</td><td>30 days</td></tr><tr><td>Right to Erasure</td><td>Delete personal data on request</td><td>30 days</td></tr><tr><td>Right to Rectification</td><td>Correct inaccurate data</td><td>30 days</td></tr><tr><td>Right to Portability</td><td>Provide data in machine-readable format</td><td>30 days</td></tr><tr><td>Right to Object</td><td>Object to processing for direct marketing</td><td>Immediate</td></tr></table><h2>3. Breach Reporting</h2><p>Any personal data breach must be reported to the DPO within <strong>4 hours</strong>. High-risk breaches must be reported to the supervisory authority within <strong>72 hours</strong>.</p><h2>4. Your Responsibilities</h2><ul><li>Never share customer data via unsecured channels</li><li>Ensure third-party vendors you engage are GDPR compliant</li><li>Complete annual GDPR training on the LMS</li><li>Report suspected breaches to compliance@company.com immediately</li></ul>`;

const RESOURCES = [
  {
    id: 1, title: 'Complete Employee Onboarding Guide 2026',
    description: 'Full onboarding package: orientation video, CEO welcome message, and the complete HR handbook. Essential reading for all new joiners.',
    categoryId: 'c1a', thumbnail: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80',
    tags: ['onboarding', 'hr', 'important'], date: 'Mar 4, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: '<h2>Welcome to the Team!</h2><p>Please go through all the material below carefully. Start with the orientation video, then listen to the CEO message, and finally review the HR handbook.</p><p>After reviewing, reach out to <strong>hr@company.com</strong> with any questions.</p>' },
      { id: 'b2', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', title: 'Company Orientation Video' },
      { id: 'b3', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', title: "CEO's Welcome Message" },
      { id: 'b4', type: 'document', title: 'HR Handbook 2026', pages: 18, content: DOC_HR },
    ],
  },
  {
    id: 2, title: "CEO's Q1 2026 Strategy Town Hall",
    description: 'Full audio recordings from the all-hands town hall: main session + Q&A. Covers new revenue targets, APAC expansion, and Q2 hiring plans.',
    categoryId: null, thumbnail: null, tags: ['leadership', 'strategy'], date: 'Mar 4, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: '<h3>Town Hall Key Points</h3><ul><li><strong>Q1 Revenue:</strong> Exceeded target by 12%</li><li><strong>Q2 Focus:</strong> Product-led growth + APAC expansion</li><li><strong>New Hires:</strong> 20 roles opening in April</li><li><strong>New Product:</strong> AI workflow automation launching July</li></ul>' },
      { id: 'b2', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', title: 'Main Session Recording — 48 mins' },
      { id: 'b3', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', title: 'Q&A Session — 20 mins' },
    ],
  },
  {
    id: 3, title: 'Cold Calling Script — Enterprise Tier',
    description: 'Complete de-escalation script and objection-handling matrix. Approved by Head of Sales. Mandatory reading before your first live call.',
    categoryId: 'c2a', thumbnail: null, tags: ['sales', 'script', 'mandatory'], date: 'Mar 3, 2026',
    blocks: [
      { id: 'b1', type: 'document', title: 'Sales Script & Objection Handling v4.1', pages: 8, content: DOC_SALES },
    ],
  },
  {
    id: 4, title: 'Auto-Dialer Setup — Full Video Tutorial',
    description: 'Screen recording: importing lead lists, DNC filter setup, dial pace configuration, and real-time drop rate analysis in the auto-dialer dashboard.',
    categoryId: 'c3', thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    tags: ['tutorial', 'software'], date: 'Feb 28, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: '<h3>Prerequisites</h3><p>Ensure you have admin-level access to the dialer dashboard before starting. Contact your supervisor if you only have agent-level access.</p>' },
      { id: 'b2', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', title: 'Auto-Dialer Full Setup Walkthrough' },
    ],
  },
  {
    id: 5, title: 'Password & MFA Security Policy',
    description: 'Mandatory 90-day password reset guidelines and MFA setup. Non-compliance results in account suspension. Includes quick reference card.',
    categoryId: 'c1b', thumbnail: null, tags: ['security', 'mandatory'], date: 'Feb 20, 2026',
    blocks: [
      { id: 'b1', type: 'document', title: 'IT Security Policy 2026 Edition', pages: 6, content: DOC_IT },
      { id: 'b2', type: 'text', content: '<h3>Quick Reminders</h3><ul><li>Never share your password — not even with IT support</li><li>Enable MFA on all work accounts immediately</li><li>Report suspicious activity to security@company.com</li></ul>' },
    ],
  },
  {
    id: 6, title: 'Enterprise CRM Module — Product Demo',
    description: 'Two-part live product walkthrough: lead scoring and pipeline management in Part 1; analytics dashboards and executive reporting in Part 2.',
    categoryId: 'c2b', thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
    tags: ['product', 'demo', 'crm'], date: 'Feb 25, 2026',
    blocks: [
      { id: 'b1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', title: 'Part 1 — Lead Management & Pipeline' },
      { id: 'b2', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', title: 'Part 2 — Reporting & Analytics' },
      { id: 'b3', type: 'text', content: '<h3>Features Demonstrated</h3><ul><li>AI-powered lead scoring</li><li>Automated follow-up email sequences</li><li>Real-time pipeline forecasting</li><li>Integration with Outlook, Gmail & Slack</li></ul>' },
    ],
  },
  {
    id: 7, title: 'Customer Escalation SOP — 3-Part Audio Series',
    description: 'Head of Support\'s audio briefing covering Level 1, Level 2, and Executive escalation procedures with real case examples. ~30 mins total.',
    categoryId: 'c5a', thumbnail: null, tags: ['support', 'escalation'], date: 'Feb 22, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: '<h3>Listen in Order</h3><p>Go through all three recordings sequentially. Each covers a specific tier with real-case examples and resolution templates.</p>' },
      { id: 'b2', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', title: 'Level 1 — Front-line Agent Guide' },
      { id: 'b3', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', title: 'Level 2 — Team Lead Actions' },
      { id: 'b4', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', title: 'Executive Escalation — Critical Account Protocol' },
    ],
  },
  {
    id: 8, title: 'GDPR & Data Privacy Compliance 2026',
    description: 'Essential compliance for all staff handling customer data. Covers data retention, subject access requests, breach reporting timelines, and DSAR workflows.',
    categoryId: 'c4', thumbnail: null, tags: ['legal', 'compliance', 'mandatory'], date: 'Feb 18, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: '<h3>Why This Matters</h3><p>Every team member handling customer personal data has legal obligations under GDPR. Non-compliance can result in fines up to <strong>€20 million</strong> or 4% of global annual turnover — whichever is higher.</p>' },
      { id: 'b2', type: 'document', title: 'GDPR Compliance Handbook 2026', pages: 22, content: DOC_GDPR },
    ],
  },
  {
    id: 9, title: 'CRM Power User — Keyboard Shortcuts Guide',
    description: 'Quick reference for power users: keyboard shortcuts, bulk actions, advanced filter syntax, and custom report templates for maximum efficiency.',
    categoryId: 'c3', thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80',
    tags: ['tutorial', 'crm', 'tips'], date: 'Feb 15, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: `<h3>Essential Shortcuts</h3><table style="width:100%;border-collapse:collapse;font-size:.85rem;margin:1rem 0"><tr><th style="background:#f1f5f9;padding:.5rem .9rem;text-align:left;border:1px solid #e2e8f0;font-weight:700">Action</th><th style="background:#f1f5f9;padding:.5rem .9rem;text-align:left;border:1px solid #e2e8f0;font-weight:700">Windows</th><th style="background:#f1f5f9;padding:.5rem .9rem;text-align:left;border:1px solid #e2e8f0;font-weight:700">Mac</th></tr><tr><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">New Lead</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Ctrl+N</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Cmd+N</td></tr><tr style="background:#fafafa"><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Quick Search</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Ctrl+K</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Cmd+K</td></tr><tr><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Log Call</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Ctrl+L</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Cmd+L</td></tr><tr style="background:#fafafa"><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Bulk Export</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Ctrl+Shift+E</td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Cmd+Shift+E</td></tr></table>` },
    ],
  },
  {
    id: 10, title: 'Employee Benefits Package 2026',
    description: 'Complete breakdown of your employment benefits: health insurance, pension, annual leave, gym allowance, EAP, and £1,200/year learning budget.',
    categoryId: 'c1a', thumbnail: null, tags: ['hr', 'benefits'], date: 'Jan 30, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: `<h3>Benefits at a Glance</h3><table style="width:100%;border-collapse:collapse;font-size:.85rem;margin:1rem 0"><tr><th style="background:#f1f5f9;padding:.5rem .9rem;text-align:left;border:1px solid #e2e8f0;font-weight:700">Benefit</th><th style="background:#f1f5f9;padding:.5rem .9rem;text-align:left;border:1px solid #e2e8f0;font-weight:700">Details</th></tr><tr><td style="padding:.5rem .9rem;border:1px solid #e2e8f0;vertical-align:top"><strong>Health Insurance</strong></td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Bupa Gold Plan — individual + family from day 1.</td></tr><tr style="background:#fafafa"><td style="padding:.5rem .9rem;border:1px solid #e2e8f0;vertical-align:top"><strong>Pension</strong></td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">Company contributes 6% of basic salary.</td></tr><tr><td style="padding:.5rem .9rem;border:1px solid #e2e8f0;vertical-align:top"><strong>Annual Leave</strong></td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">21 days + 8 public holidays.</td></tr><tr style="background:#fafafa"><td style="padding:.5rem .9rem;border:1px solid #e2e8f0;vertical-align:top"><strong>Gym Allowance</strong></td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">£50/month reimbursed.</td></tr><tr><td style="padding:.5rem .9rem;border:1px solid #e2e8f0;vertical-align:top"><strong>Learning Budget</strong></td><td style="padding:.5rem .9rem;border:1px solid #e2e8f0">£1,200/year.</td></tr></table>` },
      { id: 'b2', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', title: 'HR Team Benefits Walkthrough Audio' },
    ],
  },
  {
    id: 11, title: 'Live Chat Protocol — Support Team',
    description: 'SOP for live chat handling: response time targets, top 10 canned responses, chat-to-voice hand-off protocol, and CSAT optimisation tips.',
    categoryId: 'c5', thumbnail: 'https://images.unsplash.com/photo-1553484771-371a605b060b?auto=format&fit=crop&w=800&q=80',
    tags: ['support', 'live-chat'], date: 'Jan 25, 2026',
    blocks: [
      { id: 'b1', type: 'text', content: '<h3>Response Time Standards</h3><ul><li><strong>First Response:</strong> Under 60 seconds during business hours</li><li><strong>Resolution:</strong> Under 8 minutes for Tier 1 issues</li><li><strong>Auto-Escalate:</strong> Any chat unresolved after 10 minutes → Tier 2</li></ul>' },
      { id: 'b2', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', title: 'Live Chat Roleplay Training Video' },
    ],
  },
  {
    id: 12, title: 'Sales Objection Handling Masterclass',
    description: 'Video masterclass + audio recap. 12 most common enterprise objections using SPIN and Challenger methodologies with real recorded call examples.',
    categoryId: 'c2a', thumbnail: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80',
    tags: ['sales', 'training', 'masterclass'], date: 'Jan 20, 2026',
    blocks: [
      { id: 'b1', type: 'video', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', title: 'Masterclass Video — Full Session' },
      { id: 'b2', type: 'text', content: '<h3>Methodologies Covered</h3><ul><li><strong>SPIN Selling:</strong> Situation, Problem, Implication, Need-payoff</li><li><strong>Challenger Sale:</strong> Teach, Tailor, Take Control for complex deals</li><li><strong>BANT:</strong> Budget, Authority, Need, Timeline qualification</li></ul>' },
      { id: 'b3', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', title: 'Audio Recap & Key Takeaways — 12 mins' },
    ],
  },
];

/* ══════════════════════════════════════════════════
   AUDIO PLAYER
══════════════════════════════════════════════════ */
function AudioPlayer({ url, title = 'Audio Recording' }) {
  const ref = useRef(null);
  const [play, setPlay]       = useState(false);
  const [cur, setCur]         = useState(0);
  const [dur, setDur]         = useState(0);
  const [vol, setVol]         = useState(1);
  const [muted, setMuted]     = useState(false);
  const [speed, setSpeed]     = useState(1.0);
  const [showSpd, setShowSpd] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onMeta = () => { setDur(a.duration); setLoaded(true); };
    const onTime = () => setCur(a.currentTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', () => setPlay(false));
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.pause();
    };
  }, [url]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (play) { a.pause(); setPlay(false); } else { a.play(); setPlay(true); }
  };
  const skip = (d) => {
    const a = ref.current;
    const t = Math.min(dur, Math.max(0, a.currentTime + d));
    a.currentTime = t; setCur(t);
  };
  const seek = (e) => {
    const a = ref.current;
    const r = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - r.left) / r.width;
    const t = p * dur; a.currentTime = t; setCur(t);
  };
  const chgSpd = (s) => { setSpeed(s); if (ref.current) ref.current.playbackRate = s; setShowSpd(false); };
  const chgVol = (v) => { setVol(v); if (ref.current) { ref.current.volume = v; setMuted(v === 0); } };
  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div className="w-full rounded-2xl overflow-hidden my-5 shadow-lg" style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)' }}>
      <audio ref={ref} src={url} preload="metadata" />
      <div className="flex items-center gap-3 px-5 pt-5 pb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,.15)' }}>
          <Headphones className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight truncate">{title}</p>
          <p className="text-indigo-200 text-xs mt-0.5">{loaded ? `${fmt(dur)} · Audio` : 'Loading...'}</p>
        </div>
        <div className="relative">
          <button onClick={e => { e.stopPropagation(); setShowSpd(!showSpd); }}
            className="flex items-center gap-1.5 text-xs font-extrabold text-white border border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/20 transition-colors"
            style={{ background: 'rgba(255,255,255,.12)' }}>
            <Zap className="w-3 h-3" />
            {speed === 1.0 ? '1×' : `${speed}×`}
          </button>
          {showSpd && (
            <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-2xl z-50 w-28 overflow-hidden border border-slate-200 kb-fade">
              {SPEEDS.map(s => (
                <button key={s} onClick={e => { e.stopPropagation(); chgSpd(s); }}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold transition-colors ${speed === s ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-indigo-50'}`}>
                  {s === 1.0 ? 'Normal' : `${s}×`}
                  {speed === s && <CircleCheck className="w-3 h-3" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Progress */}
      <div className="px-5 pb-2">
        <div className="w-full h-1.5 rounded-full cursor-pointer" style={{ background: 'rgba(255,255,255,.2)' }} onClick={seek}>
          <div className="h-full rounded-full relative transition-all" style={{ width: `${pct}%`, background: 'rgba(255,255,255,.85)' }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-indigo-600 shadow" />
          </div>
        </div>
        <div className="flex justify-between mt-1.5 text-xs font-mono" style={{ color: 'rgba(199,210,254,.85)' }}>
          <span>{fmt(cur)}</span><span>{fmt(dur)}</span>
        </div>
      </div>
      {/* Controls */}
      <div className="px-5 pb-5 flex items-center">
        <div className="flex items-center gap-2 flex-1">
          <button onClick={() => { const m = !muted; setMuted(m); if (ref.current) ref.current.volume = m ? 0 : vol; }} className="text-white/70 hover:text-white transition-colors">
            {muted || vol === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input type="range" min="0" max="1" step="0.05" value={muted ? 0 : vol}
            onChange={e => chgVol(Number(e.target.value))}
            className="w-16 kb-range accent-white"
            style={{ background: `linear-gradient(to right,rgba(255,255,255,.9) ${(muted ? 0 : vol) * 100}%,rgba(255,255,255,.25) ${(muted ? 0 : vol) * 100}%)` }}
          />
        </div>
        <div className="flex items-center gap-4 justify-center flex-1">
          <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition-colors flex flex-col items-center">
            <SkipBack className="w-5 h-5" /><span className="text-[8px] text-white/50 -mt-0.5">10s</span>
          </button>
          <button onClick={toggle} className="w-13 h-13 bg-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform" style={{ width: '52px', height: '52px' }}>
            {play ? <Pause className="w-5 h-5 text-indigo-700" /> : <Play className="w-5 h-5 text-indigo-700 ml-0.5" />}
          </button>
          <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition-colors flex flex-col items-center">
            <SkipForward className="w-5 h-5" /><span className="text-[8px] text-white/50 -mt-0.5">10s</span>
          </button>
        </div>
        <div className="flex-1" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   VIDEO PLAYER
══════════════════════════════════════════════════ */
function VideoPlayer({ url, title = 'Video' }) {
  const vRef  = useRef(null);
  const wRef  = useRef(null);
  const timer = useRef(null);
  const [play,  setPlay]  = useState(false);
  const [cur,   setCur]   = useState(0);
  const [dur,   setDur]   = useState(0);
  const [muted, setMuted] = useState(false);
  const [showC, setShowC] = useState(true);
  const [fs,    setFs]    = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [showS, setShowS] = useState(false);

  useEffect(() => {
    const v = vRef.current;
    if (!v) return;
    v.addEventListener('loadedmetadata', () => setDur(v.duration));
    v.addEventListener('timeupdate', () => setCur(v.currentTime));
    v.addEventListener('ended', () => setPlay(false));
    return () => { clearTimeout(timer.current); v.pause(); };
  }, [url]);

  const resetTimer = () => {
    setShowC(true); clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (vRef.current && !vRef.current.paused) setShowC(false); }, 2800);
  };

  const toggle = () => {
    const v = vRef.current;
    if (!v) return;
    if (play) { v.pause(); setPlay(false); setShowC(true); clearTimeout(timer.current); }
    else { v.play(); setPlay(true); resetTimer(); }
  };

  const seek = (e) => {
    const v = vRef.current;
    const r = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    v.currentTime = p * dur; setCur(p * dur);
  };

  const chgSpd = (s) => { setSpeed(s); if (vRef.current) vRef.current.playbackRate = s; setShowS(false); };

  const toggleFs = () => {
    const el = wRef.current;
    if (!document.fullscreenElement) { el.requestFullscreen && el.requestFullscreen(); setFs(true); }
    else { document.exitFullscreen && document.exitFullscreen(); setFs(false); }
  };

  const pct = dur > 0 ? (cur / dur) * 100 : 0;

  return (
    <div ref={wRef} className="w-full aspect-video bg-black rounded-2xl overflow-hidden relative my-5 shadow-xl"
      onMouseMove={resetTimer} onMouseLeave={() => { if (play) setShowC(false); }}>
      <video ref={vRef} src={url} className="w-full h-full object-contain"
        controlsList="nodownload nofullscreen" disablePictureInPicture
        onContextMenu={e => e.preventDefault()} onClick={toggle} />
      {!play && (
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={toggle}>
          <div className="w-20 h-20 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-2xl border border-white/20"
            style={{ background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(8px)' }}>
            <Play className="w-9 h-9 text-white ml-1" />
          </div>
        </div>
      )}
      <div className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${showC ? 'opacity-100' : 'opacity-0'}`}
        style={{ background: 'linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 100%)' }}>
        <div className="px-4 pt-3 pb-1.5">
          <p className="text-white/75 text-xs font-medium truncate">{title}</p>
        </div>
        <div className="px-4 pb-2">
          <div className="w-full h-1 rounded-full cursor-pointer hover:h-2.5 transition-all" style={{ background: 'rgba(255,255,255,.25)' }} onClick={seek}>
            <div className="h-full rounded-full relative" style={{ width: `${pct}%`, background: '#818cf8' }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow" />
            </div>
          </div>
        </div>
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="text-white hover:scale-110 transition-transform">
              {play ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => { const m = !muted; setMuted(m); if (vRef.current) vRef.current.muted = m; }} className="text-white/75 hover:text-white">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-white/60 text-xs font-mono">{fmt(cur)} / {fmt(dur)}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={e => { e.stopPropagation(); setShowS(!showS); }}
                className="text-xs font-extrabold text-white/80 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/20 transition-colors border border-white/20">
                {speed === 1.0 ? '1×' : `${speed}×`}
              </button>
              {showS && (
                <div className="absolute bottom-full right-0 mb-2 rounded-xl shadow-2xl z-50 w-28 overflow-hidden border border-white/10 kb-fade"
                  style={{ background: 'rgba(15,23,42,.95)', backdropFilter: 'blur(8px)' }}>
                  {SPEEDS.map(s => (
                    <button key={s} onClick={e => { e.stopPropagation(); chgSpd(s); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold transition-colors ${speed === s ? 'bg-indigo-600 text-white' : 'text-white/80 hover:bg-white/10'}`}>
                      {s === 1.0 ? 'Normal' : `${s}×`}{speed === s && <CircleCheck className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleFs} className="text-white/80 hover:text-white transition-colors">
              {fs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   DOCUMENT PREVIEW
══════════════════════════════════════════════════ */
function DocPreview({ title, pages = 4, content }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="w-full my-5 rounded-2xl border border-slate-200 overflow-hidden shadow-md bg-white">
      <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center border border-red-100 shrink-0">
            <FileText className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 leading-tight">{title}</p>
            <p className="text-xs text-slate-500 mt-0.5">{pages} pages &nbsp;·&nbsp; PDF Document</p>
          </div>
        </div>
        <button onClick={() => setOpen(!open)}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-sm ${open ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
          <Eye className="w-3.5 h-3.5" />{open ? 'Collapse' : 'View Document'}
        </button>
      </div>
      {open && (
        <div className="bg-slate-100 p-6 max-h-[72vh] overflow-y-auto kb-cscroll kb-fade">
          <div className="w-full max-w-2xl mx-auto bg-white shadow-xl rounded-sm border border-slate-200 p-12 min-h-[400px] kb-prose-doc"
            style={{ fontFamily: "Georgia,'Times New Roman',serif" }}
            dangerouslySetInnerHTML={{ __html: content || `<h1>${title}</h1><p>Loading content...</p>` }} />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   FULL-SCREEN VIEWER
══════════════════════════════════════════════════ */
function Viewer({ res, onClose, markViewed }) {
  useEffect(() => {
    markViewed(res.id);
  }, [res]);

  const types = [...new Set(res.blocks.map(b => b.type))];
  const typeLabel = types.length > 1 ? 'Mixed' : ({ video: 'Video', audio: 'Audio', document: 'Document', text: 'Article' }[types[0]] || 'Post');
  const badgeClr = { Mixed: 'bg-violet-100 text-violet-700', Video: 'bg-blue-100 text-blue-700', Audio: 'bg-purple-100 text-purple-700', Document: 'bg-red-100 text-red-700', Article: 'bg-emerald-100 text-emerald-700' };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white kb-slide-up" style={{ fontFamily: 'Inter,system-ui,sans-serif' }}>
      <header className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-7 h-[60px] flex items-center justify-between gap-4 shadow-sm z-10">
        <button onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors shrink-0 group">
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden sm:inline">Back to Knowledge Base</span>
        </button>
        <div className="flex-1 min-w-0 flex flex-col items-center justify-center">
          <p className="font-bold text-slate-800 text-sm leading-tight truncate max-w-lg text-center">{res.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${badgeClr[typeLabel] || 'bg-slate-100 text-slate-600'}`}>{typeLabel}</span>
            <span className="text-[10px] text-slate-400 font-medium">{res.blocks.length} blocks</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
            <CircleCheck className="w-3.5 h-3.5" /> Viewed
          </span>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto kb-cscroll" style={{ background: '#F7F9FC' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
          {res.thumbnail && (
            <div className="w-full h-56 sm:h-72 rounded-2xl overflow-hidden mb-8 shadow-lg">
              <img src={res.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="mb-8 pb-6 border-b border-slate-200">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-3">{res.title}</h1>
            <p className="text-slate-600 text-sm leading-relaxed mb-4">{res.description}</p>
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500 font-medium"><Clock className="w-3.5 h-3.5" />{res.date}</span>
              {res.tags && res.tags.map(t => (
                <span key={t} className="bg-indigo-50 text-indigo-600 font-bold px-2.5 py-1 rounded-full border border-indigo-100">#{t}</span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {res.blocks.map((b, i) => {
              if (b.type === 'text')     return <div key={i} className="kb-prose-view" dangerouslySetInnerHTML={{ __html: b.content }} />;
              if (b.type === 'video')    return <VideoPlayer key={i} url={b.url} title={b.title || `Video ${i + 1}`} />;
              if (b.type === 'audio')    return <AudioPlayer key={i} url={b.url} title={b.title || `Audio ${i + 1}`} />;
              if (b.type === 'document') return <DocPreview key={i} title={b.title || 'Document'} pages={b.pages || 4} content={b.content} />;
              return null;
            })}
          </div>
          <div className="mt-12 p-5 rounded-2xl border border-emerald-200 flex items-center gap-4" style={{ background: '#f0fdf4' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#dcfce7' }}>
              <CircleCheck className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-extrabold text-emerald-800 text-sm">You've completed this resource</p>
              <p className="text-emerald-600 text-xs mt-0.5">Marked as viewed in your knowledge base profile.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   RICH TEXT EDITOR (simple toolbar)
══════════════════════════════════════════════════ */
function RTE({ value, onChange, placeholder }) {
  const toolbarBtns = [
    ['B', 'font-bold'],
    ['I', 'italic'],
    ['U', 'underline'],
    null,
    ['H1', 'text-sm'],
    ['H2', 'text-sm'],
    null,
    ['≡', 'text-base'],
    ['Hi', 'text-sm'],
  ];
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all bg-white shadow-sm">
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex gap-1 flex-wrap">
        {toolbarBtns.map((x, i) =>
          x === null
            ? <div key={i} className="w-px h-5 bg-slate-200 mx-1 self-center" />
            : <button key={i} type="button" title={x[0]} className={`px-2 py-1 hover:bg-slate-200 rounded text-slate-600 transition-colors text-xs ${x[1]}`}>{x[0]}</button>
        )}
      </div>
      <textarea rows="5" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-4 py-3 outline-none resize-y text-sm text-slate-700 min-h-[100px]" />
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════ */
export default function KnowledgeBase() {
  // Inject styles once
  useEffect(() => {
    const id = 'kb-styles';
    if (!document.getElementById(id)) {
      const el = document.createElement('style');
      el.id = id;
      el.textContent = KB_STYLE;
      document.head.appendChild(el);
    }
    return () => {
      // Keep styles for unmount/remount consistency
    };
  }, []);

  const [adminMode,   setAdminMode]   = useState(true);
  const [gSearch,     setGSearch]     = useState('');
  const [sSearch,     setSSearch]     = useState('');
  const [folder,      setFolder]      = useState('recent');
  const [expanded,    setExpanded]    = useState(['c1', 'c1a', 'c2']);
  const [viewed,      setViewed]      = useState([5, 9]);
  const [cats,        setCats]        = useState(CATS);
  const [resources,   setResources]   = useState(RESOURCES);
  const [viewing,     setViewing]     = useState(null);
  const [folderModal, setFolderModal] = useState(false);
  const [catMgr,      setCatMgr]      = useState(false);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [folderName,  setFolderName]  = useState('');
  const [fpid,        setFpid]        = useState(null);
  const [dragCat,     setDragCat]     = useState(null);
  const [sideOpen,    setSideOpen]    = useState(true);
  const [form, setForm] = useState({ title: '', description: '', categoryId: '', thumbnailUrl: '', tags: '', blocks: [{ id: 'b1', type: 'text', content: '' }] });

  /* numbered categories */
  const numbered = useMemo(() => {
    const sorted = [...cats].sort((a, b) => (a.order || 0) - (b.order || 0));
    const res = []; let ri = 1;
    sorted.filter(c => !c.parentId).forEach(root => {
      res.push({ ...root, dn: `${ri}`, isSub: false });
      let si = 1;
      sorted.filter(c => c.parentId === root.id).forEach(ch => { res.push({ ...ch, dn: `${ri}.${si}`, isSub: true }); si++; });
      ri++;
    });
    return res;
  }, [cats]);

  /* sidebar filter */
  const filtCats = useMemo(() => {
    if (!sSearch.trim()) return numbered;
    const q = sSearch.toLowerCase();
    const m = numbered.filter(c => c.name.toLowerCase().includes(q));
    const ids = new Set(m.map(x => x.id));
    let again = true;
    while (again) {
      again = false;
      numbered.forEach(c => { if (ids.has(c.id) && c.parentId && !ids.has(c.parentId)) { ids.add(c.parentId); again = true; } });
    }
    return numbered.filter(c => ids.has(c.id));
  }, [numbered, sSearch]);

  const renderTree = (pid = null) => {
    const kids = filtCats.filter(c => c.parentId === pid);
    if (!kids.length) return null;
    return kids.map(f => {
      const hasK = filtCats.some(c => c.parentId === f.id);
      const open = expanded.includes(f.id);
      const act = folder === f.id;
      return (
        <div key={f.id}>
          <div onClick={() => setFolder(f.id)}
            className={`flex items-center py-2 pr-3 my-0.5 rounded-xl cursor-pointer transition-all group ${f.isSub ? 'pl-10' : 'pl-3'} ${act ? 'bg-indigo-50 text-indigo-700 font-bold ring-1 ring-inset ring-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}>
            {hasK
              ? <button onClick={e => { e.stopPropagation(); setExpanded(open ? expanded.filter(i => i !== f.id) : [...expanded, f.id]); }}
                  className={`p-0.5 mr-1.5 rounded ${act ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600'}`}>
                {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              : <div className="w-5 mr-1.5" />}
            {open && hasK
              ? <FolderOpen className={`w-4 h-4 mr-2 shrink-0 ${act ? 'text-indigo-600' : 'text-amber-500'}`} />
              : <Folder className={`w-4 h-4 mr-2 shrink-0 ${act ? 'text-indigo-500' : 'text-amber-400'}`} />}
            <span className="text-[13px] truncate flex-1">
              <span className="text-[11px] font-extrabold text-slate-400 mr-1">{f.dn}</span>{f.name}
            </span>
            <span className="text-[10px] font-bold text-slate-300 opacity-0 group-hover:opacity-100">
              {resources.filter(r => r.categoryId === f.id).length}
            </span>
          </div>
          {hasK && open && renderTree(f.id)}
        </div>
      );
    });
  };

  /* displayed resources */
  const displayed = useMemo(() => {
    let r = resources;
    if (gSearch.trim()) {
      const q = gSearch.toLowerCase();
      r = r.filter(x => x.title.toLowerCase().includes(q) || x.description.toLowerCase().includes(q) || (x.tags || []).some(t => t.toLowerCase().includes(q)));
    } else if (folder === 'recent') r = r.filter(x => !viewed.includes(x.id));
    else if (folder === null) r = r.filter(x => x.categoryId === null);
    else r = r.filter(x => x.categoryId === folder);
    return [...r].sort((a, b) => b.id - a.id);
  }, [gSearch, folder, resources, viewed]);

  const bc = useMemo(() => {
    if (folder === 'recent') return 'Recent & Unread';
    if (folder === null) return 'Uncategorized';
    let c = []; let cur = numbered.find(x => x.id === folder);
    while (cur) { c.unshift(cur.name); cur = numbered.find(x => x.id === cur.parentId); }
    return c.join(' › ');
  }, [folder, numbered]);

  const unread = resources.filter(r => !viewed.includes(r.id)).length;

  const getTypeInfo = (res) => {
    const t = [...new Set(res.blocks.map(b => b.type))];
    if (t.length > 1) return { label: 'Mixed', clr: 'bg-violet-100 text-violet-700' };
    const m = { video: { label: 'Video', clr: 'bg-blue-100 text-blue-700' }, audio: { label: 'Audio', clr: 'bg-purple-100 text-purple-700' }, document: { label: 'Document', clr: 'bg-red-100 text-red-700' }, text: { label: 'Article', clr: 'bg-emerald-100 text-emerald-700' } };
    return m[t[0]] || { label: 'Post', clr: 'bg-slate-100 text-slate-600' };
  };

  const openCreate = () => {
    setForm({ title: '', description: '', categoryId: folder === 'recent' ? '' : (folder || ''), thumbnailUrl: '', tags: '', blocks: [{ id: 'b1', type: 'text', content: '' }] });
    setCreateOpen(true);
  };

  const saveRes = () => {
    if (!form.title.trim()) return alert('Title is required!');
    setResources([{ id: Date.now(), ...form, categoryId: form.categoryId || null, date: 'Just now', tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) }, ...resources]);
    setCreateOpen(false);
  };

  const addBlock = (type) => setForm({ ...form, blocks: [...form.blocks, { id: `b${Date.now()}`, type, content: '', url: '', title: '' }] });
  const remBlock = (id) => setForm({ ...form, blocks: form.blocks.filter(b => b.id !== id) });
  const updBlock = (id, k, v) => setForm({ ...form, blocks: form.blocks.map(b => b.id === id ? { ...b, [k]: v } : b) });

  const doCreateFolder = () => {
    if (!folderName.trim()) return;
    const nc = { id: `cat-${Date.now()}`, name: folderName, parentId: fpid, order: cats.length };
    setCats([...cats, nc]);
    if (fpid && !expanded.includes(fpid)) setExpanded([...expanded, fpid]);
    setFolderModal(false); setFolderName(''); setFpid(null);
  };

  const doDrop = (tid) => {
    if (!dragCat || dragCat === tid) return;
    const dc = cats.find(c => c.id === dragCat); const tc = cats.find(c => c.id === tid);
    if (!dc || !tc || dc.parentId !== tc.parentId) return;
    const sibs = cats.filter(c => c.parentId === dc.parentId).sort((a, b) => (a.order || 0) - (b.order || 0));
    const oi = sibs.findIndex(c => c.id === dragCat); const ni = sibs.findIndex(c => c.id === tid);
    sibs.splice(oi, 1); sibs.splice(ni, 0, dc);
    setCats(cats.map(c => c.parentId === dc.parentId ? { ...c, order: sibs.findIndex(s => s.id === c.id) } : c));
    setDragCat(null);
  };

  return (
    <div className="flex flex-col overflow-hidden" style={{ background: '#F7F9FC', fontFamily: 'Inter,system-ui,sans-serif', height: '100%', minHeight: '100vh' }}>

      {/* ─── HEADER ─── */}
      <header className="h-[60px] bg-white border-b border-slate-200 flex items-center px-4 sm:px-5 gap-3 shrink-0 z-20 shadow-sm">
        <button className="lg:hidden p-2 text-slate-500 hover:text-slate-700" onClick={() => setSideOpen(!sideOpen)}>
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-extrabold text-slate-900 tracking-tight hidden sm:block" style={{ fontSize: '15px' }}>Knowledge Base</span>
        </div>
        <div className="flex-1 mx-3 max-w-lg hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search articles, videos, audio files..."
              value={gSearch} onChange={e => setGSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100/80 pl-10 pr-10 py-2.5 rounded-xl text-sm outline-none transition-all" />
            {gSearch && <button onClick={() => setGSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
        <div className="flex items-center gap-2.5 ml-auto">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-widest hidden sm:block">Admin</span>
          <button onClick={() => setAdminMode(!adminMode)}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${adminMode ? 'bg-indigo-600' : 'bg-slate-300'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform absolute ${adminMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── SIDEBAR ─── */}
        <aside className={`${sideOpen ? 'w-64 xl:w-[270px]' : 'w-0 overflow-hidden'} bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-300 z-30`}>
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Directories</span>
              {adminMode && (
                <div className="flex gap-1">
                  <button onClick={() => setCatMgr(true)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"><Move className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setFpid(null); setFolderModal(true); }} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-500 hover:text-indigo-700 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Find folder..." value={sSearch} onChange={e => setSSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 pl-8 pr-3 py-2 rounded-lg text-xs outline-none focus:border-indigo-300 focus:bg-white" />
              {sSearch && <button onClick={() => setSSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3 h-3" /></button>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3 kb-cscroll">
            {[
              { id: 'recent', label: 'Recent & Unread', IconC: Clock,  badge: unread },
              { id: null,     label: 'Uncategorized',   IconC: Hash,   badge: 0 },
            ].map(({ id: fid, label, IconC, badge }) => (
              <div key={String(fid)} onClick={() => setFolder(fid)}
                className={`flex items-center px-3 py-2.5 mb-1 rounded-xl cursor-pointer transition-all ${folder === fid ? 'bg-indigo-50 text-indigo-700 font-bold ring-1 ring-inset ring-indigo-100' : 'text-slate-600 hover:bg-slate-50'}`}>
                <IconC className={`w-4 h-4 mr-2.5 shrink-0 ${folder === fid ? 'text-indigo-500' : 'text-slate-400'}`} />
                <span className="text-[13px] flex-1">{label}</span>
                {badge > 0 && <span className="bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{badge}</span>}
              </div>
            ))}
            <div className="h-px bg-slate-100 mx-2 mb-3" />
            {renderTree(null)}
            {filtCats.length === 0 && <p className="text-xs text-center text-slate-500 py-4">No folders found</p>}
          </div>

          {adminMode && (
            <div className="p-3 border-t border-slate-100">
              <button onClick={openCreate}
                className="w-full flex items-center justify-center text-white px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-md gap-2 hover:shadow-indigo-200"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <Plus className="w-4 h-4" /> Create Resource
              </button>
            </div>
          )}
        </aside>

        {/* ─── MAIN ─── */}
        <main className="flex-1 overflow-y-auto kb-cscroll" style={{ background: '#F7F9FC' }}>
          <div className="max-w-7xl mx-auto p-5 sm:p-8 pb-24">
            {/* Page heading */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-7">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium mb-1">
                  <BookOpen className="w-3 h-3" /><span>Knowledge Base</span>
                  {folder !== 'recent' && <><ChevronRight className="w-3 h-3" /><span>{bc}</span></>}
                </div>
                <h1 className="text-xl font-extrabold text-slate-900">{bc}</h1>
                <p className="text-xs text-slate-500 mt-0.5">{displayed.length} resource{displayed.length !== 1 ? 's' : ''}</p>
              </div>
              {adminMode && folder !== 'recent' && (
                <div className="flex items-center gap-2">
                  {folder !== null && !numbered.find(c => c.id === folder)?.isSub && (
                    <button onClick={() => { setFpid(folder); setFolderModal(true); }}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-300 px-3 py-2 rounded-xl transition-colors">
                      <Plus className="w-3.5 h-3.5" /> Add Sub-folder
                    </button>
                  )}
                  <button onClick={openCreate}
                    className="flex items-center gap-1.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl shadow-sm transition-colors">
                    <Plus className="w-4 h-4" /> New Resource
                  </button>
                </div>
              )}
            </div>

            {/* Grid */}
            {displayed.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {displayed.map(item => {
                  const isUnread = !viewed.includes(item.id);
                  const ti = getTypeInfo(item);
                  const iconMap = { Video: Video, Audio: Headphones, Document: FileText, Mixed: Zap, Article: AlignLeft };
                  const IconComp = iconMap[ti.label] || AlignLeft;
                  const iconClrMap = { Video: 'text-blue-400', Audio: 'text-purple-400', Document: 'text-red-400', Mixed: 'text-violet-400', Article: 'text-emerald-400' };
                  const iconClr = iconClrMap[ti.label] || 'text-emerald-400';
                  return (
                    <div key={item.id} onClick={() => setViewing(item)}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden cursor-pointer kb-card flex flex-col group shadow-sm">
                      <div className="h-[148px] relative flex items-center justify-center shrink-0 overflow-hidden" style={{ background: 'linear-gradient(135deg,#eef2ff 0%,#f5f3ff 100%)' }}>
                        {item.thumbnail
                          ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          : <div className="flex flex-col items-center gap-2 opacity-60">
                            <IconComp className={`w-10 h-10 ${iconClr}`} />
                          </div>}
                        <div className={`absolute bottom-2.5 left-2.5 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg shadow-sm backdrop-blur-sm ${ti.clr}`}>{ti.label}</div>
                        {isUnread
                          ? <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow animate-pulse" />
                          : <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-white rounded-full p-0.5 shadow"><CircleCheck className="w-3 h-3" /></div>}
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="font-extrabold text-[13.5px] text-slate-900 leading-snug line-clamp-2 mb-1.5 group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                        <p className="text-[11.5px] text-slate-500 line-clamp-2 leading-relaxed flex-1 mb-3">{item.description}</p>
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {item.tags.slice(0, 3).map(t => (
                              <span key={t} className="text-[9.5px] font-bold bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">#{t}</span>
                            ))}
                          </div>
                        )}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                          <span>{item.blocks.length} block{item.blocks.length !== 1 ? 's' : ''}</span>
                          {!isUnread
                            ? <span className="flex items-center gap-1 text-emerald-600 font-bold"><CircleCheck className="w-3 h-3" /> Viewed</span>
                            : <span className="flex items-center gap-1 text-amber-500 font-bold"><Eye className="w-3 h-3" /> Unread</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-200">
                  <FileText className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-lg font-extrabold text-slate-700">Nothing here yet</p>
                <p className="text-sm text-slate-500 mt-1.5">
                  {folder === 'recent' ? "You've read everything — all caught up! 🎉" : 'This folder is empty.'}
                </p>
                {adminMode && folder !== 'recent' && (
                  <button onClick={openCreate} className="mt-6 flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                    <Plus className="w-4 h-4" /> Create First Resource
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ─── FULLSCREEN VIEWER ─── */}
      {viewing && (
        <Viewer
          res={viewing}
          onClose={() => setViewing(null)}
          markViewed={id => { if (!viewed.includes(id)) setViewed([...viewed, id]); }}
        />
      )}

      {/* ─── CREATE FOLDER ─── */}
      {folderModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 kb-fade">
            <h3 className="font-extrabold text-lg text-slate-900 mb-1">Create New Folder</h3>
            <p className="text-xs text-slate-500 mb-5">Under: <strong>{fpid === null ? 'Root' : numbered.find(c => c.id === fpid)?.name}</strong></p>
            <input autoFocus type="text" placeholder="Folder name..." value={folderName}
              onChange={e => setFolderName(e.target.value)} onKeyDown={e => e.key === 'Enter' && doCreateFolder()}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none mb-5 bg-slate-50" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setFolderModal(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Cancel</button>
              <button onClick={doCreateFolder} className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CAT MANAGER ─── */}
      {catMgr && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-slate-900/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col kb-fade overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
              <div><h3 className="font-extrabold text-lg text-slate-900">Manage Categories</h3><p className="text-xs text-slate-500">Drag to reorder</p></div>
              <button onClick={() => setCatMgr(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 overflow-y-auto kb-cscroll flex-1">
              {numbered.map(cat => (
                <div key={cat.id} draggable onDragStart={() => setDragCat(cat.id)} onDragOver={e => e.preventDefault()} onDrop={() => doDrop(cat.id)}
                  className={`flex items-center gap-3 p-3 mb-2 bg-white border rounded-xl cursor-move shadow-sm transition-colors hover:border-indigo-300 ${dragCat === cat.id ? 'border-indigo-500 opacity-50' : 'border-slate-200'} ${cat.isSub ? 'ml-8' : ''}`}>
                  <GripVertical className="w-4 h-4 text-slate-300" />
                  <span className="text-xs font-extrabold text-slate-400 w-5">{cat.dn}</span>
                  <span className="text-sm font-semibold text-slate-700">{cat.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── CREATE RESOURCE ─── */}
      {createOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 backdrop-blur-sm bg-slate-900/70 overflow-y-auto kb-cscroll">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 border border-slate-200 overflow-hidden kb-fade">
            <div className="flex items-center justify-between px-7 py-5 border-b bg-white sticky top-0 z-10 shadow-sm">
              <div>
                <h3 className="font-extrabold text-xl text-slate-900">Create New Resource</h3>
                <p className="text-xs text-slate-500 mt-0.5">Build a rich content page with text, video, audio, and documents</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-7 space-y-6" style={{ background: '#F7F9FC' }}>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-5">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Title *</label>
                    <input type="text" placeholder="Resource title..." value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Category</label>
                    <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white">
                      <option value="">-- Uncategorized --</option>
                      {numbered.map(c => <option key={c.id} value={c.id}>{c.dn} {c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Thumbnail URL</label>
                    <input type="text" placeholder="https://..." value={form.thumbnailUrl} onChange={e => setForm({ ...form, thumbnailUrl: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Tags (comma-separated)</label>
                    <input type="text" placeholder="e.g. training, hr, mandatory" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Description</label>
                    <textarea rows="3" placeholder="Brief summary..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white resize-y" />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">Content Blocks</h4>
                  <span className="text-xs text-slate-400">{form.blocks.length} added</span>
                </div>
                <div className="space-y-4">
                  {form.blocks.map((b, i) => (
                    <div key={b.id} className="border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-indigo-200 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-extrabold flex items-center justify-center">{i + 1}</span>
                          <span className="text-xs font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">{b.type}</span>
                        </div>
                        {form.blocks.length > 1 && <button onClick={() => remBlock(b.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-4 h-4" /></button>}
                      </div>
                      {b.type === 'text' && <RTE value={b.content} onChange={v => updBlock(b.id, 'content', v)} placeholder="Write formatted text content..." />}
                      {(b.type === 'video' || b.type === 'audio') && (
                        <div className="space-y-3">
                          <input type="text" placeholder={`Paste ${b.type === 'video' ? 'MP4' : 'MP3'} URL...`} value={b.url} onChange={e => updBlock(b.id, 'url', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white" />
                          <input type="text" placeholder="Title (optional)..." value={b.title || ''} onChange={e => updBlock(b.id, 'title', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white" />
                        </div>
                      )}
                      {b.type === 'document' && (
                        <div className="space-y-3">
                          <input type="text" placeholder="Document title..." value={b.title || ''} onChange={e => updBlock(b.id, 'title', e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none bg-slate-50 focus:bg-white" />
                          <RTE value={b.content || ''} onChange={v => updBlock(b.id, 'content', v)} placeholder="Paste document HTML content here..." />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { t: 'text',     l: 'Text Block',  clr: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
                    { t: 'video',    l: 'Video',        clr: 'text-blue-600 bg-blue-50 hover:bg-blue-100 border-blue-200' },
                    { t: 'audio',    l: 'Audio',        clr: 'text-purple-600 bg-purple-50 hover:bg-purple-100 border-purple-200' },
                    { t: 'document', l: 'Document/PDF', clr: 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200' },
                  ].map(({ t, l, clr }) => (
                    <button key={t} onClick={() => addBlock(t)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold border rounded-xl transition-colors ${clr}`}>
                      + {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-7 py-5 bg-white border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setCreateOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={saveRes} className="px-6 py-2.5 text-sm font-bold text-white rounded-xl shadow-md flex items-center gap-2 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <CircleCheck className="w-4 h-4" /> Publish Resource
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
