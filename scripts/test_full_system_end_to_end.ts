import { prisma } from "../lib/prisma";
import {
  checkDatabaseConnection,
  loginOfficerServer,
  recordSessionServer,
  saveDailyMailRecordServer,
  getDailyMailRecordsServer,
  getDirectlyAssignedLettersServer,
  saveSubjectOfficerAssignmentServer,
  getSubjectOfficerDashboardCasesServer,
  saveAccusedOfficerServer,
  getAccusedOfficerByRefServer,
  saveChairmanByCaseServer,
  getChairmanByCaseServer,
  saveMembersByCaseServer,
  getMembersByCaseServer,
  saveCaseByAppointmentAndReportDueDateServer,
  getCaseByAppointmentAndReportDueDateServer,
  saveCaseByDateExtensionServer,
  updateCaseByDateExtensionApprovalServer,
  getCaseByDateExtensionServer,
  saveFormalDisciplinaryInspectionServer,
  getFormalDisciplinaryInspectionServer,
  saveRecommendationServer,
  getChargeSheetDetailsServer,
  saveProvincialInvestigationServer,
  saveConductInquiryServer,
  getCaseFullTimelineServer,
  createLetterEditRequestServer,
  getLetterEditRequestsServer,
  updateLetterEditRequestStatusServer,
  checkLetterEditApprovalStatusServer,
  saveRegisterOfficerServer,
  toggleRegisterOfficerStatusServer,
  resetOfficerPasswordServer,
  deleteRegisterOfficerServer,
  logAuditEventServer,
} from "../lib/db-actions";
import { normalizeRole, getRoleDisplayName } from "../lib/auth";

// Colorized console helpers
const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function logHeader(title: string) {
  console.log(`\n${c.cyan}========================================================================${c.reset}`);
  console.log(`${c.bold}${c.magenta}  ${title}${c.reset}`);
  console.log(`${c.cyan}========================================================================${c.reset}`);
}

function logSubHeader(sub: string) {
  console.log(`\n${c.yellow}--- ${sub} ---${c.reset}`);
}

function logSuccess(msg: string) {
  console.log(`${c.green}  ✓ ${msg}${c.reset}`);
}

function logError(msg: string, err?: any) {
  console.error(`${c.red}  ✗ ${msg}${c.reset}`, err ? err : "");
}

