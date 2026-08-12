const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const parseSchoolList = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
      } catch (e) {}
    }
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const isOfficerConnectedToCaseInstitute = (off, caseInsts) => {
  if (!caseInsts || caseInsts.length === 0) return false;

  const officerSchools = [
    ...parseSchoolList(off.studiedSchools),
    ...parseSchoolList(off.studied_schools),
    ...parseSchoolList(off.childrenSchools),
    ...parseSchoolList(off.children_schools),
    ...parseSchoolList(off.member_school_name),
    ...parseSchoolList(off.member_children_schools_name),
  ];

  if (off.institute_name) officerSchools.push(off.institute_name);
  if (off.instituteName) officerSchools.push(off.instituteName);
  if (off.school) officerSchools.push(off.school);
  if (off.schoolName) officerSchools.push(off.schoolName);

  const cleanOfficerSchools = officerSchools
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter(Boolean);

  if (cleanOfficerSchools.length === 0) return false;

  return caseInsts.some((caseInst) => {
    const cleanCaseInst = caseInst.trim().toLowerCase();
    if (!cleanCaseInst) return false;
    return cleanOfficerSchools.some(
      (offSch) => offSch === cleanCaseInst || offSch.includes(cleanCaseInst) || cleanCaseInst.includes(offSch)
    );
  });
};

async function testInstituteFilter() {
  console.log("=== Testing Institute Conflict Filtering for Inquiry Chairmen & Members ===");

  const sampleCaseInstitute = ["C.W.W. KANNANGARA M.M.V."];

  const testOfficers = [
    {
      fullName: "Sumudu Lakmal",
      position: "Chairman",
      studied_schools: "C.W.W. KANNANGARA M.M.V., Ananda College",
      children_schools: "",
    },
    {
      fullName: "Kamal Perera",
      position: "Chairman",
      studied_schools: "Royal College, Colombo",
      children_schools: "Visakha Vidyalaya",
    },
    {
      fullName: "sathsarani",
      position: "Member",
      studied_schools: "",
      children_schools: "C.W.W. KANNANGARA M.M.V.",
    },
    {
      fullName: "Nimal Siripala",
      position: "Member",
      studied_schools: "Maliyadeva College",
      children_schools: "Dharmaraja College",
    },
  ];

  console.log(`Case Institute: ${sampleCaseInstitute.join(", ")}\n`);

  testOfficers.forEach((off) => {
    const isConflicted = isOfficerConnectedToCaseInstitute(off, sampleCaseInstitute);
    console.log(`Officer: ${off.fullName} (${off.position})`);
    console.log(`  Studied: "${off.studied_schools || "N/A"}" | Children: "${off.children_schools || "N/A"}"`);
    console.log(`  Conflict with case institute? ${isConflicted ? "YES -> FILTERED OUT (EXCLUDED)" : "NO -> ELIGIBLE (INCLUDED)"}\n`);
  });

  const availableChairmen = testOfficers
    .filter((o) => o.position.toLowerCase() === "chairman")
    .filter((o) => !isOfficerConnectedToCaseInstitute(o, sampleCaseInstitute));

  const availableMembers = testOfficers
    .filter((o) => o.position.toLowerCase() === "member")
    .filter((o) => !isOfficerConnectedToCaseInstitute(o, sampleCaseInstitute));

  console.log("=== Filtered Selection Results for Dropdowns ===");
  console.log("Available Chairmen:", availableChairmen.map((c) => c.fullName));
  console.log("Available Members:", availableMembers.map((m) => m.fullName));

  await prisma.$disconnect();
}

testInstituteFilter().catch((err) => {
  console.error(err);
  process.exit(1);
});
