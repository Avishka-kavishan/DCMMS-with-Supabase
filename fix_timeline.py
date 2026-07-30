filepath = r"c:\assignment\Temparary DMMS with database\app\investigation\add-details\page.tsx"

with open(filepath, "rb") as f:
    raw = f.read()

# Fix double \r\r\n -> \r\n first
raw = raw.replace(b"\r\r\n", b"\r\n")

content = raw.decode("utf-8")
lines = content.split("\n")

print(f"Total lines: {len(lines)}")

# Find start: line ending with "))}" after the member map (around line 1031)
start_idx = None
for i in range(1020, min(1040, len(lines))):
    stripped = lines[i].strip()
    if stripped == "))}":
        start_idx = i + 1
        print(f"Found member list end ')}}' at line {i+1} (0-indexed: {i})")
        break

if start_idx is None:
    print("Could not find '))}', searching for alternatives...")
    for i in range(1020, min(1045, len(lines))):
        print(f"  Line {i+1}: [{lines[i].strip()[:80]}]")
    exit(1)

# Find end: "Add/Update Investigation Progress Form Section"
end_idx = None
for i in range(len(lines)):
    if "Add/Update Investigation Progress Form Section" in lines[i]:
        end_idx = i
        print(f"Found progress form section at line {i+1} (0-indexed: {i})")
        break

if end_idx is None:
    print("ERROR: Could not find progress form section marker")
    exit(1)

