filepath = r"c:\assignment\Temparary DMMS with database\app\subject\add-details\page.tsx"

with open(filepath, "rb") as f:
    raw = f.read()

content = raw.replace(b"\r\r\n", b"\r\n").decode("utf-8")

prelim_ui = '''
                {/* ── PRELIMINARY INVESTIGATION PROCESS FLOW (7 STAGES / 12 STEPS / 4 NEXT ACTIONS) ── */}
                <div style={{ marginTop: "24px", backgroundColor: "#ffffff", padding: "24px", borderRadius: "14px", border: "1.5px solid #cbd5e1", boxShadow: "0 4px 12px rgba(0,0,0,0.03)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "17px", color: "#0f172a", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg, #0284c7, #2563eb)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🔍</span>
                        {lang === "si" ? "ප්‍රාථමික විමර්ශන ක්‍රියාවලිය (Preliminary Investigation Process)" : "Preliminary Investigation Process Flow"}
                      </h3>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                        {lang === "si" ? "ප්‍රාථමික විමර්ශනය ආරම්භ කිරීම, කමිටුව පත් කිරීම, වාර්තා, නිරීක්ෂණ හා ඉදිරි ක්‍රියාමාර්ග ඇතුළත් කරන්න." : "Initiate preliminary investigation, appoint committee, record report findings & select next action."}
                      </p>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: isPrelimEnabled ? "#0284c7" : "#64748b" }}>
                        {isPrelimEnabled ? (lang === "si" ? "ක්‍රියාත්මකයි" : "Enabled") : (lang === "si" ? "අක්‍රියයි" : "Disabled")}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsPrelimEnabled(!isPrelimEnabled)}
                        style={{
                          width: "52px",
                          height: "28px",
                          borderRadius: "20px",
                          backgroundColor: isPrelimEnabled ? "#0284c7" : "#cbd5e1",
                          border: "none",
                          cursor: "pointer",
                          position: "relative",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          backgroundColor: "#ffffff",
                          position: "absolute",
                          top: "3px",
                          left: isPrelimEnabled ? "27px" : "3px",
                          transition: "all 0.2s ease",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                        }} />
                      </button>
                    </div>
                  </div>

                  {isPrelimEnabled && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                      
                      {/* STAGE A: INITIATION (Steps 1 & 2) */}
                      <div style={{ backgroundColor: "#f0f9ff", borderRadius: "12px", border: "1px solid #bae6fd", padding: "16px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                          <span>A. INITIATION</span> • <span>Steps 1 & 2</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#0f172a", fontWeight: 700 }}>
                            <span style={{ backgroundColor: "#0284c7", color: "#fff", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>1</span>
                            {lang === "si" ? "ප්‍රාථමික විමර්ශනය ආරම්භ කරන ලදී" : "Select & Initiate Preliminary Investigation Request"}
                          </div>
                          <div>
                            <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "6px" }}>
                              Step 2: {lang === "si" ? "ප්‍රාථමික විමර්ශනයට හේතුව / විස්තර:" : "Reason for Preliminary Investigation & Case Details:"}
                            </label>
                            <textarea
                              value={prelimReason}
                              onChange={(e) => setPrelimReason(e.target.value)}
                              rows={2}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid #93c5fd", fontSize: "13px", backgroundColor: "#ffffff" }}
                              placeholder={lang === "si" ? "ප්‍රාථමික විමර්ශනය පැවැත්වීමට තීරණය කිරීමට හේතුව..." : "Enter reason for preliminary investigation..."}
                            />
                          </div>
                        </div>
                      </div>

                      {/* STAGE B & C: COMMITTEE APPOINTMENT & SCHEDULE (Steps 3, 4, 5) */}
                      <div style={{ backgroundColor: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0", padding: "16px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                          B & C. COMMITTEE APPOINTMENT & SCHEDULE • Steps 3, 4, 5
                        </div>

                        {/* Step 3: Committee Members */}
                        <div style={{ marginBottom: "16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <label style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                              Step 3: {lang === "si" ? "ප්‍රාථමික විමර්ශන කමිටු සාමාජිකයන් (බාහිර නිලධාරීන්):" : "Appoint Preliminary Investigation Committee Members (External - Not in System):"}
                            </label>
                            <button
                              type="button"
                              onClick={() => setPrelimCommittee([...prelimCommittee, { id: `cm-${Date.now()}`, name: "", position: "", contact: "" }])}
                              style={{ padding: "4px 10px", backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #86efac", borderRadius: "6px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                            >
                              + {lang === "si" ? "සාමාජිකයෙක් එක් කරන්න" : "Add Member"}
                            </button>
                          </div>

                          {prelimCommittee.map((cm, idx) => (
                            <div key={cm.id || idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 40px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                              <input
                                type="text"
                                placeholder={lang === "si" ? `සාමාජික #${idx + 1} නම` : `Member #${idx + 1} Name`}
                                value={cm.name}
                                onChange={(e) => {
                                  const list = [...prelimCommittee];
                                  list[idx].name = e.target.value;
                                  setPrelimCommittee(list);
                                }}
                                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #86efac", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                              <input
                                type="text"
                                placeholder={lang === "si" ? "තනතුර / ආයතනය" : "Designation / Institute"}
                                value={cm.position}
                                onChange={(e) => {
                                  const list = [...prelimCommittee];
                                  list[idx].position = e.target.value;
                                  setPrelimCommittee(list);
                                }}
                                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #86efac", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                              <input
                                type="text"
                                placeholder={lang === "si" ? "දුරකථන / ලිපිනය" : "Contact / Address"}
                                value={cm.contact}
                                onChange={(e) => {
                                  const list = [...prelimCommittee];
                                  list[idx].contact = e.target.value;
                                  setPrelimCommittee(list);
                                }}
                                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #86efac", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                              {prelimCommittee.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setPrelimCommittee(prelimCommittee.filter((_, i) => i !== idx))}
                                  style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700 }}
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Step 4 & 5: Dates */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#166534", display: "block", marginBottom: "4px" }}>
                              Step 5: {lang === "si" ? "පත්වීම් ලිපියේ දිනය:" : "Appointment Letter Date:"}
                            </label>
                            <input
                              type="date"
                              value={prelimApptDate}
                              onChange={(e) => setPrelimApptDate(e.target.value)}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "11px", fontWeight: 700, color: "#dc2626", display: "block", marginBottom: "4px" }}>
                              Step 5: {lang === "si" ? "වාර්තාව බාරදිය යුතු දිනය:" : "Preliminary Report Due Date:"}
                            </label>
                            <input
                              type="date"
                              value={prelimDueDate}
                              onChange={(e) => setPrelimDueDate(e.target.value)}
                              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #fca5a5", fontSize: "12px" }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* STAGE D, E, F: REPORT & FINDINGS (Steps 6 to 11) */}
                      <div style={{ backgroundColor: "#faf5ff", borderRadius: "12px", border: "1px solid #e9d5ff", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#7e22ce", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          D, E & F. REPORT, FINDINGS & RECOMMENDATIONS • Steps 6 - 11
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#ffffff", padding: "10px 14px", borderRadius: "8px", border: "1px solid #d8b4fe" }}>
                          <input
                            type="checkbox"
                            id="chkPrelimReportRec"
                            checked={prelimReportSubmitted}
                            onChange={(e) => setPrelimReportSubmitted(e.target.checked)}
                            style={{ width: "18px", height: "18px", cursor: "pointer" }}
                          />
                          <label htmlFor="chkPrelimReportRec" style={{ fontSize: "13px", fontWeight: 700, color: "#6b21a8", cursor: "pointer" }}>
                            Step 7 & 8: {lang === "si" ? "කමිටුව විසින් ප්‍රාථමික විමර්ශන වාර්තාව බාරදී ඇත" : "Committee Has Submitted Preliminary Investigation Report"}
                          </label>
                        </div>

                        {prelimReportSubmitted && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#6b21a8", display: "block", marginBottom: "4px" }}>
                                Step 8: {lang === "si" ? "වාර්තාව ලැබුණු දිනය:" : "Report Received Date:"}
                              </label>
                              <input
                                type="date"
                                value={prelimReportReceivedDate}
                                onChange={(e) => setPrelimReportReceivedDate(e.target.value)}
                                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #d8b4fe", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#6b21a8", display: "block", marginBottom: "4px" }}>
                                Step 9: {lang === "si" ? "ප්‍රධාන සොයාගැනීම් (Key Findings):" : "Key Findings Presented in Report:"}
                              </label>
                              <textarea
                                value={prelimFindings}
                                onChange={(e) => setPrelimFindings(e.target.value)}
                                rows={2}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d8b4fe", fontSize: "12px", backgroundColor: "#ffffff" }}
                                placeholder="Record key findings..."
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#6b21a8", display: "block", marginBottom: "4px" }}>
                                Step 10: {lang === "si" ? "නිරීක්ෂණ (Observations):" : "Observations Based on Findings:"}
                              </label>
                              <textarea
                                value={prelimObservations}
                                onChange={(e) => setPrelimObservations(e.target.value)}
                                rows={2}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d8b4fe", fontSize: "12px", backgroundColor: "#ffffff" }}
                                placeholder="Record observations..."
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#6b21a8", display: "block", marginBottom: "4px" }}>
                                Step 11: {lang === "si" ? "කමිටු යෝජනා / නිර්දේශ (Recommendations):" : "Recommendations Proposed by Committee:"}
                              </label>
                              <textarea
                                value={prelimRecommendations}
                                onChange={(e) => setPrelimRecommendations(e.target.value)}
                                rows={2}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #d8b4fe", fontSize: "12px", backgroundColor: "#ffffff" }}
                                placeholder="Record recommendations..."
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* STAGE G: NEXT ACTION (Step 12 - 4 Options) */}
                      <div style={{ backgroundColor: "#fffbeb", borderRadius: "12px", border: "1px solid #fde68a", padding: "16px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
                          G. STAGE G • Step 12: Determine Next Action (POSSIBLE NEXT ACTIONS)
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                          
                          {/* Option 1: No Further Action */}
                          <div
                            onClick={() => setPrelimNextAction("no_further_action")}
                            style={{
                              padding: "14px",
                              borderRadius: "10px",
                              border: `2px solid ${prelimNextAction === "no_further_action" ? "#16a34a" : "#e2e8f0"}`,
                              backgroundColor: prelimNextAction === "no_further_action" ? "#f0fdf4" : "#ffffff",
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px", color: prelimNextAction === "no_further_action" ? "#15803d" : "#334155", marginBottom: "4px" }}>
                              <span style={{ fontSize: "16px" }}>✅</span>
                              {lang === "si" ? "1. වැඩිදුර ක්‍රියාමාර්ග නැත" : "1. No Further Action"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              {lang === "si" ? "ගොනුව වසා දැමීම / උපදෙස් හෝ අවවාද ලිපියක් නිකුත් කිරීම" : "Close case / Issue Advice or Warning Letter"}
                            </div>
                          </div>

                          {/* Option 2: Request Formal Investigation */}
                          <div
                            onClick={() => setPrelimNextAction("formal_investigation")}
                            style={{
                              padding: "14px",
                              borderRadius: "10px",
                              border: `2px solid ${prelimNextAction === "formal_investigation" ? "#2563eb" : "#e2e8f0"}`,
                              backgroundColor: prelimNextAction === "formal_investigation" ? "#eff6ff" : "#ffffff",
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px", color: prelimNextAction === "formal_investigation" ? "#1d4ed8" : "#334155", marginBottom: "4px" }}>
                              <span style={{ fontSize: "16px" }}>📑</span>
                              {lang === "si" ? "2. ඡන්ද විමර්ශන ඉල්ලීම" : "2. Request Formal Investigation"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              {lang === "si" ? "විමර්ශන අංශය (Investigation Branch) වෙත යොමු කිරීම" : "Forward request to Investigation Branch"}
                            </div>
                          </div>

                          {/* Option 3: Request Additional Clarification */}
                          <div
                            onClick={() => setPrelimNextAction("additional_clarification")}
                            style={{
                              padding: "14px",
                              borderRadius: "10px",
                              border: `2px solid ${prelimNextAction === "additional_clarification" ? "#d97706" : "#e2e8f0"}`,
                              backgroundColor: prelimNextAction === "additional_clarification" ? "#fffbeb" : "#ffffff",
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px", color: prelimNextAction === "additional_clarification" ? "#b45309" : "#334155", marginBottom: "4px" }}>
                              <span style={{ fontSize: "16px" }}>🔄</span>
                              {lang === "si" ? "3. අමතර පැහැදිලි කිරීම් ඉල්ලීම" : "3. Additional Clarification"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              {lang === "si" ? "වැඩිදුර තොරතුරු හෝ ලේඛන ඉල්ලා සිටීම" : "Ask for more information / documents"}
                            </div>
                          </div>

                          {/* Option 4: Other Disciplinary Actions */}
                          <div
                            onClick={() => setPrelimNextAction("other_disciplinary")}
                            style={{
                              padding: "14px",
                              borderRadius: "10px",
                              border: `2px solid ${prelimNextAction === "other_disciplinary" ? "#9333ea" : "#e2e8f0"}`,
                              backgroundColor: prelimNextAction === "other_disciplinary" ? "#faf5ff" : "#ffffff",
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13px", color: prelimNextAction === "other_disciplinary" ? "#7e22ce" : "#334155", marginBottom: "4px" }}>
                              <span style={{ fontSize: "16px" }}>⚖️</span>
                              {lang === "si" ? "4. වෙනත් විනය ක්‍රියාමාර්ග" : "4. Other Disciplinary Actions"}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              {lang === "si" ? "අමාත්‍යාංශ රෙගුලාසි අනුව ඉදිරියට යන්න" : "Proceed as per Ministry regulations"}
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  )}
                </div>
'''

target_anchor = '{/* Action Buttons Row */}'

if target_anchor in content:
    content = content.replace(target_anchor, prelim_ui + "\n\n              " + target_anchor)
    print("Successfully added Preliminary Investigation UI block")
else:
    print("ERROR: Could not find Action Buttons Row anchor")

with open(filepath, "w", encoding="utf-8", newline="") as f:
    f.write(content)

print("Done patching add-details UI!")
