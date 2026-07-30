filepath_inv = r"c:\assignment\Temparary DMMS with database\app\investigation\add-details\page.tsx"

with open(filepath_inv, "rb") as f:
    raw = f.read()

content_inv = raw.replace(b"\r\r\n", b"\r\n").decode("utf-8")

# Fix targetSubjectOfficer line
content_inv = content_inv.replace(
    'const targetSubjectOfficer = assignee || selectedCase?.assignee || existingAssignment?.subjectOfficerName || "Subject Officer";',
    'const targetSubjectOfficer = assignee || selectedCase?.subjectOfficerName || selectedCase?.officerName || selectedCase?.assignee || existingAssignment?.subjectOfficerName || "Subject Officer";'
)

# Fix display span line in card
old_span = '{existingAssignment?.subjectOfficerName || selectedCase?.subjectOfficerName || selectedCase?.officerName || "Subject Officer"}'
new_span = '{existingAssignment?.subjectOfficerName || selectedCase?.subjectOfficerName || selectedCase?.officerName || selectedCase?.assignee || assignee || (lang === "si" ? "විෂය නිලධාරී" : "Subject Officer")}'

if old_span in content_inv:
    content_inv = content_inv.replace(old_span, new_span)
    print("Successfully replaced span in add-details/page.tsx")
else:
    print("WARNING: Could not find old_span in add-details/page.tsx")

with open(filepath_inv, "w", encoding="utf-8", newline="") as f:
    f.write(content_inv)

# Now fix app/subject/page.tsx line 1152 fallback "Rathnaweera" -> localized fallback
filepath_subj = r"c:\assignment\Temparary DMMS with database\app\subject\page.tsx"
with open(filepath_subj, "rb") as f:
    raw_subj = f.read()

content_subj = raw_subj.replace(b"\r\r\n", b"\r\n").decode("utf-8")

old_subj_line = '{lang === "si" ? "විෂය නිලධාරී:" : "Subject Officer:"} <strong>{asgn.subjectOfficerName || "Rathnaweera"}</strong>'
new_subj_line = '{lang === "si" ? "විෂය නිලධාරී:" : "Subject Officer:"} <strong>{asgn.subjectOfficerName || (lang === "si" ? "විෂය නිලධාරී" : "Subject Officer")}</strong>'

if old_subj_line in content_subj:
    content_subj = content_subj.replace(old_subj_line, new_subj_line)
    print("Successfully replaced Rathnaweera in subject/page.tsx")
else:
    print("WARNING: Could not find old_subj_line in subject/page.tsx")

with open(filepath_subj, "w", encoding="utf-8", newline="") as f:
    f.write(content_subj)

print("All fixes applied successfully!")
