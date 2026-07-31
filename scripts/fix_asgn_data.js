const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (m) {
      let v = m[2];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  });
}

const { createClient } = require('@supabase/supabase-js');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, key);

async function fixData() {
  console.log("Fetching dcmms_subject_details...");
  const { data: details } = await supabase.from('dcmms_subject_details').select('*');
  console.log("Fetching dcmms_subject_assignments...");
  const { data: asgns } = await supabase.from('dcmms_subject_assignments').select('*');

  const committeeMap = {};
  if (details) {
    details.forEach(d => {
      const caseNo = d.case_no || d.ref_no;
      if (!caseNo) return;
      const text = d.special_notes || d.step_taken || '';
      if (text.includes("Chairman:") || text.includes("Members:") || d.report_state === "Committee Details Sent") {
        committeeMap[caseNo] = {
          caseNo,
          officerName: d.subject_officer_name || d.officer_name,
          text
        };
      }
    });
  }

  for (const caseNo of Object.keys(committeeMap)) {
    const info = committeeMap[caseNo];
    let chairman = null;
    let members = [];

    if (info.text.includes("Chairman:")) {
      const match = info.text.match(/Chairman:\s*([^|]+)/i);
      if (match && match[1]) {
        chairman = { fullName: match[1].trim(), name: match[1].trim() };
      }
    }

    if (info.text.includes("Members:")) {
      const match = info.text.match(/Members:\s*([^|]+)/i);
      if (match && match[1]) {
        members = match[1].split(',').map(s => ({ fullName: s.trim(), name: s.trim() })).filter(m => m.fullName);
      }
    }

    const existingRow = (asgns || []).find(a => (a.case_no || a.caseNo) === caseNo);
    const id = existingRow ? existingRow.id : `asgn-${caseNo}`;

    console.log(`Updating assignment id ${id} for ${caseNo}...`);

    const payload = {
      id,
      case_no: caseNo,
      subject_officer_name: info.officerName || existingRow?.subject_officer_name || 'Subject Officer',
      assigned_officers: [info.text],
      chairman,
      members,
      status: 'Committee Details Sent to Subject Officer'
    };

    const { error: upsertErr } = await supabase
      .from('dcmms_subject_assignments')
      .upsert(payload);

    if (upsertErr) {
      console.error(`Error updating assignment for ${caseNo}:`, upsertErr);
    } else {
      console.log(`Successfully updated assignment for ${caseNo}!`);
    }
  }
}

fixData().catch(console.error);