replacement = '''                              </div>
                            )}
                          </div>

                          {/* Submit Button + Status */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", paddingTop: "4px" }}>
                            <button
                              type="button"
                              onClick={handleStep1SubmitOfficers}
                              style={{ padding: "11px 22px", background: "linear-gradient(135deg, #4f46e5, #6366f1)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: "0 4px 12px rgba(79,70,229,0.3)" }}
                            >
                              <Send size={15} />
                              {lang === "si" ? "විෂය නිලධාරී වෙත යවන්න" : "Submit to Subject Officer"}
                            </button>
                            {existingAssignment?.assignedOfficers && (
                              <div style={{ fontSize: "12px", color: "#1d4ed8", fontWeight: 600, backgroundColor: "#dbeafe", padding: "8px 14px", borderRadius: "8px", maxWidth: "360px" }}>
                                ✓ {lang === "si" ? "විෂය නිලධාරී වෙත යවා ඇත:" : "Sent to Subject Officer:"} {existingAssignment.assignedOfficers}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── STEP 2 ── Received: Appointment Date + Report Due Date from Subject Officer */}
                    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: existingAssignment?.datesSubmittedBySubject ? "#0284c7" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>2</div>
                        <div style={{ width: "2px", flex: 1, minHeight: "20px", backgroundColor: existingAssignment?.datesSubmittedBySubject ? "#0284c7" : "#e2e8f0", marginTop: "4px", marginBottom: "4px" }} />
                      </div>
                      <div style={{ flex: 1, marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: existingAssignment?.datesSubmittedBySubject ? "#0369a1" : "#94a3b8" }}>
                              {lang === "si" ? "2. පත්වීම් ලිපිය සහ වාර්තා දිනය (Subject Officer වෙතින් ලැබෙයි)" : "Step 2: Appointment Letter Date & Report Due Date (Received from Subject Officer)"}
                            </span>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              {lang === "si" ? "Subject Officer දිනය ඇතුළත් කර Admin වෙත යවයි" : "Subject Officer enters dates then sends back to Investigation Admin"}
                            </div>
                          </div>
                          {existingAssignment?.datesSubmittedBySubject ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#dbeafe", color: "#1d4ed8", whiteSpace: "nowrap" }}>✓ Received</span>
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "#94a3b8", whiteSpace: "nowrap" }}>⏳ Awaiting</span>
                          )}
                        </div>
                        <div style={{ backgroundColor: existingAssignment?.datesSubmittedBySubject ? "#f0f9ff" : "#f8fafc", borderRadius: "12px", border: "1px solid " + (existingAssignment?.datesSubmittedBySubject ? "#bae6fd" : "#e2e8f0"), padding: "16px" }}>
                          {existingAssignment?.datesSubmittedBySubject ? (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                              <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #bae6fd" }}>
                                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "4px" }}>📅 {lang === "si" ? "පත්වීම් ලිපිය දිනය" : "Appointment Letter Date"}</div>
                                <div style={{ fontSize: "16px", fontWeight: 700, color: "#0369a1" }}>{existingAssignment.appointmentDate}</div>
                              </div>
                              <div style={{ backgroundColor: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #fecaca" }}>
                                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginBottom: "4px" }}>⏳ {lang === "si" ? "වාර්තාව ලැබිය යුතු දිනය" : "Report Must Be Received By"}</div>
                                <div style={{ fontSize: "16px", fontWeight: 700, color: "#dc2626" }}>{existingAssignment.reportDueDate}</div>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#94a3b8", fontSize: "13px" }}>
                              <Clock size={18} style={{ color: "#cbd5e1" }} />
                              <span>{lang === "si" ? "⏳ පළමු පියවරේ යැවීමෙන් පසු, විෂය නිලධාරී විසින් දිනයන් ඇතුළත් කරනු ඇත." : "⏳ After Step 1 is submitted, Subject Officer will fill the dates."}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── STEP 3 ── Date Extension Request */}
                    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: existingAssignment?.extensionStartDate ? "#d97706" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>3</div>
                        <div style={{ width: "2px", flex: 1, minHeight: "20px", backgroundColor: existingAssignment?.extensionStartDate ? "#d97706" : "#e2e8f0", marginTop: "4px", marginBottom: "4px" }} />
                      </div>
                      <div style={{ flex: 1, marginBottom: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "14px", color: existingAssignment?.extensionStartDate ? "#b45309" : "#94a3b8" }}>
                              {lang === "si" ? "3. දිනය දීර්ඝ කිරීමේ ඉල්ලීම (කළ හොත් පමණයි)" : "Step 3: Extension Request (Optional)"}
                            </span>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              {lang === "si" ? "Admin දිනය, ආරම්භ/අවසාන, ගණන සහිතව Subject Officer වෙත යවයි" : "Admin sends extension start date, end date and extension number to Subject Officer"}
                            </div>
                          </div>
                          {existingAssignment?.extensionApprovalStatus === "Approved" ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d", whiteSpace: "nowrap" }}>✓ Approved</span>
                          ) : existingAssignment?.extensionApprovalStatus === "Disapproved" ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#fee2e2", color: "#b91c1c", whiteSpace: "nowrap" }}>✕ Disapproved</span>
                          ) : existingAssignment?.extensionStartDate ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#fef3c7", color: "#b45309", whiteSpace: "nowrap" }}>⏳ Awaiting Decision</span>
                          ) : null}
                        </div>
                        <div style={{ backgroundColor: "#fffbeb", borderRadius: "12px", border: "1px solid #fde68a", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#78350f", display: "block", marginBottom: "4px" }}>
                                {lang === "si" ? "දීර්ඝ කිරීමේ ගණන:" : "Extension Number:"}
                              </label>
                              <select
                                value={step3Term}
                                onChange={(e) => setStep3Term(e.target.value as any)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fbbf24", fontSize: "12px", backgroundColor: "#ffffff", fontWeight: 600 }}
                              >
                                <option value="First">{lang === "si" ? "1 වන වතාවේ (First)" : "1st Extension"}</option>
                                <option value="Second">{lang === "si" ? "2 වන වතාවේ (Second)" : "2nd Extension"}</option>
                                <option value="Third">{lang === "si" ? "3 වන වතාවේ (Third)" : "3rd Extension"}</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#78350f", display: "block", marginBottom: "4px" }}>
                                {lang === "si" ? "ආරම්භ දිනය:" : "Extension Start Date:"}
                              </label>
                              <input
                                type="date"
                                value={step3StartDate}
                                onChange={(e) => setStep3StartDate(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fbbf24", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: "11px", fontWeight: 700, color: "#78350f", display: "block", marginBottom: "4px" }}>
                                {lang === "si" ? "අවසාන දිනය:" : "Extension End Date:"}
                              </label>
                              <input
                                type="date"
                                value={step3EndDate}
                                onChange={(e) => setStep3EndDate(e.target.value)}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid #fbbf24", fontSize: "12px", backgroundColor: "#ffffff" }}
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleStep3RequestExtension}
                            style={{ padding: "9px 18px", background: "linear-gradient(135deg, #d97706, #f59e0b)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", width: "fit-content" }}
                          >
                            <Send size={13} />
                            {lang === "si" ? "දීර්ඝ කිරීමේ ඉල්ලීම විෂය නිලධාරී වෙත යවන්න" : "Send Extension Request to Subject Officer"}
                          </button>
                          {existingAssignment?.extensionStartDate && (
                            <span style={{ fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "8px", backgroundColor: existingAssignment.extensionApprovalStatus === "Approved" ? "#dcfce7" : existingAssignment.extensionApprovalStatus === "Disapproved" ? "#fee2e2" : "#fef3c7", color: existingAssignment.extensionApprovalStatus === "Approved" ? "#166534" : existingAssignment.extensionApprovalStatus === "Disapproved" ? "#991b1b" : "#b45309" }}>
                              {existingAssignment.extensionApprovalStatus === "Approved"
                                ? ("✓ " + (lang === "si" ? "Subject Officer විසින් අනුමත කරන ලදී" : "Extension Approved by Subject Officer"))
                                : existingAssignment.extensionApprovalStatus === "Disapproved"
                                ? ("✕ " + (lang === "si" ? "Subject Officer විසින් ප්‍රතික්ෂේප කරන ලදී" : "Extension Disapproved by Subject Officer"))
                                : ("⏳ " + (lang === "si" ? "Subject Officer තීරණය බලාපොරොත්තු" : "Awaiting Subject Officer Decision"))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── STEP 4 ── Display Report from Subject Officer */}
                    {existingAssignment?.reportContent && (
                      <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#7c3aed", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>4</div>
                          <div style={{ width: "2px", flex: 1, minHeight: "20px", backgroundColor: "#7c3aed", marginTop: "4px", marginBottom: "4px" }} />
                        </div>
                        <div style={{ flex: 1, marginBottom: "20px" }}>
                          <div style={{ fontWeight: 700, fontSize: "14px", color: "#5b21b6", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span>{lang === "si" ? "4. Subject Officer ගෙන් ලැබූ විමර්ශන වාර්තාව" : "Step 4: Investigation Report Received from Subject Officer"}</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#ede9fe", color: "#5b21b6" }}>✓ Received</span>
                          </div>
                          <div style={{ backgroundColor: "#faf5ff", borderRadius: "12px", border: "1px solid #ddd6fe", padding: "14px 16px" }}>
                            <div style={{ fontSize: "11px", color: "#7c3aed", fontWeight: 700, marginBottom: "6px" }}>
                              📄 {lang === "si" ? "ලැබූ දිනය:" : "Submitted on:"} {existingAssignment.reportSubmitDate || "—"}
                            </div>
                            <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", whiteSpace: "pre-wrap", maxHeight: "120px", overflowY: "auto" }}>
                              {existingAssignment.reportContent}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── STEP 5 ── Admin Sends After-Investigation Details to Subject Officer */}
                    <div style={{ display: "flex", gap: "16px", position: "relative" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: "40px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: existingAssignment?.afterInvestigationSent ? "#16a34a" : "#cbd5e1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>5</div>
                      </div>
                      <div style={{ flex: 1, marginBottom: "20px" }}>
                        <div style={{ fontWeight: 700, fontSize: "14px", color: existingAssignment?.afterInvestigationSent ? "#15803d" : "#94a3b8", marginBottom: "10px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span>{lang === "si" ? "5. විමර්ශනයෙන් පසු තොරතුරු Subject Officer වෙත යැවීම" : "Step 5: Send After-Investigation Details to Subject Officer"}</span>
                          {existingAssignment?.afterInvestigationSent ? (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#dcfce7", color: "#15803d" }}>✓ Sent {existingAssignment.afterInvestigationDate || ""}</span>
                          ) : (
                            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", backgroundColor: "#f1f5f9", color: "#94a3b8" }}>Pending</span>
                          )}
                        </div>
                        <div style={{ backgroundColor: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                          <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600 }}>
                            📤 {lang === "si" ? "පහත ආකෘතියේ විමර්ශන ගොනු අංකය, තත්ත්වය, සටහන් හා ප්‍රගති විස්තර ඇතුළත් කරන්න." : "Fill the Investigation File No., Status, Notes and Progress in the form below then click Send."}
                          </div>
                          <button
                            type="button"
                            onClick={handleStep5SendAfterInvestigation}
                            style={{ padding: "10px 22px", background: "linear-gradient(135deg, #16a34a, #22c55e)", color: "#ffffff", border: "none", borderRadius: "10px", fontWeight: 700, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", width: "fit-content", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}
                          >
                            <Send size={15} />
                            {lang === "si" ? "Step 5: Subject Officer වෙත විමර්ශන විස්තර යවන්න" : "Send After-Investigation Details to Subject Officer"}
                          </button>
                          {existingAssignment?.afterInvestigationSent && (
                            <div style={{ fontSize: "12px", color: "#15803d", fontWeight: 600, backgroundColor: "#dcfce7", padding: "8px 12px", borderRadius: "8px" }}>
                              ✅ {lang === "si" ? "Subject Officer වෙත යවා ඇත:" : "Successfully sent to Subject Officer on"} {existingAssignment.afterInvestigationDate}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
'''

replacement_lines = replacement.split("\n")

# Replace lines from start_idx to end_idx-1
new_lines = lines[:start_idx] + replacement_lines + lines[end_idx:]
print(f"Before: {len(lines)} lines, After: {len(new_lines)} lines")

new_content = "\n".join(new_lines)

with open(filepath, "w", encoding="utf-8", newline="") as f:
    f.write(new_content)

print("Done! File written successfully.")
