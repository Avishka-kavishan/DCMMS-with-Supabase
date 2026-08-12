const { getCommitteeOfficersWithSchoolsServer } = require('../lib/db-actions');

async function main() {
  console.log("=== Testing getCommitteeOfficersWithSchoolsServer with Position Filtering ===");

  // 1. All officers from commitee_table
  const allRes = await getCommitteeOfficersWithSchoolsServer();
  console.log("All Committee Officers count:", allRes.data ? allRes.data.length : 0);
  if (allRes.data && allRes.data.length > 0) {
    console.log("Sample officer:", {
      id: allRes.data[0].id,
      employee_no: allRes.data[0].employee_no,
      full_name: allRes.data[0].full_name,
      position: allRes.data[0].position,
      studied_schools: allRes.data[0].studied_schools,
    });
  }

  // 2. Chairman filtered
  const chairmanRes = await getCommitteeOfficersWithSchoolsServer("Chairman");
  console.log("\nChairman Officers count:", chairmanRes.data ? chairmanRes.data.length : 0);
  if (chairmanRes.data && chairmanRes.data.length > 0) {
    console.log("Chairmen:", chairmanRes.data.map(c => `${c.full_name} (${c.position})`));
  }

  // 3. Member filtered
  const memberRes = await getCommitteeOfficersWithSchoolsServer("Member");
  console.log("\nMember Officers count:", memberRes.data ? memberRes.data.length : 0);
  if (memberRes.data && memberRes.data.length > 0) {
    console.log("Members:", memberRes.data.map(m => `${m.full_name} (${m.position})`));
  }
}

main().catch(console.error);