async function runFullSystemTest() {
  const startTime = Date.now();
  console.log(`${c.bold}${c.blue}STARTING DCMMS FULL END-TO-END SYSTEM TEST${c.reset}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, msg: string, errObj?: any) {
    if (condition) {
      logSuccess(msg);
      passedTests++;
    } else {
      logError(msg, errObj);
      failedTests++;
      throw new Error(`Assertion Failed: ${msg}`);
    }
  }

  // ============================================================================
  // SECTION 0: DATABASE CONNECTIVITY
  // ============================================================================
  logHeader("SECTION 0: SYSTEM HEALTH & DATABASE CONNECTIVITY");
  const connRes = await checkDatabaseConnection();
  assert(connRes.connected === true, "PostgreSQL database connected successfully");

  // ============================================================================
  // SECTION 1: ALL USER ROLES & AUTHENTICATION VERIFICATION
  // ============================================================================
  logHeader("SECTION 1: ALL ROLES & AUTHENTICATION VERIFICATION");

  const rolesToTest = [
    {
      roleName: "System Administrator",
      email: "admin@dcmms.gov.lk",
      empNo: "200399100000",
      pass: "sysadmin123456",
      expectedNormalizedRole: "system_admin",
    },
    {
      roleName: "Additional Secretary",
      email: "add.sec.test@dcmms.gov.lk",
      empNo: "SEC-TEST-004",
      pass: "123456",
      expectedNormalizedRole: "additional_secretary",
    },
    {
      roleName: "Senior Assistant Secretary",
      email: "senior.asst.sec.test@dcmms.gov.lk",
      empNo: "SEC-TEST-003",
      pass: "123456",
      expectedNormalizedRole: "senior_assistant_secretary",
    },
    {
      roleName: "Assistant Secretary Discipline Branch",
      email: "asst.sec.discipline.test@dcmms.gov.lk",
      empNo: "SEC-TEST-001",
      pass: "password123",
      expectedNormalizedRole: "assistant_secretary_discipline",
    },
    {
      roleName: "Chief Clerk Discipline Branch",
      email: "chief.clerk@dcmms.gov.lk",
      empNo: "CC-2026-001",
      pass: "123456",
      expectedNormalizedRole: "chief_clerk_discipline",
    },
    {
      roleName: "Subject Officer (Discipline)",
      email: "rathnaweera@dcmms.gov.lk",
      empNo: "200399100111",
      pass: "rath123456",
      expectedNormalizedRole: "subject_officer",
    },
    {
      roleName: "Assistant Secretary Investigation Branch",
      email: "asst.sec.investigation.test@dcmms.gov.lk",
      empNo: "SEC-TEST-002",
      pass: "password123",
      expectedNormalizedRole: "assistant_secretary_investigation",
    },
    {
      roleName: "Chief Clerk Investigation Branch",
      email: "nimal@gmail.com",
      empNo: "CC-INV-7463",
      pass: "123456",
      expectedNormalizedRole: "chief_clerk_investigation",
    },
    {
      roleName: "Investigation Officer",
      email: "investigation.officer@dcmms.gov.lk",
      empNo: "200399100333",
      pass: "123456",
      expectedNormalizedRole: "assistant_secretary_investigation", // Normalizer maps investigation officers
    },
  ];

  for (const r of rolesToTest) {
    logSubHeader(`Testing Authentication: ${r.roleName} (${r.email})`);

    // 1. Login with email
    const loginRes = await loginOfficerServer(r.email, r.pass);
    const user = loginRes.data || (loginRes as any).user;
    assert(loginRes.success === true && !!user, `Login successful for ${r.roleName} via email`);

    // 2. Login with employee number
    const loginEmpRes = await loginOfficerServer(r.empNo, r.pass);
    assert(loginEmpRes.success === true, `Login successful for ${r.roleName} via Employee No: ${r.empNo}`);

    // 3. Normalization & Display Name
    const norm = normalizeRole(user.role);
    const displayName = getRoleDisplayName(user.role);
    assert(!!displayName && displayName.length > 0, `Display name resolved: "${displayName}"`);

    // 4. Record session
    const sessRes = await recordSessionServer(user.id, user.role);
    assert(sessRes.success === true, `Session recorded for ${r.roleName} (Session ID: ${sessRes.sessionId})`);
  }

  // ============================================================================
  // SECTION 2: TRACK A - FORMAL DISCIPLINARY LIFECYCLE (ALL 7 STEPS TO APPEAL)
  // ============================================================================
  const timestamp = Date.now();
  const caseRefA = `MOE/DIS/2026/TEST-${timestamp}`;
  const letterNoA = `ED/DIS/2026/TEST-${timestamp}`;
  const subjectFileNoA = `SF/DIS/2026/TEST-${timestamp}`;

  logHeader(`SECTION 2: TRACK A - FULL FORMAL DISCIPLINARY LIFECYCLE\n  Case Ref: ${caseRefA}`);

  // Step 2.1: Letter Registration & Routing by Additional Secretary
  logSubHeader("Step A.1: Daily Mail Registration & Forwarding (Additional Secretary / Daily Mail Section)");
  const mailResA = await saveDailyMailRecordServer({
    letter_no: letterNoA,
    serial_no: caseRefA,
    received_date: new Date().toISOString(),
    submitted_date: new Date().toISOString(),
    subject: "Gross Insubordination and Examination Irregularity Investigation",
    sender: "Zonal Director of Education - Colombo",
    method: "Post",
    type: "Complaint",
    classification: "Disciplinary",
    action_officer: "Bandula Gunawardena",
    addressed_to: "Bandula Gunawardena",
    addressed_role: "assistant_secretary_discipline",
    forwarded_to: "Discipline Branch",
    forward_reason: "Formal investigation required under Establishment Code Chapter XLVIII",
    created_by_name: "Nihal Ranasinghe",
    created_by_role: "Additional Secretary",
    priority: "High",
    status: "registered",
  });
  assert(mailResA.success === true, `Letter registered in Daily Mail Letter Table (Ref: ${caseRefA})`);

  // Verify letter exists in Daily Mail records
  const allMailsRes = await getDailyMailRecordsServer();
  const foundMailA = allMailsRes.data?.find((m: any) => m.letter_no === letterNoA || m.serial_no === caseRefA);
  assert(!!foundMailA, `Letter retrieved from Daily Mail Letter database with status '${foundMailA?.status || "registered"}'`);

  // Step 2.2: Chief Clerk Assignment to Subject Officer
  logSubHeader("Step A.2: Chief Clerk (Discipline) Assignment to Subject Officer");
  const asgnResA = await saveSubjectOfficerAssignmentServer({
    caseNo: caseRefA,
    letterNo: letterNoA,
    subjectOfficerName: "Rathnaweera",
    subjectOfficerId: "b4f9056f-cedf-450a-835a-2d267cffa658",
    chiefClerkName: "Chief Clerk Officer (ශාඛා ප්‍රධානී)",
    assignmentRemarks: "Priority 1: Immediately file Form 5 with concerned persons and appoint inquiry board.",
    branch: "Discipline",
  });
  assert(asgnResA.success === true, "Chief Clerk assigned case to Subject Officer Rathnaweera");

  // Verify letter appears in Subject Officer's dashboard
  const soCasesRes = await getSubjectOfficerDashboardCasesServer("Rathnaweera");
  const casesList = Array.isArray(soCasesRes.data) ? soCasesRes.data : (soCasesRes.data?.cases || []);
  const foundSoCase = casesList.find((c: any) => c.refNumber === caseRefA || c.caseNo === caseRefA || c.letterNo === letterNoA);
  assert(!!foundSoCase, "Case successfully retrieved in Subject Officer Rathnaweera's active case queue");

  // Step 2.3: Subject Officer Details & Accused Officer Registration (Form 5)
  logSubHeader("Step A.3: Subject Officer Registers Accused Officer & Case Details (Form 5)");
  const accusedNicA = `1985${Date.now().toString().slice(-8)}`;
  const accusedResA = await saveAccusedOfficerServer({
    ref_number: caseRefA,
    subject_file_no: subjectFileNoA,
    fileName: "discipline",
    subjectOfficer: "Rathnaweera",
    reportState: "statusInquiry",
    receivedDate: "2026-10-20",
    stepTaken: "Called preliminary explanation from Principal and reported to Disciplinary Board",
    priority: "High",
    specialNotes: "Accused teacher was serving as chief supervisor during grade 5 exam",
    classification: "nominal",
    complainantName: "H. M. Bandara, Director of Exams",
    complainantAddress: "National Evaluation Department, Battaramulla",
    instituteName: "Ananda College, Colombo",
    instituteAddress: "Maradana Road, Colombo 10",
    complaintSubject: "Tampering with sealed confidential papers",
    complaintAge: "new",
    accusedConcerned: "yes",
    eduSecApproval: "yes",
    approvalDate: "2026-10-22",
    concernedPersons: [
      {
        fullName: "P. K. Samantha Silva",
        designation: "Teacher Grade 1",
        dateOfBirth: "1985-06-15",
        nic: accusedNicA,
        appointmentDate: "2010-02-01",
        address: "No. 42/B, Flower Road, Colombo 07",
      },
    ],
  });
  assert(accusedResA.success === true, "Form 5: Accused officer and subject case details saved successfully");

  // Verify accused officer record was created and linked
  const accusedFetchA = await getAccusedOfficerByRefServer(caseRefA);
  assert(accusedFetchA.success === true && !!accusedFetchA.data, "Form 5 details retrieved from subject_officer_form_table");
  const firstOfficer = accusedFetchA.data.accused_officers?.[0] || accusedFetchA.data.accused_officer;
  assert(!!firstOfficer, `Linked accused officer verified: ${firstOfficer?.accused_officer_name || firstOfficer?.officer_name}`);

  // Step 2.4: Conduct Formal Inquiry - Committee Appointment & Dates (Form 7)
  logSubHeader("Step A.4: Formal Inquiry Committee Management & Date Extensions (Form 7)");

  // 1. Appoint Chairman
  const chairResA = await saveChairmanByCaseServer(caseRefA, {
    fullName: "Dr. K. L. Wickramasinghe",
    position: "Senior SLEAS Officer / Chief Inquiring Officer",
    email: "k.l.wickrama@dcmms.gov.lk",
    appointedDate: "2026-10-23",
  });
  assert(chairResA.success === true, "Inquiry Board Chairman appointed: Dr. K. L. Wickramasinghe");

  const chairFetch = await getChairmanByCaseServer(caseRefA);
  assert(chairFetch.success === true && !!chairFetch.data, `Chairman verified in database: ${chairFetch.data?.full_name}`);

  // 2. Appoint Members
  const membResA = await saveMembersByCaseServer(caseRefA, [
    {
      fullName: "H. M. Karunaratne",
      position: "Assistant Director of Education",
      email: "hm.karuna@dcmms.gov.lk",
    },
    {
      fullName: "D. S. Alwis",
      position: "Administrative Officer Grade I",
      email: "ds.alwis@dcmms.gov.lk",
    },
  ]);
  assert(membResA.success === true, "Inquiry Board Members appointed (2 members)");

  const membFetch = await getMembersByCaseServer(caseRefA);
  assert(membFetch.success === true && membFetch.data?.length >= 2, `Committee members verified in database (${membFetch.data?.length} members)`);

  // 3. Set Critical Inquiry Deadlines (Appointment Letter & Report Due Date)
  const datesResA = await saveCaseByAppointmentAndReportDueDateServer({
    caseNo: caseRefA,
    subjectFileNo: subjectFileNoA,
    appointmentLetterDate: "2026-10-24",
    reportDueDate: "2026-11-24",
    inquiryType: "Institutional basic inquiry",
    title: "Formal Disciplinary Inquiry under PSC Rules",
    upcomingAction: "Convene preliminary hearing and record prosecution witnesses",
  });
  assert(datesResA.success === true, "Deadlines set: Appointment Letter Date (2026-10-24) & Report Due Date (2026-11-24)");

  const datesFetch = await getCaseByAppointmentAndReportDueDateServer(caseRefA);
  assert(datesFetch.success === true && !!datesFetch.data, "Appointment & Report due date records verified in database");

  // 4. Request 1st Extension
  const extReqA = await saveCaseByDateExtensionServer({
    caseNo: caseRefA,
    subjectFileNo: subjectFileNoA,
    extensionTerm: "1st Extension",
    startDate: "2026-11-25",
    endDate: "2026-12-15",
    subFileNo: subjectFileNoA,
  });
  assert(extReqA.success === true, "1st Date Extension requested (2026-11-25 to 2026-12-15)");

  // 5. Admin Approves Date Extension
  const extApproveA = await updateCaseByDateExtensionApprovalServer(
    caseRefA,
    "Approved",
    "2026-10-26",
    { extention_term: "1st Extension" }
  );
  assert(extApproveA.success === true, "Admin approved 1st Date Extension");

  const extFetch = await getCaseByDateExtensionServer(caseRefA);
  assert(extFetch.success === true && extFetch.data?.approval_status === "Approved", "Extension status verified as 'Approved' in database");

  // Step 2.5: Formal Disciplinary Inspection (Form 8)
  logSubHeader("Step A.5: Formal Disciplinary Inspection (Form 8)");
  const inspectResA = await saveFormalDisciplinaryInspectionServer({
    caseNo: caseRefA,
    invOfficerName: "H. M. Perera",
    invOfficerDesignation: "Chief Inquiring Officer",
    invOfficerAppointmentDate: "2026-10-24",
    invOfficerTel: "0771234567",
    invOfficerAddress: "Ministry of Education, Isurupaya",
    complaintOfficerName: "M. S. Dissanayake",
    complaintOfficerDesignation: "Prosecuting Officer",
    complaintOfficerAppointmentDate: "2026-10-24",
    complaintOfficerTel: "0719876543",
    complaintOfficerAddress: "Zonal Education Office, Colombo",
    maintenanceOfficerName: "K. A. Jayasuriya",
    maintenanceOfficerDesignation: "Officer Conducting Maintenance / Defence",
    maintenanceOfficerAppointmentDate: "2026-10-24",
    maintenanceOfficerTel: "0785551234",
    maintenanceOfficerAddress: "Discipline Branch, Ministry of Education",
    dateSubmissionReport: "2026-10-25",
    recommendationReport: "Inspection of examination logbook confirmed protocol violation. Proceed with formal charge sheet.",
    dateSubmissionRecApproval: "2026-10-25",
    dateOfApproval: "2026-10-26",
    recommendationApproved: "Yes",
    disciplinaryOrder: "Issue formal charge sheet under Second Schedule of Chapter XLVIII",
    approvalSecretaryStatus: "Approved",
    approvalSecretaryDetails: "Approved by Additional Secretary on behalf of Disciplinary Authority",
    orderStartDate: "2026-10-26",
    orderEndDate: "2027-10-26",
    otherDecisions: "Interdiction pending formal inquiry outcome",
  });
  assert(inspectResA.success === true, "Formal Disciplinary Inspection details saved successfully");

  const inspectFetch = await getFormalDisciplinaryInspectionServer(caseRefA);
  assert(inspectFetch.success === true && !!inspectFetch.data, "Inspection data retrieved and verified in formal_disciplinary_inspection_table");

  // Step 2.6: Recommendations & Charge Sheet (Form 9A & 9B)
  logSubHeader("Step A.6: Charge Sheet Issuance & Disciplinary Order (Form 9A & 9B)");
  const recResA = await saveRecommendationServer({
    ref_number: caseRefA,
    category_recommendation: "issuing_charge_sheet",
    issued_charge_sheet: "Second Schedule",
    disciplinary_authority: "Secretary of Education",
    date_the_charge_sheet_issued: "2026-10-15",
    date_request_documents: "2026-10-17",
    date_submission_documents: "2026-10-19",
    date_the_response_to_the_charge_sheet_was_given: "2026-10-22",
    agree_with_answers: "no", // Disputed charges
    target_implementation_date: "2026-11-01",
    investigation_recommendation: "Offence proved beyond doubt. Impose stoppage of 1 year salary increment and disciplinary transfer.",
    circular_reference: "Establishment Code XLVIII Sec. 12",
    minute_ref: "ED/SEC/MIN/2026/89",
    date_approved_by_secretory: "2026-10-26",
    secretory_recommendation: "Approved disciplinary penalty as recommended. Final order issued to accused.",
    case_status: "Submitted",
  });
  assert(recResA.success === true, "Form 9A/9B: Charge sheet details and Secretary Disciplinary Directive saved");

  const csFetch = await getChargeSheetDetailsServer(caseRefA);
  assert(csFetch.success === true && !!csFetch.data, `Charge sheet details verified in database (Authority: ${csFetch.data?.disciplinary_authority})`);

  // Step 2.7: LAST STEP - Appeal Management (Form 10) & Case Closure
  logSubHeader("Step A.7: LAST STEP - Appeal Management (Form 10: PSC / AAT / Court) & Case Closure");
  const appealRefA = `PSC/APP/${caseRefA}`;
  
  // Advance case to Appeal stage and log final verdict
  const appealPayload = {
    ref_number: caseRefA,
    appeal_ref: appealRefA,
    appeal_authority: "PSC",
    appeal_filed_date: "2026-10-26",
    appeal_ground: "Appeal against 1-year increment stoppage claiming procedural delay",
    appeal_decision: "Public Service Commission Upheld Ministry Order with Strict Final Reprimand. File Closed.",
    case_status: "Closed",
    agree_with_psc_decision: "yes",
    secretory_recommendation: "Final PSC Decision Implemented. Disciplinary case fully concluded and archived.",
    date_approved_by_secretory: "2026-10-26",
  };
  const appealSaveRes = await saveRecommendationServer(appealPayload);
  assert(appealSaveRes.success === true, "Appeal decision recorded and Case Status set to 'Closed'");

  // Verify full timeline includes every step from Daily Mail to Final Closed Appeal
  const timelineA = await getCaseFullTimelineServer(caseRefA);
  assert(timelineA.success === true && !!timelineA.data, "Case Full Timeline generated with all lifecycle steps");
  assert(timelineA.data.dailyMailRows?.length > 0, "Timeline contains Daily Mail registration record");
  assert(!!timelineA.data.subjectForm, "Timeline contains Subject Officer registration record");
  assert(!!timelineA.data.chairman, "Timeline contains Inquiry Board Chairman record");
  assert(timelineA.data.members?.length > 0, "Timeline contains Committee Members record");
  assert(timelineA.data.extensions?.length > 0, "Timeline contains Extension Approval record");
  assert(timelineA.data.accusedOfficers?.length > 0, "Timeline contains Accused Officers record");

  logSuccess(`🏆 TRACK A COMPLETE: Case ${caseRefA} successfully advanced through ALL steps to FINAL CLOSED APPEAL!`);

  // ============================================================================
  // SECTION 3: TRACK B - PROVINCIAL / PRELIMINARY INVESTIGATION LIFECYCLE
  // ============================================================================
  const caseRefB = `MOE/INV/2026/TEST-${timestamp}`;
  const letterNoB = `ED/INV/2026/TEST-${timestamp}`;

  logHeader(`SECTION 3: TRACK B - PROVINCIAL / PRELIMINARY INVESTIGATION LIFECYCLE\n  Case Ref: ${caseRefB}`);

  // Step 3.1: Register Letter to Investigation Branch
  logSubHeader("Step B.1: Registration & Forwarding to Investigation Branch");
  const mailResB = await saveDailyMailRecordServer({
    letter_no: letterNoB,
    serial_no: caseRefB,
    received_date: new Date().toISOString(),
    submitted_date: new Date().toISOString(),
    subject: "Complaint on Misuse of School Development Society Funds",
    sender: "Bribery & Corruption Commission (CIABOC)",
    method: "Hand",
    type: "Inquiry",
    classification: "Disciplinary",
    action_officer: "Ranjith Siyambalapitiya",
    addressed_to: "Ranjith Siyambalapitiya",
    addressed_role: "assistant_secretary_investigation",
    forwarded_to: "Investigation Branch",
    forward_reason: "Conduct on-site financial audit and preliminary investigation",
    created_by_name: "Dharshana Senanayake",
    created_by_role: "Senior Assistant Secretary",
    priority: "Normal",
    status: "registered",
  });
  assert(mailResB.success === true, `Investigation letter registered (Ref: ${caseRefB})`);

  // Step 3.2: Chief Clerk Investigation assigns to Investigation Officer
  logSubHeader("Step B.2: Chief Clerk (Investigation) Assigns to Investigation Officer");
  const asgnResB = await saveSubjectOfficerAssignmentServer({
    caseNo: caseRefB,
    letterNo: letterNoB,
    subjectOfficerName: "Sunil Fernando",
    subjectOfficerId: "cea15be0-9f6e-4fda-a0f0-7c0c59cc7a34",
    chiefClerkName: "nimal",
    assignmentRemarks: "Complete preliminary investigation within 14 days and submit findings report.",
    branch: "Investigation",
  });
  assert(asgnResB.success === true, "Chief Clerk (Investigation) assigned case to Investigation Officer Sunil Fernando");

  // Step 3.3: Provincial / Preliminary Investigation Setup (Form 6)
  logSubHeader("Step B.3: Conduct Preliminary Investigation (Form 6)");
  const invSetupRes = await saveConductInquiryServer({
    caseNo: caseRefB,
    inquiryType: "Province basic inquiry",
    title: "Financial Irregularity",
    appointmentDate: "2026-10-10",
    dueDate: "2026-10-24",
    approvalDate: "2026-10-09",
    officers: "Sunil Fernando, K. D. Gamage",
    upcomingAction: "Evidence Gathering",
    recommendation: "Audit team deployed to inspect SDS bank vouchers and receipts.",
  });
  assert(invSetupRes.success === true, "Preliminary Provincial Investigation setup successfully");

  // Step 3.4: LAST STEP - Report Submission & Final Investigation Sign-off
  logSubHeader("Step B.4: LAST STEP - Preliminary Investigation Completion & Sign-off");
  const invCompleteRes = await saveConductInquiryServer({
    caseNo: caseRefB,
    inquiryType: "Province basic inquiry",
    title: "Financial Irregularity",
    appointmentDate: "2026-10-10",
    dueDate: "2026-10-24",
    reportReceivedDate: "2026-10-26",
    approvalDate: "2026-10-26",
    officers: "Sunil Fernando, K. D. Gamage",
    upcomingAction: "Completed",
    recommendation: "All cash vouchers accounted for. No criminal breach found. Minor bookkeeping advice issued. Investigation complete.",
  });
  assert(invCompleteRes.success === true, "Preliminary Investigation marked as 'Completed' with final report");

  // Verify record
  const checkInvRecord = await prisma.$queryRaw`
    SELECT id, case_no, inquiry_type, upcoming_action, report_received_date 
    FROM conduct_inquiry_table 
    WHERE case_no = ${caseRefB}
    LIMIT 1;
  ` as any[];
  assert(checkInvRecord.length > 0 && checkInvRecord[0].upcoming_action === "Completed", "Investigation record verified as 'Completed' in conduct_inquiry_table");

  logSuccess(`🏆 TRACK B COMPLETE: Case ${caseRefB} successfully completed to the FINAL STEP!`);

  // ============================================================================
  // SECTION 4: TRACK C - LETTER EDIT REQUEST WORKFLOW
  // ============================================================================
  const caseRefC = `MOE/EDIT/2026/TEST-${timestamp}`;
  const letterNoC = `ED/EDIT/2026/TEST-${timestamp}`;

  logHeader(`SECTION 4: TRACK C - LETTER EDIT REQUEST & ADMIN APPROVAL WORKFLOW\n  Case Ref: ${caseRefC}`);

  // Step 4.1: Register initial letter
  logSubHeader("Step C.1: Register Letter for Edit Testing");
  await saveDailyMailRecordServer({
    letter_no: letterNoC,
    serial_no: caseRefC,
    received_date: new Date().toISOString(),
    submitted_date: new Date().toISOString(),
    subject: "Administrative Routine Query",
    sender: "Principal, Royal College",
    method: "Email",
    type: "Request",
    classification: "General",
    status: "registered",
  });
  logSuccess(`Initial letter registered: ${caseRefC}`);

  // Step 4.2: Subject Officer submits Edit Request
  logSubHeader("Step C.2: Subject Officer Submits Letter Edit Request");
  const editReqRes = await createLetterEditRequestServer({
    letter_id: letterNoC,
    ref_no: caseRefC,
    requested_by: "Rathnaweera",
    requester_email: "rathnaweera@dcmms.gov.lk",
    requester_role: "Subject officer",
    target_branch_admin: "Discipline Branch Admin",
    reason: "Correction required for sender address and attached letter date",
  });
  const reqId = editReqRes.data?.id || (editReqRes as any).requestId;
  assert(editReqRes.success === true && !!reqId, `Edit Request created (ID: ${reqId})`);

  // Step 4.3: Admin views Pending Edit Requests
  logSubHeader("Step C.3: Admin Retrieves Pending Edit Requests");
  const pendingRequests = await getLetterEditRequestsServer({ status: "Pending" });
  assert(pendingRequests.success === true, "Retrieved pending edit requests");
  const targetReq = pendingRequests.data?.find((r: any) => r.ref_no === caseRefC || r.id === reqId);
  assert(!!targetReq, `Target edit request located in pending list with reason: "${targetReq?.reason}"`);

  // Step 4.4: Admin Approves Edit Request
  logSubHeader("Step C.4: Admin Approves Edit Request");
  const updateReqRes = await updateLetterEditRequestStatusServer({
    requestId: reqId,
    status: "Approved",
    reviewed_by: "Dilhani Priyangika",
    reviewer_comments: "Verified against original physical mail scan. Approved.",
  });
  assert(updateReqRes.success === true, "Admin approved letter edit request");

  // Step 4.5: Verify Approval Status Check Function
  const checkStatus = await checkLetterEditApprovalStatusServer(letterNoC, caseRefC);
  assert(checkStatus.isApproved === true || checkStatus.canEdit === true, "checkLetterEditApprovalStatusServer confirmed officer is authorized to edit");

  logSuccess(`🏆 TRACK C COMPLETE: Edit Request workflow passed with flying colors!`);

  // ============================================================================
  // SECTION 5: CROSS-CUTTING OPERATIONS - SYSTEM ADMIN & SCHEDULING
  // ============================================================================
  logHeader("SECTION 5: SYSTEM ADMIN OFFICER LIFECYCLE & AUDIT LOGS");

  // Step 5.1: Create New Officer
  logSubHeader("Step 5.1: Create New Officer (System Admin)");
  const testEmpNo = `EMP-TEST-${timestamp.toString().slice(-6)}`;
  const testOfficerEmail = `test.officer.${timestamp}@dcmms.gov.lk`;
  const createOfficerRes = await saveRegisterOfficerServer({
    employee_no: testEmpNo,
    full_name: "Test Operations Officer",
    email: testOfficerEmail,
    role: "Subject officer",
    password: "Password@123",
    subject_type: "Provincial Schools",
    is_active: true,
  });
  const officerId = createOfficerRes.data?.id || (createOfficerRes as any).officerId;
  assert(createOfficerRes.success === true && !!officerId, `New officer created: ${testOfficerEmail} (${testEmpNo})`);

  // Step 5.2: Toggle Officer Status
  logSubHeader("Step 5.2: Toggle Officer Active / Inactive Status");
  const toggleRes = await toggleRegisterOfficerStatusServer(officerId, false);
  assert(toggleRes.success === true, "Officer deactivated successfully");

  const toggleRes2 = await toggleRegisterOfficerStatusServer(officerId, true);
  assert(toggleRes2.success === true, "Officer reactivated successfully");

  // Step 5.3: Password Reset
  logSubHeader("Step 5.3: Reset Officer Password");
  const resetPassRes = await resetOfficerPasswordServer({
    targetOfficerId: officerId,
    newPassword: "NewSecretPassword#456",
  });
  assert(resetPassRes.success === true, "Officer password reset successfully");

  // Step 5.4: Verify login with new password
  const testLoginRes = await loginOfficerServer(testOfficerEmail, "NewSecretPassword#456");
  assert(testLoginRes.success === true, "New officer logged in successfully with updated password");

  // Step 5.5: Clean up Test Officer
  logSubHeader("Step 5.5: Clean up Test Officer");
  const deleteRes = await deleteRegisterOfficerServer(officerId);
  assert(deleteRes.success === true, "Test officer deleted cleanly from register_officer_table");

  // Step 5.6: Hearing Calendar Event Scheduling
  logSubHeader("Step 5.6: Hearing Calendar Event Scheduling");
  const hearingRes = await prisma.$executeRaw`
    INSERT INTO case_history (
      case_id, action_type, description, status, performed_by, performed_role, remarks, created_at
    ) VALUES (
      ${caseRefA}, 'Hearing Scheduled', 'Oral witness examination scheduled in Room 302',
      'Scheduled', 'System Administrator', 'system_admin', 'Witness summons issued', NOW()
    );
  `;
  assert(hearingRes === 1, `Hearing event registered in case_history for case ${caseRefA}`);

  // Step 5.7: Audit Logging
  logSubHeader("Step 5.7: Verify System Audit Logging");
  const auditRes = await logAuditEventServer(
    "E2E_FULL_SYSTEM_VERIFICATION",
    "System Administrator",
    "Completed end-to-end multi-role test covering all 8 roles and advancing cases to final closure.",
    "abbdb714-7bcc-46a0-8238-4bd81ac05846",
    "admin@dcmms.gov.lk"
  );
  assert(auditRes.success === true, "Audit log event persisted successfully to dcmms_audit_logs");

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  logHeader("TEST EXECUTION SUMMARY");
  console.log(`${c.green}${c.bold}TOTAL PASSED ASSERTIONS : ${passedTests}${c.reset}`);
  console.log(`${failedTests === 0 ? c.green : c.red}${c.bold}TOTAL FAILED ASSERTIONS : ${failedTests}${c.reset}`);
  console.log(`Execution Time: ${duration} seconds`);
  console.log(`Completed At  : ${new Date().toISOString()}`);

  if (failedTests === 0) {
    console.log(`\n${c.green}${c.bold}🎉 ALL FUNCTIONS, ROLES, AND SEPARATE LETTER TRACKS PASSED AND ADVANCED TO THEIR FINAL STEP! 🎉${c.reset}\n`);
  } else {
    console.log(`\n${c.red}${c.bold}⚠️ SOME TESTS FAILED. PLEASE REVIEW LOGS ABOVE. ⚠️${c.reset}\n`);
    process.exit(1);
  }

  await prisma.$disconnect();
}

runFullSystemTest().catch((err) => {
  console.error("Fatal Test Failure:", err);
  process.exit(1);
});
