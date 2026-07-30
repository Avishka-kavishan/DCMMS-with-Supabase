filepath = r"c:\assignment\Temparary DMMS with database\app\subject\add-details\page.tsx"

with open(filepath, "rb") as f:
    raw = f.read()

content = raw.replace(b"\r\r\n", b"\r\n").decode("utf-8")

# 1. Add Preliminary Investigation States after line declaration for priority
states_anchor = '  const [priority, setPriority] = useState("medium");'
prelim_states = '''  const [priority, setPriority] = useState("medium");

  // Preliminary Investigation Process Flow States (7 Stages, 12 Steps)
  const [isPrelimEnabled, setIsPrelimEnabled] = useState(false);
  const [prelimReason, setPrelimReason] = useState("");
  const [prelimCommittee, setPrelimCommittee] = useState<Array<{ id: string; name: string; position: string; contact: string }>>([
    { id: "cm-1", name: "", position: "", contact: "" }
  ]);
  const [prelimApptDate, setPrelimApptDate] = useState("");
  const [prelimDueDate, setPrelimDueDate] = useState("");
  const [prelimReportSubmitted, setPrelimReportSubmitted] = useState(false);
  const [prelimReportReceivedDate, setPrelimReportReceivedDate] = useState("");
  const [prelimFindings, setPrelimFindings] = useState("");
  const [prelimObservations, setPrelimObservations] = useState("");
  const [prelimRecommendations, setPrelimRecommendations] = useState("");
  const [prelimNextAction, setPrelimNextAction] = useState<"no_further_action" | "formal_investigation" | "additional_clarification" | "other_disciplinary">("formal_investigation");'''

if states_anchor in content:
    content = content.replace(states_anchor, prelim_states)
    print("Added Preliminary Investigation states")
else:
    print("WARNING: Could not find states_anchor")

# 2. Add loading prelim data in Supabase block
load_anchor = '// Load concerned officer details'
prelim_load = '''// Load Preliminary Investigation details
            if (isSupabaseConfigured) {
              try {
                const { data: dbPrelim } = await supabase
                  .from("dcmms_preliminary_investigations")
                  .select("*")
                  .eq("case_no", caseNoParam)
                  .maybeSingle();

                if (dbPrelim) {
                  setIsPrelimEnabled(true);
                  setPrelimReason(dbPrelim.reason || "");
                  if (Array.isArray(dbPrelim.committee_members)) setPrelimCommittee(dbPrelim.committee_members);
                  setPrelimApptDate(dbPrelim.appointment_date || "");
                  setPrelimDueDate(dbPrelim.report_due_date || "");
                  setPrelimReportReceivedDate(dbPrelim.report_received_date || "");
                  if (dbPrelim.report_received_date) setPrelimReportSubmitted(true);
                  setPrelimFindings(dbPrelim.findings || "");
                  setPrelimObservations(dbPrelim.observations || "");
                  setPrelimRecommendations(dbPrelim.recommendations || "");
                  setPrelimNextAction(dbPrelim.next_action || "formal_investigation");
                }
              } catch (e) {}
            }

            // Load concerned officer details'''

if load_anchor in content:
    content = content.replace(load_anchor, prelim_load)
    print("Added Preliminary Investigation data loading")
else:
    print("WARNING: Could not find load_anchor")

# 3. Add saving prelim data in saveCaseData
save_anchor = '// Save action/letters details as a new row in dcmms_subject_details'
prelim_save = '''// Save Preliminary Investigation details
        if (isPrelimEnabled) {
          try {
            await supabase
              .from("dcmms_preliminary_investigations")
              .upsert({
                id: `prelim-${refNo}`,
                case_no: refNo,
                reason: prelimReason,
                committee_members: prelimCommittee,
                appointment_date: prelimApptDate || null,
                report_due_date: prelimDueDate || null,
                report_received_date: prelimReportReceivedDate || null,
                findings: prelimFindings,
                observations: prelimObservations,
                recommendations: prelimRecommendations,
                next_action: prelimNextAction,
                status: prelimNextAction === "formal_investigation" ? "Forwarded to Investigation Branch" : "Completed",
              }, { onConflict: "case_no" });
          } catch (err) {
            console.error("Failed to save preliminary investigation:", err);
          }
        }

        // Save action/letters details as a new row in dcmms_subject_details'''

if save_anchor in content:
    content = content.replace(save_anchor, prelim_save)
    print("Added Preliminary Investigation data saving")
else:
    print("WARNING: Could not find save_anchor")

with open(filepath, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("Finished logic injection in add-details/page.tsx")
